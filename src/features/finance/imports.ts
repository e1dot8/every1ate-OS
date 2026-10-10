import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { parseDateInput } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";
import { notify } from "@/features/notifications/service";
import {
  FIELDS,
  detectKind,
  fingerprint,
  guessMapping,
  parseCsv,
  validateRows,
  type ImportKind,
  type ParsedRow,
  type Table,
} from "@/features/finance/import-rules";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
  }
  return String(value);
}

async function readExcel(bytes: ArrayBuffer): Promise<Table> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  const sheet = wb.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const all: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    all.push(values.map((v) => cellText(v).trim()));
  });
  const width = Math.max(0, ...all.map((r) => r.length));
  const [headers = [], ...rows] = all.map((r) => [...r, ...Array(width - r.length).fill("")]);
  return { headers, rows: rows.filter((r) => r.some(Boolean)) };
}

/** Étape 1 : lecture du fichier et création d'un brouillon (rien n'est encore importé). */
export async function createDraftImport(file: File, actor: Actor): Promise<ServiceResult<{ id: string }>> {
  if (!file.size) return failed("Le fichier est vide.");
  if (file.size > MAX_IMPORT_BYTES) return failed("Fichier trop volumineux (5 Mo maximum).");
  const name = file.name.slice(0, 200);
  const bytes = await file.arrayBuffer();
  let table: Table;
  try {
    if (/\.xlsx$/i.test(name)) table = await readExcel(bytes);
    else if (/\.(csv|txt)$/i.test(name)) table = parseCsv(new TextDecoder("utf-8").decode(bytes));
    else return failed("Format non pris en charge : CSV ou Excel (.xlsx).");
  } catch {
    return failed("Fichier illisible : vérifiez qu'il s'agit bien d'un CSV ou d'un .xlsx.");
  }
  if (!table.headers.length || !table.rows.length)
    return failed("Aucune ligne de données trouvée (la première ligne doit contenir les en-têtes).");
  if (table.rows.length > MAX_IMPORT_ROWS)
    return failed(`Trop de lignes (${table.rows.length}) : ${MAX_IMPORT_ROWS} maximum par import.`);
  const kind = detectKind(table.headers);
  const batch = await getDb().importBatch.create({
    data: {
      fileName: name,
      fileHash: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
      kind,
      headers: table.headers,
      rows: table.rows,
      mapping: kind ? guessMapping(kind, table.headers) : undefined,
      rowCount: table.rows.length,
      createdById: actor.id,
    },
  });
  await recordAudit({
    action: "import.uploaded",
    actorId: actor.id,
    targetType: "import",
    targetId: batch.id,
    after: { fileName: name, rows: table.rows.length },
  });
  return done({ id: batch.id });
}

export async function getImport(id: string) {
  return getDb().importBatch.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function listImports() {
  return getDb().importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fileName: true,
      kind: true,
      status: true,
      rowCount: true,
      importedCount: true,
      skippedCount: true,
      createdAt: true,
      projectId: true,
      createdBy: { select: { name: true } },
    },
  });
}

/** Étape 2 : type d'import, projet cible et correspondance des colonnes. */
export async function saveMapping(
  id: string,
  kind: ImportKind,
  projectId: string,
  mapping: Record<string, number | null>,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const batch = await db.importBatch.findUnique({ where: { id } });
  if (!batch || batch.status !== "BROUILLON" || batch.createdById !== actor.id)
    return failed("Import introuvable ou déjà traité.");
  if (!(await db.project.findFirst({ where: { id: projectId, archivedAt: null } })))
    return failed("Choisissez le projet concerné.");
  const width = (batch.headers as string[]).length;
  const clean: Record<string, number | null> = {};
  for (const f of FIELDS[kind]) {
    const v = mapping[f.key];
    clean[f.key] = v != null && Number.isInteger(v) && v >= 0 && v < width ? v : null;
  }
  await db.importBatch.update({ where: { id }, data: { kind, projectId, mapping: clean } });
  return done(null);
}

export type PreviewRow = ParsedRow & { match?: { id: string; label: string } | null };

/** Étape 3 : validation complète, doublons et rapprochements (lecture seule). */
export async function previewImport(id: string) {
  const db = getDb();
  const batch = await db.importBatch.findUnique({ where: { id } });
  if (!batch?.kind || !batch.projectId || !batch.mapping) return null;
  const table: Table = { headers: batch.headers as string[], rows: batch.rows as string[][] };
  const mapping = batch.mapping as Record<string, number | null>;
  const externalIds = new Set<string>();
  const fingerprints = new Set<string>();
  let milestones: { id: string; label: string; invoiceRef: string | null }[] = [];
  if (batch.kind === "COUTS") {
    const costs = await db.costItem.findMany({
      where: { projectId: batch.projectId, archivedAt: null },
      select: {
        externalId: true,
        invoiceDate: true,
        committedAt: true,
        amount: true,
        supplier: true,
        description: true,
      },
    });
    for (const c of costs) {
      if (c.externalId) externalIds.add(c.externalId);
      const date = (c.invoiceDate ?? c.committedAt)?.toISOString().slice(0, 10);
      if (date) fingerprints.add(fingerprint(date, toCents(c.amount), c.supplier ?? c.description));
    }
  } else {
    const payments = await db.paymentRecord.findMany({
      where: { projectId: batch.projectId, deletedAt: null },
      select: { externalId: true, receivedAt: true, amount: true, reference: true, label: true },
    });
    for (const p of payments) {
      if (p.externalId) externalIds.add(p.externalId);
      fingerprints.add(
        fingerprint(p.receivedAt.toISOString().slice(0, 10), toCents(p.amount), p.reference ?? p.label),
      );
    }
    milestones = await db.billingMilestone.findMany({
      where: { projectId: batch.projectId, archivedAt: null },
      select: { id: true, label: true, invoiceRef: true },
    });
  }
  const rows: PreviewRow[] = validateRows(batch.kind, table, mapping, { externalIds, fingerprints }).map(
    (r) => {
      if (batch.kind !== "ENCAISSEMENTS") return r;
      const ref = (r.values.reference as string | null)?.trim().toLowerCase();
      const m = ref ? milestones.find((x) => x.invoiceRef?.trim().toLowerCase() === ref) : undefined;
      return { ...r, match: m ? { id: m.id, label: m.label } : null };
    },
  );
  const sameFile = await db.importBatch.findFirst({
    where: { fileHash: batch.fileHash, status: "IMPORTE", id: { not: id } },
    select: { id: true, createdAt: true },
  });
  return {
    batch,
    rows,
    sameFile,
    counts: {
      valid: rows.filter((r) => !r.errors.length && !r.duplicate).length,
      errors: rows.filter((r) => r.errors.length).length,
      duplicates: rows.filter((r) => !r.errors.length && r.duplicate).length,
      warnings: rows.filter((r) => r.warnings.length).length,
    },
  };
}

/** Étape 4 : confirmation explicite. Idempotente : un second envoi ne réimporte rien. */
export async function confirmImport(
  id: string,
  includeDuplicates: boolean,
  actor: Actor,
): Promise<ServiceResult<{ imported: number }>> {
  const db = getDb();
  const preview = await previewImport(id);
  if (!preview) return failed("Import incomplet : terminez la correspondance des colonnes.");
  const { batch, rows } = preview;
  if (batch.createdById !== actor.id) return failed("Seul l'auteur de l'import peut le confirmer.");
  const toImport = rows.filter((r) => !r.errors.length && (includeDuplicates || !r.duplicate));
  const skipped = rows
    .filter((r) => !toImport.includes(r))
    .map((r) => ({
      line: r.line,
      reasons: r.errors.length
        ? r.errors
        : [r.duplicate === "base" ? "Déjà importée" : "Doublon dans le fichier"],
    }));
  const projectId = batch.projectId!;
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.importBatch.updateMany({
      where: { id, status: "BROUILLON" },
      data: { status: "IMPORTE", importedAt: new Date() },
    });
    if (!claimed.count) return null;
    for (const r of toImport) {
      const v = r.values;
      const date = parseDateInput(v.date as string)!;
      if (batch.kind === "COUTS") {
        const status = v.status as "PREVU" | "ENGAGE" | "FACTURE" | "PAYE" | "ANNULE";
        await tx.costItem.create({
          data: {
            projectId,
            description: v.description as string,
            supplier: v.supplier as string | null,
            category: v.category as string | null,
            amount: centsToDecimal(v.amount as number),
            vatAmount: typeof v.vat === "number" ? centsToDecimal(v.vat) : null,
            amountTTC: typeof v.ttc === "number" ? centsToDecimal(v.ttc) : null,
            status,
            invoiceDate: date,
            committedAt: date,
            paidAt: status === "PAYE" ? date : null,
            externalId: v.externalId as string | null,
            source: "IMPORT",
            importBatchId: id,
            createdById: actor.id,
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            projectId,
            amount: centsToDecimal(v.amount as number),
            receivedAt: date,
            reference: v.reference as string | null,
            label: v.label as string | null,
            billingMilestoneId: r.match?.id ?? null,
            externalId: v.externalId as string | null,
            source: "IMPORT",
            importBatchId: id,
            createdById: actor.id,
          },
        });
      }
    }
    const report = {
      imported: toImport.length,
      skipped,
      matched: toImport.filter((r) => r.match).length,
    } satisfies Prisma.InputJsonValue;
    await tx.importBatch.update({
      where: { id },
      data: { importedCount: toImport.length, skippedCount: skipped.length, report },
    });
    return report;
  });
  if (!result) return done({ imported: batch.importedCount });
  await recordAudit({
    action: "import.confirmed",
    actorId: actor.id,
    projectId,
    targetType: "import",
    targetId: id,
    after: { kind: batch.kind, imported: result.imported, skipped: skipped.length, includeDuplicates },
  });
  await notify({
    userId: actor.id,
    kind: "import",
    title: `Import terminé : ${batch.fileName}`,
    body: `${result.imported} ligne(s) importée(s), ${skipped.length} écartée(s).`,
    href: `/finance/imports/${id}`,
    projectId,
    dedupeKey: `import:${id}`,
  });
  return done({ imported: result.imported });
}

/**
 * Annulation logique : les lignes importées sont archivées, jamais supprimées.
 * Refusée si une ligne a été modifiée depuis l'import (corriger à la main dans ce cas).
 */
export async function cancelImport(id: string, reason: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const batch = await db.importBatch.findUnique({ where: { id } });
  if (!batch) return failed("Import introuvable.");
  if (batch.status === "BROUILLON") {
    await db.importBatch.update({
      where: { id },
      data: { status: "ANNULE", cancelledAt: new Date(), cancelReason: reason },
    });
    return done(null);
  }
  if (batch.status !== "IMPORTE") return failed("Import déjà annulé.");
  const edited = await db.costItem.findMany({
    where: {
      importBatchId: id,
      OR: [
        { archivedAt: { not: null } },
        { updatedAt: { gt: new Date(batch.importedAt!.getTime() + 5000) } },
      ],
    },
    select: { description: true },
  });
  if (edited.length)
    return failed(
      `Annulation impossible : ${edited.length} coût(s) modifié(s) depuis l'import (${edited
        .slice(0, 3)
        .map((e) => e.description)
        .join(", ")}). Corrigez-les individuellement.`,
    );
  const now = new Date();
  await db.$transaction([
    db.costItem.updateMany({ where: { importBatchId: id, archivedAt: null }, data: { archivedAt: now } }),
    db.paymentRecord.updateMany({ where: { importBatchId: id, deletedAt: null }, data: { deletedAt: now } }),
    db.importBatch.update({
      where: { id },
      data: { status: "ANNULE", cancelledAt: now, cancelReason: reason },
    }),
  ]);
  await recordAudit({
    action: "import.cancelled",
    actorId: actor.id,
    projectId: batch.projectId,
    targetType: "import",
    targetId: id,
    reason,
  });
  return done(null);
}
