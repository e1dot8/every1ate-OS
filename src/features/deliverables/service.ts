import "server-only";
import { createHash } from "node:crypto";
import type { DeliverableFormat, DeliverableStage, Prisma } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import { zonedToUtc } from "@/features/calendar/rules";
import { emitEvent, type AppEvent } from "@/features/events/emit";
import { notify } from "@/features/notifications/service";
import type { ServiceResult } from "@/features/projects/service";
import {
  advanceOnCheck,
  blockReasonIssue,
  endOfWeek,
  isHttpsUrl,
  isWorkStage,
  stageIndex,
  stageLabels,
  startOfMonth,
} from "@/features/deliverables/rules";
import { templateItems } from "@/features/deliverables/templates";

type Actor = { id: string; name: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

const userSelect = { id: true, name: true } as const;
const ARCHIVED = "Livrable introuvable ou archivé.";

// ─── Lectures ───────────────────────────────────────────────────────────────

const listInclude = {
  project: { select: { id: true, name: true } },
  owner: { select: userSelect },
  workPackage: { select: { id: true, name: true } },
  checkItems: { select: { stage: true, doneAt: true } },
} satisfies Prisma.DeliverableInclude;

export type DeliverableRow = Prisma.DeliverableGetPayload<{ include: typeof listInclude }>;

export type DeliverableFilter = {
  projectId?: string;
  ownerId?: string;
  format?: DeliverableFormat;
  /** Échéance passée, pas encore livré. */
  late?: boolean;
  /** À livrer cette semaine (d'aujourd'hui à dimanche). */
  week?: boolean;
  blocked?: boolean;
  /** Livrés depuis le 1er du mois. */
  deliveredMonth?: boolean;
};

/** Début du mois en cours à Paris, en instant UTC. */
function monthStartInstant(today: Date) {
  return zonedToUtc(`${startOfMonth(today).toISOString().slice(0, 10)}T00:00`)!;
}

function scopeWhere(filter: DeliverableFilter): Prisma.DeliverableWhereInput[] {
  const and: Prisma.DeliverableWhereInput[] = [{ archivedAt: null, project: { archivedAt: null } }];
  if (filter.projectId) and.push({ projectId: filter.projectId });
  if (filter.ownerId) and.push({ ownerId: filter.ownerId });
  if (filter.format) and.push({ format: filter.format });
  return and;
}

const lateWhere = (today: Date): Prisma.DeliverableWhereInput => ({
  stage: { not: "LIVRE" },
  dueDate: { lt: today },
});
const weekWhere = (today: Date): Prisma.DeliverableWhereInput => ({
  stage: { not: "LIVRE" },
  dueDate: { gte: today, lte: endOfWeek(today) },
});
const blockedWhere: Prisma.DeliverableWhereInput = { stage: { not: "LIVRE" }, blockedReason: { not: null } };
const deliveredMonthWhere = (today: Date): Prisma.DeliverableWhereInput => ({
  stage: "LIVRE",
  deliveredAt: { gte: monthStartInstant(today) },
});

/** Base des livrables : en cours, plus les livrés récents (30 jours) ou dont la publication est à venir. */
export async function listDeliverables(filter: DeliverableFilter, today = todayDate(), now = new Date()) {
  const and = scopeWhere(filter);
  if (filter.late) and.push(lateWhere(today));
  if (filter.week) and.push(weekWhere(today));
  if (filter.blocked) and.push(blockedWhere);
  if (filter.deliveredMonth) and.push(deliveredMonthWhere(today));
  else
    and.push({
      OR: [
        { stage: { not: "LIVRE" } },
        { deliveredAt: { gte: addDays(now, -30) } },
        { publishDate: { gte: today } },
      ],
    });
  return getDb().deliverable.findMany({
    where: { AND: and },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }, { createdAt: "asc" }],
    include: listInclude,
  });
}

/** Bandeau résumé (dans le périmètre projet / responsable / format choisi). */
export async function deliverableSummary(filter: DeliverableFilter, today = todayDate()) {
  const db = getDb();
  const and = scopeWhere(filter);
  const count = (extra: Prisma.DeliverableWhereInput) =>
    db.deliverable.count({ where: { AND: [...and, extra] } });
  const [late, week, blocked, deliveredMonth] = await Promise.all([
    count(lateWhere(today)),
    count(weekWhere(today)),
    count(blockedWhere),
    count(deliveredMonthWhere(today)),
  ]);
  return { late, week, blocked, deliveredMonth };
}

export async function getDeliverable(id: string) {
  return getDb().deliverable.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, archivedAt: true } },
      workPackage: { select: { id: true, name: true } },
      owner: { select: userSelect },
      checkItems: {
        orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        include: { assignee: { select: userSelect }, doneBy: { select: userSelect } },
      },
    },
  });
}

export type DeliverableDetail = NonNullable<Awaited<ReturnType<typeof getDeliverable>>>;

/** Historique lisible du livrable (journal d'audit). */
export async function deliverableActivity(id: string) {
  const db = getDb();
  const events = await db.auditEvent.findMany({
    where: { targetType: "deliverable", targetId: id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: userSelect })
    : [];
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    before: e.before,
    after: e.after,
    createdAt: e.createdAt,
    actorName: e.actorId ? (names.get(e.actorId) ?? "Un associé") : "Le QG",
  }));
}

/** Livrables d'un projet (onglet du projet), y compris livrés. */
export async function projectDeliverables(projectId: string) {
  return getDb().deliverable.findMany({
    where: { projectId, archivedAt: null },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }, { createdAt: "asc" }],
    include: listInclude,
  });
}

/** Mes livrables : en retard ou dus sous 7 jours, et points de checklist qui me sont confiés sous 2 jours. */
export async function myUpcomingDeliverables(userId: string, today = todayDate()) {
  const db = getDb();
  const live = { archivedAt: null, stage: { not: "LIVRE" as const }, project: { archivedAt: null } };
  const [deliverables, items] = await Promise.all([
    db.deliverable.findMany({
      where: { ...live, ownerId: userId, dueDate: { lte: addDays(today, 7) } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: listInclude,
      take: 12,
    }),
    db.deliverableCheckItem.findMany({
      where: { assigneeId: userId, doneAt: null, dueDate: { lte: addDays(today, 2) }, deliverable: live },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      include: {
        deliverable: {
          select: { id: true, title: true, format: true, stage: true, project: { select: { name: true } } },
        },
      },
      take: 12,
    }),
  ]);
  return { deliverables, items };
}

/** Listes des formulaires : projets ouverts, lots, associés. */
export async function deliverableFormOptions() {
  const db = getDb();
  const [projects, lots, associates] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.workPackage.findMany({
      where: { archivedAt: null, project: { archivedAt: null } },
      orderBy: [{ projectId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, projectId: true },
    }),
    db.user.findMany({ where: { role: "associe" }, orderBy: { name: "asc" }, select: userSelect }),
  ]);
  return { projects, lots, associates };
}

// ─── Livrable ───────────────────────────────────────────────────────────────

export type DeliverableInput = {
  projectId: string;
  workPackageId: string | null;
  title: string;
  format: DeliverableFormat;
  channel: string | null;
  ownerId: string | null;
  dueDate: Date | null;
  publishDate: Date | null;
  link: string | null;
  notes: string | null;
};

async function checkInput(input: DeliverableInput): Promise<string | null> {
  const db = getDb();
  if (!input.title.trim()) return "Titre requis.";
  if (!(await db.project.findFirst({ where: { id: input.projectId, archivedAt: null } })))
    return "Projet introuvable ou archivé.";
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({
      where: { id: input.workPackageId, projectId: input.projectId, archivedAt: null },
    }))
  )
    return "Ce lot n'appartient pas au projet choisi.";
  if (input.ownerId && !(await db.user.findFirst({ where: { id: input.ownerId, role: "associe" } })))
    return "Responsable invalide.";
  if (input.link && !isHttpsUrl(input.link)) return "Le lien doit commencer par https://";
  return null;
}

const clean = (input: DeliverableInput) => ({
  ...input,
  title: input.title.trim(),
  channel: input.channel?.trim() || null,
  link: input.link?.trim() || null,
  notes: input.notes?.trim() || null,
});

export async function createDeliverable(
  input: DeliverableInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string; projectId: string }>> {
  const error = await checkInput(input);
  if (error) return failed(error);
  const db = getDb();
  const data = clean(input);
  const position = await db.deliverable.count({ where: { projectId: data.projectId } });
  const created = await db.deliverable.create({
    data: {
      ...data,
      position,
      createdById: actor.id,
      checkItems: { create: templateItems(data.format) },
    },
  });
  await recordAudit({
    action: "deliverable.created",
    actorId: actor.id,
    projectId: created.projectId,
    targetType: "deliverable",
    targetId: created.id,
    after: { title: created.title, format: created.format, ownerId: created.ownerId },
  });
  return done({ id: created.id, projectId: created.projectId });
}

export async function updateDeliverable(
  id: string,
  input: DeliverableInput,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string; previousProjectId: string }>> {
  const db = getDb();
  const before = await db.deliverable.findUnique({ where: { id } });
  if (!before || before.archivedAt) return failed(ARCHIVED);
  const error = await checkInput(input);
  if (error) return failed(error);
  const data = clean(input);
  const changes = diff(before, data);
  if (changes.changed) {
    await db.deliverable.update({ where: { id }, data });
    await recordAudit({
      action: "deliverable.updated",
      actorId: actor.id,
      projectId: data.projectId,
      targetType: "deliverable",
      targetId: id,
      before: changes.before,
      after: changes.after,
    });
  }
  return done({ projectId: data.projectId, previousProjectId: before.projectId });
}

export async function saveDeliverableNotes(
  id: string,
  notes: string | null,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const before = await db.deliverable.findUnique({ where: { id } });
  if (!before || before.archivedAt) return failed(ARCHIVED);
  const value = notes?.trim() || null;
  if (value !== before.notes) {
    await db.deliverable.update({ where: { id }, data: { notes: value } });
    await recordAudit({
      action: "deliverable.notes_updated",
      actorId: actor.id,
      projectId: before.projectId,
      targetType: "deliverable",
      targetId: id,
    });
  }
  return done({ projectId: before.projectId });
}

export async function setDeliverableArchived(
  id: string,
  archived: boolean,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const before = await db.deliverable.findUnique({ where: { id } });
  if (!before) return failed("Livrable introuvable.");
  if (!!before.archivedAt === archived) return done({ projectId: before.projectId });
  await db.deliverable.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await recordAudit({
    action: archived ? "deliverable.archived" : "deliverable.restored",
    actorId: actor.id,
    projectId: before.projectId,
    targetType: "deliverable",
    targetId: id,
  });
  return done({ projectId: before.projectId });
}

// ─── Étapes et automatisations ──────────────────────────────────────────────

type Header = { id: string; title: string; projectId: string; project: { name: string } };

/** Événement d'arrivée dans une étape : « passe en Montage » ou « est livré ». */
function stageEvent(d: Header, stage: DeliverableStage, actor: Actor): AppEvent {
  const href = `/livrables/${d.id}`;
  if (stage === "LIVRE")
    return {
      kind: "livrable.livre",
      actorId: actor.id,
      title: `« ${d.title} » est livré`,
      body: d.project.name,
      href,
      projectId: d.projectId,
      dedupeKey: `livrable-livre:${d.id}`,
    };
  return {
    kind: "livrable.etape",
    actorId: actor.id,
    title: `« ${d.title} » passe en ${stageLabels[stage]}`,
    body: d.project.name,
    href,
    projectId: d.projectId,
    dedupeKey: `livrable-etape:${d.id}:${stage}`,
  };
}

/** Changement d'étape manuel (avancer ou reculer). Avancer prévient l'équipe. */
export async function changeDeliverableStage(
  id: string,
  to: DeliverableStage,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const d = await db.deliverable.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });
  if (!d || d.archivedAt) return failed(ARCHIVED);
  if (d.stage === to) return done({ projectId: d.projectId });
  const moved = await db.deliverable.updateMany({
    where: { id, stage: d.stage },
    data: {
      stage: to,
      deliveredAt: to === "LIVRE" ? new Date() : null,
      // Livré : plus rien ne bloque.
      ...(to === "LIVRE" ? { blockedReason: null } : {}),
    },
  });
  if (!moved.count) return failed("Le livrable vient d'être modifié : rechargez la page.");
  await recordAudit({
    action: "deliverable.stage_changed",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "deliverable",
    targetId: id,
    before: { stage: d.stage },
    after: { stage: to },
  });
  if (stageIndex(to) > stageIndex(d.stage)) await emitEvent(stageEvent(d, to, actor));
  return done({ projectId: d.projectId });
}

const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);

export async function blockDeliverable(
  id: string,
  reason: string,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const issue = blockReasonIssue(reason);
  if (issue) return failed(issue);
  const db = getDb();
  const d = await db.deliverable.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });
  if (!d || d.archivedAt) return failed(ARCHIVED);
  if (d.stage === "LIVRE") return failed("Un livrable livré ne peut pas être bloqué.");
  const motive = reason.trim();
  if (d.blockedReason === motive) return done({ projectId: d.projectId });
  await db.deliverable.update({ where: { id }, data: { blockedReason: motive } });
  await recordAudit({
    action: "deliverable.blocked",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "deliverable",
    targetId: id,
    before: { blockedReason: d.blockedReason },
    after: { blockedReason: motive },
    reason: motive,
  });
  await emitEvent({
    kind: "livrable.bloque",
    actorId: actor.id,
    title: `« ${d.title} » est bloqué`,
    body: motive,
    href: `/livrables/${id}`,
    projectId: d.projectId,
    // Un même blocage (même motif, même jour) n'est annoncé qu'une fois.
    dedupeKey: `livrable-bloque:${id}:${todayDate().toISOString().slice(0, 10)}:${shortHash(motive)}`,
    urgent: true,
  });
  return done({ projectId: d.projectId });
}

export async function unblockDeliverable(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const d = await db.deliverable.findUnique({ where: { id } });
  if (!d || d.archivedAt) return failed(ARCHIVED);
  if (!d.blockedReason) return done({ projectId: d.projectId });
  await db.deliverable.update({ where: { id }, data: { blockedReason: null } });
  await recordAudit({
    action: "deliverable.unblocked",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "deliverable",
    targetId: id,
    before: { blockedReason: d.blockedReason },
    after: { blockedReason: null },
  });
  return done({ projectId: d.projectId });
}

// ─── Checklist ──────────────────────────────────────────────────────────────

type ItemResult = ServiceResult<{ deliverableId: string; projectId: string }>;

/**
 * Coche ou décoche un point. Si c'était le dernier point de l'étape courante, le livrable passe
 * automatiquement à l'étape suivante (et, depuis Livraison, devient « Livré »).
 * Le livrable est verrouillé pendant l'opération : deux coches simultanées ne ratent pas le passage.
 */
export async function toggleCheckItem(
  itemId: string,
  checked: boolean,
  actor: Actor,
): Promise<ServiceResult<{ deliverableId: string; projectId: string; advancedTo: DeliverableStage | null }>> {
  const db = getDb();
  const outcome = await db.$transaction(async (tx) => {
    const ref = await tx.deliverableCheckItem.findUnique({
      where: { id: itemId },
      select: { deliverableId: true },
    });
    if (!ref) return { error: "Point introuvable." } as const;
    await tx.$queryRaw`SELECT "id" FROM "deliverable" WHERE "id" = ${ref.deliverableId} FOR UPDATE`;
    const d = await tx.deliverable.findUnique({
      where: { id: ref.deliverableId },
      include: { checkItems: true, project: { select: { name: true } } },
    });
    if (!d || d.archivedAt) return { error: ARCHIVED } as const;
    const item = d.checkItems.find((i) => i.id === itemId)!;
    if (!!item.doneAt === checked) return { d, item, changed: false, target: null } as const;
    const now = new Date();
    await tx.deliverableCheckItem.update({
      where: { id: itemId },
      data: checked ? { doneAt: now, doneById: actor.id } : { doneAt: null, doneById: null },
    });
    const items = d.checkItems.map((i) => (i.id === itemId ? { ...i, doneAt: checked ? now : null } : i));
    const target = advanceOnCheck({ items, stage: d.stage, itemStage: item.stage, done: checked });
    if (target)
      await tx.deliverable.update({
        where: { id: d.id },
        data: {
          stage: target,
          ...(target === "LIVRE" ? { deliveredAt: now, blockedReason: null } : {}),
        },
      });
    return { d, item, changed: true, target } as const;
  });
  if ("error" in outcome) return failed(outcome.error ?? "Point introuvable.");
  const { d, item, changed, target } = outcome;
  if (changed) {
    await recordAudit({
      action: checked ? "deliverable.item_checked" : "deliverable.item_unchecked",
      actorId: actor.id,
      projectId: d.projectId,
      targetType: "deliverable",
      targetId: d.id,
      after: { itemId, label: item.label, stage: item.stage },
    });
    if (checked)
      await emitEvent({
        kind: "livrable.coche",
        actorId: actor.id,
        title: `${actor.name} a coché « ${item.label} »`,
        body: `${d.title} · ${d.project.name}`,
        href: `/livrables/${d.id}`,
        projectId: d.projectId,
        dedupeKey: `livrable-coche:${itemId}`,
      });
    if (target) {
      await recordAudit({
        action: "deliverable.stage_changed",
        actorId: actor.id,
        projectId: d.projectId,
        targetType: "deliverable",
        targetId: d.id,
        before: { stage: d.stage },
        after: { stage: target, auto: true },
      });
      await emitEvent(stageEvent(d, target, actor));
    }
  }
  return done({ deliverableId: d.id, projectId: d.projectId, advancedTo: changed ? target : null });
}

async function loadItem(itemId: string) {
  return getDb().deliverableCheckItem.findUnique({
    where: { id: itemId },
    include: { deliverable: { select: { id: true, title: true, projectId: true, archivedAt: true } } },
  });
}

export async function addCheckItem(
  deliverableId: string,
  stage: DeliverableStage,
  label: string,
  actor: Actor,
): Promise<ItemResult> {
  const db = getDb();
  if (!isWorkStage(stage)) return failed("Étape invalide.");
  const text = label.trim();
  if (!text) return failed("Libellé requis.");
  const d = await db.deliverable.findUnique({ where: { id: deliverableId } });
  if (!d || d.archivedAt) return failed(ARCHIVED);
  const last = await db.deliverableCheckItem.aggregate({
    where: { deliverableId, stage },
    _max: { position: true },
  });
  const item = await db.deliverableCheckItem.create({
    data: { deliverableId, stage, label: text, position: (last._max.position ?? -1) + 1 },
  });
  await recordAudit({
    action: "deliverable.item_added",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "deliverable",
    targetId: deliverableId,
    after: { itemId: item.id, label: text, stage },
  });
  return done({ deliverableId, projectId: d.projectId });
}

export async function renameCheckItem(itemId: string, label: string, actor: Actor): Promise<ItemResult> {
  const item = await loadItem(itemId);
  if (!item || item.deliverable.archivedAt) return failed("Point introuvable.");
  const text = label.trim();
  if (!text) return failed("Libellé requis.");
  const ids = { deliverableId: item.deliverableId, projectId: item.deliverable.projectId };
  if (text === item.label) return done(ids);
  await getDb().deliverableCheckItem.update({ where: { id: itemId }, data: { label: text } });
  await recordAudit({
    action: "deliverable.item_renamed",
    actorId: actor.id,
    projectId: ids.projectId,
    targetType: "deliverable",
    targetId: ids.deliverableId,
    before: { label: item.label },
    after: { itemId, label: text },
  });
  return done(ids);
}

export async function deleteCheckItem(itemId: string, actor: Actor): Promise<ItemResult> {
  const item = await loadItem(itemId);
  if (!item || item.deliverable.archivedAt) return failed("Point introuvable.");
  await getDb().deliverableCheckItem.delete({ where: { id: itemId } });
  const ids = { deliverableId: item.deliverableId, projectId: item.deliverable.projectId };
  await recordAudit({
    action: "deliverable.item_deleted",
    actorId: actor.id,
    projectId: ids.projectId,
    targetType: "deliverable",
    targetId: ids.deliverableId,
    before: { itemId, label: item.label, stage: item.stage, done: !!item.doneAt },
    after: { label: item.label },
  });
  return done(ids);
}

/** Monte ou descend un point dans son étape (positions renumérotées 0..n). */
export async function moveCheckItem(itemId: string, direction: "up" | "down"): Promise<ItemResult> {
  const db = getDb();
  const item = await loadItem(itemId);
  if (!item || item.deliverable.archivedAt) return failed("Point introuvable.");
  const ids = { deliverableId: item.deliverableId, projectId: item.deliverable.projectId };
  const siblings = await db.deliverableCheckItem.findMany({
    where: { deliverableId: item.deliverableId, stage: item.stage },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = siblings.findIndex((s) => s.id === itemId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= siblings.length) return done(ids);
  [siblings[from], siblings[to]] = [siblings[to], siblings[from]];
  await db.$transaction(
    siblings.map((s, position) =>
      db.deliverableCheckItem.update({ where: { id: s.id }, data: { position } }),
    ),
  );
  return done(ids);
}

/** Confie un point à un associé, avec une échéance facultative ; l'associé est prévenu dans l'app. */
export async function assignCheckItem(
  itemId: string,
  assigneeId: string | null,
  dueDate: Date | null,
  actor: Actor,
): Promise<ItemResult> {
  const db = getDb();
  const item = await loadItem(itemId);
  if (!item || item.deliverable.archivedAt) return failed("Point introuvable.");
  const assignee = assigneeId
    ? await db.user.findFirst({ where: { id: assigneeId, role: "associe" }, select: userSelect })
    : null;
  if (assigneeId && !assignee) return failed("Associé invalide.");
  const ids = { deliverableId: item.deliverableId, projectId: item.deliverable.projectId };
  const changes = diff(item, { assigneeId, dueDate });
  if (!changes.changed) return done(ids);
  await db.deliverableCheckItem.update({ where: { id: itemId }, data: { assigneeId, dueDate } });
  await recordAudit({
    action: "deliverable.item_assigned",
    actorId: actor.id,
    projectId: ids.projectId,
    targetType: "deliverable",
    targetId: ids.deliverableId,
    before: changes.before,
    after: {
      itemId,
      label: item.label,
      assigneeName: assignee?.name ?? null,
      dueDate: dueDate?.toISOString() ?? null,
    },
  });
  if (assignee && assignee.id !== actor.id && assignee.id !== item.assigneeId)
    await notify({
      userId: assignee.id,
      kind: "assignation",
      title: `${actor.name} te confie « ${item.label} »`,
      body: item.deliverable.title,
      href: `/livrables/${ids.deliverableId}`,
      projectId: ids.projectId,
      dedupeKey: `livrable-assigne:${itemId}:${assignee.id}`,
    }).catch((error) => console.error("[livrables] notification d'assignation", error));
  return done(ids);
}
