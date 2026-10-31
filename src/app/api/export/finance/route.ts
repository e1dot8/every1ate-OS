import { connection, type NextRequest } from "next/server";
import {
  billingDate,
  billingSheet,
  costDate,
  costSheet,
  exportFileName,
  inRange,
  notesSheet,
  parseExportScope,
  paymentSheet,
  scopeLabel,
  scopeRange,
  scopeValue,
  synthesisSheet,
  writeWorkbook,
  type SynthesisRow,
} from "@/features/finance/export";
import { projectFinance, projectsOverview } from "@/features/finance/service";
import { projectStatusLabels } from "@/features/projects/labels";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { todayDate } from "@/lib/dates";
import { getDb } from "@/lib/db/client";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const plain = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

const projectSelect = {
  select: { id: true, name: true, status: true, archivedAt: true, client: { select: { name: true } } },
} as const;
const lotSelect = { select: { name: true } } as const;

type ProjectInfo = {
  name: string;
  status: ProjectStatus;
  archivedAt: Date | null;
  client: { name: string } | null;
};
const statusLabel = (p: Pick<ProjectInfo, "status" | "archivedAt">) =>
  p.archivedAt ? "Archivé" : projectStatusLabels[p.status];

/**
 * Export comptable Excel : GET /api/export/finance?projet=<id> | ?mois=AAAA-MM | ?annee=AAAA.
 * Réservé aux associés connectés ; chaque export est journalisé (périmètre seulement, sans montant).
 */
export async function GET(request: NextRequest) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return plain(401, "Connexion requise.");
  if (user.role !== "associe") return plain(403, "Accès réservé aux associés.");
  const parsed = parseExportScope(request.nextUrl.searchParams);
  if (!parsed.ok) return plain(400, parsed.error);
  const scope = parsed.scope;

  const db = getDb();
  let project: (ProjectInfo & { id: string }) | null = null;
  if (scope.kind === "projet") {
    project = await db.project.findUnique({ where: { id: scope.projectId }, ...projectSelect });
    if (!project) return plain(404, "Projet introuvable.");
  }
  const range = scopeRange(scope);
  const ofProject = scope.kind === "projet" ? { projectId: scope.projectId } : {};
  const between = range ? { gte: range[0], lte: range[1] } : null;

  // Pré-filtre large en base (une des dates dans la période), puis rattachement exact par date de référence.
  const [costs, billing, payments] = await Promise.all([
    db.costItem.findMany({
      where: {
        archivedAt: null,
        ...ofProject,
        ...(between
          ? {
              OR: [
                { invoiceDate: between },
                { paidAt: between },
                { dueDate: between },
                { committedAt: between },
              ],
            }
          : {}),
      },
      include: { project: projectSelect, workPackage: lotSelect },
    }),
    db.billingMilestone.findMany({
      where: {
        archivedAt: null,
        ...ofProject,
        ...(between ? { OR: [{ invoicedAt: between }, { plannedDate: between }] } : {}),
      },
      include: {
        project: projectSelect,
        workPackage: lotSelect,
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    db.paymentRecord.findMany({
      where: { deletedAt: null, ...ofProject, ...(between ? { receivedAt: between } : {}) },
      include: {
        project: projectSelect,
        billingMilestone: { select: { label: true, workPackage: lotSelect } },
      },
    }),
  ]);
  const costsIn = costs.filter((c) => inRange(costDate(c), range));
  const billingIn = billing.filter((b) => inRange(billingDate(b), range));
  const paymentsIn = payments.filter((p) => inRange(p.receivedAt, range));

  // Synthèse : reprise des calculs de la finance (summarize) via projectFinance / projectsOverview.
  let synthesis: SynthesisRow[] = [];
  let timeValued = false;
  if (project) {
    const f = await projectFinance(project.id);
    if (!f) return plain(404, "Projet introuvable.");
    const base = {
      project: project.name,
      client: project.client?.name ?? null,
      status: statusLabel(project),
    };
    synthesis = [
      { ...base, lot: null, summary: f.summary, minutes: f.minutes },
      ...f.byLot.map((l) => ({ ...base, lot: l.name, summary: l.summary, minutes: null })),
    ];
    timeValued = f.timeValued;
  } else {
    const touched = new Map<string, ProjectInfo>();
    for (const r of [...costsIn, ...billingIn, ...paymentsIn]) touched.set(r.projectId, r.project);
    if (touched.size) {
      // Une seule synthèse groupée des projets touchés (archivés compris) : nombre fixe de requêtes.
      const overview = new Map((await projectsOverview([...touched.keys()])).map((o) => [o.id, o]));
      synthesis = [...touched]
        .flatMap(([id, p]): SynthesisRow[] => {
          const o = overview.get(id);
          if (!o) return [];
          return [
            {
              project: p.name,
              client: p.client?.name ?? null,
              lot: null,
              status: statusLabel(p),
              summary: o.summary,
              minutes: o.minutes,
            },
          ];
        })
        .sort((a, b) => a.project.localeCompare(b.project, "fr"));
      timeValued = synthesis.some((r) => r.summary.timeCostLogged != null);
    }
  }

  const now = new Date();
  const label = scopeLabel(scope, project?.name);
  const bytes = await writeWorkbook(
    [
      synthesisSheet(synthesis, timeValued),
      costSheet(costsIn, range),
      billingSheet(billingIn, range, todayDate(now)),
      paymentSheet(paymentsIn, range),
      notesSheet({ scopeLabel: label, generatedAt: now, periodic: !!range, timeValued }),
    ],
    now,
  );

  // Lecture seule : pas de projectId, pour ne pas remplir le journal du projet (100 dernières
  // modifications) à chaque téléchargement. Le projet exporté reste identifié par targetId.
  await recordAudit({
    action: "finance.export",
    actorId: user.id,
    targetType: "finance_export",
    targetId: scopeValue(scope),
    after: {
      scope: scope.kind,
      value: scopeValue(scope),
      costRows: costsIn.length,
      billingRows: billingIn.length,
      paymentRows: paymentsIn.length,
    },
    userAgent: request.headers.get("user-agent"),
  });

  return new Response(bytes, {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${exportFileName(scope, project?.name)}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
