import "server-only";
import type { FileKind, Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { parseDriveUrl } from "@/features/calendar/rules";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

export type FileTarget = {
  projectId?: string | null;
  workPackageId?: string | null;
  taskId?: string | null;
  clientId?: string | null;
};

const include = {
  addedBy: { select: { name: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  client: { select: { id: true, name: true } },
  workPackage: { select: { id: true, name: true } },
} as const;

export async function listFiles(target: FileTarget) {
  const where: Prisma.FileReferenceWhereInput = { archivedAt: null };
  if (target.taskId) where.taskId = target.taskId;
  else if (target.workPackageId) where.workPackageId = target.workPackageId;
  else if (target.projectId) where.projectId = target.projectId;
  else if (target.clientId) where.clientId = target.clientId;
  return getDb().fileReference.findMany({ where, orderBy: { createdAt: "desc" }, include });
}

export async function listAllFiles(q?: string) {
  return getDb().fileReference.findMany({
    where: { archivedAt: null, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include,
  });
}

export type FileInput = FileTarget & {
  title: string;
  url: string;
  kind: FileKind | null;
  ownerLabel: string | null;
  documentDate: Date | null;
};

/** Ajoute une référence (le fichier reste dans Drive). Les liens non https sont refusés. */
export async function addFile(input: FileInput, actor: Actor): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    return failed("Lien invalide.");
  }
  if (url.protocol !== "https:") return failed("Seuls les liens https sont acceptés.");
  const drive = parseDriveUrl(url.toString());
  if (!input.projectId && !input.taskId && !input.clientId && !input.workPackageId)
    return failed("Rattachez le document à un projet, une tâche ou un client.");
  if (input.taskId) {
    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: { projectId: true, workPackageId: true },
    });
    if (!task) return failed("Tâche introuvable.");
    input.projectId = task.projectId;
    input.workPackageId = input.workPackageId ?? task.workPackageId;
  }
  if (drive) {
    const existing = await db.fileReference.findFirst({
      where: {
        archivedAt: null,
        externalId: drive.externalId,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        clientId: input.clientId ?? null,
      },
    });
    if (existing) return failed(`Ce document est déjà référencé ici (« ${existing.title} »).`);
  }
  const file = await db.fileReference.create({
    data: {
      title: input.title,
      url: url.toString(),
      kind: input.kind ?? drive?.kind ?? "AUTRE",
      provider: drive ? "google_drive" : "lien",
      externalId: drive?.externalId ?? null,
      ownerLabel: input.ownerLabel,
      documentDate: input.documentDate,
      projectId: input.projectId ?? null,
      workPackageId: input.workPackageId ?? null,
      taskId: input.taskId ?? null,
      clientId: input.clientId ?? null,
      addedById: actor.id,
    },
  });
  await recordAudit({
    action: "file.referenced",
    actorId: actor.id,
    projectId: file.projectId,
    targetType: "file",
    targetId: file.id,
    after: { title: file.title, provider: file.provider },
  });
  return done({ id: file.id });
}

/**
 * Vérifie qu'un lien répond encore (lien supprimé ou expiré, §12.1). Sans connexion OAuth,
 * l'accès réel est contrôlé par Google à l'ouverture ; une page de connexion est considérée valide.
 */
export async function checkFile(
  id: string,
  actor: Actor,
  fetcher: typeof fetch = fetch,
): Promise<ServiceResult<{ status: string }>> {
  const db = getDb();
  const file = await db.fileReference.findUnique({ where: { id } });
  if (!file || file.archivedAt) return failed("Document introuvable.");
  // Pas de requête serveur vers des domaines arbitraires (SSRF) : Google Drive/Docs uniquement.
  if (file.provider !== "google_drive" || !parseDriveUrl(file.url))
    return failed("La vérification n'est disponible que pour les liens Google Drive.");
  let status: "OK" | "INTROUVABLE" | "ERREUR";
  let detail: string;
  try {
    const res = await fetcher(file.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Every1ate-OS link check" },
    });
    if (res.status === 404 || res.status === 410)
      [status, detail] = ["INTROUVABLE", `Le lien ne répond plus (${res.status}).`];
    else if (res.status >= 200 && res.status < 400)
      [status, detail] = [
        "OK",
        res.status >= 300 ? "Accessible (connexion Google requise selon les droits)." : "Accessible.",
      ];
    else [status, detail] = ["ERREUR", `Réponse inattendue (${res.status}). Réessayez plus tard.`];
  } catch {
    [status, detail] = ["ERREUR", "Vérification impossible (réseau ou délai dépassé). Réessayez."];
  }
  await db.fileReference.update({
    where: { id },
    data: { status, statusDetail: detail, lastCheckedAt: new Date() },
  });
  await recordAudit({
    action: "file.checked",
    actorId: actor.id,
    projectId: file.projectId,
    targetType: "file",
    targetId: id,
    after: { status },
  });
  return done({ status });
}

export async function archiveFile(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string | null; taskId: string | null; clientId: string | null }>> {
  const db = getDb();
  const file = await db.fileReference.findUnique({ where: { id } });
  if (!file || file.archivedAt) return failed("Document introuvable.");
  await db.fileReference.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "file.archived",
    actorId: actor.id,
    projectId: file.projectId,
    targetType: "file",
    targetId: id,
    before: { title: file.title },
  });
  return done({ projectId: file.projectId, taskId: file.taskId, clientId: file.clientId });
}
