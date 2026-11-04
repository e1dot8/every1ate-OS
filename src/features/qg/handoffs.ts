import "server-only";
import type { HandoffMode } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { emitEvent } from "@/features/events/emit";
import { changeOpportunityOwner, setNextAction } from "@/features/crm/service";
import { assignTask, type ServiceResult } from "@/features/projects/service";
import {
  PENDING_HANDOFF_ERROR,
  checkHandoffAnswer,
  checkHandoffProposal,
  handoffOwners,
  isUniqueViolation,
} from "@/features/qg/handoff-rules";

/**
 * Passations (V1.2) : une tâche ou un client proposé à un associé, qui ne change de main
 * qu'après son acceptation. Les changements de responsable passent par les services existants
 * (validation, journal) ; chaque étape notifie l'autre associé.
 */
type Actor = { id: string; name: string };
type Target = { taskId: string } | { opportunityId: string };

const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

const handoffInclude = {
  from: { select: { id: true, name: true } },
  to: { select: { id: true, name: true } },
  task: {
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      ownerId: true,
      archivedAt: true,
      projectId: true,
      project: { select: { name: true } },
    },
  },
  opportunity: {
    select: {
      id: true,
      title: true,
      ownerId: true,
      archivedAt: true,
      nextAction: true,
      nextActionDate: true,
      client: { select: { name: true } },
    },
  },
} as const;

async function loadTarget(target: Target) {
  const db = getDb();
  if ("taskId" in target) {
    const t = await db.task.findUnique({
      where: { id: target.taskId },
      select: { id: true, title: true, ownerId: true, status: true, archivedAt: true, projectId: true },
    });
    if (!t) return null;
    return {
      kind: "task" as const,
      id: t.id,
      title: t.title,
      ownerId: t.ownerId,
      projectId: t.projectId,
      open: !t.archivedAt && t.status !== "TERMINE" && t.status !== "ANNULE",
    };
  }
  const o = await db.opportunity.findUnique({
    where: { id: target.opportunityId },
    select: { id: true, title: true, ownerId: true, archivedAt: true },
  });
  if (!o) return null;
  return {
    kind: "opportunity" as const,
    id: o.id,
    title: o.title,
    ownerId: o.ownerId as string | null,
    projectId: null,
    open: !o.archivedAt,
  };
}

export async function proposeHandoff(
  input: { target: Target; mode: HandoffMode; toId: string | null; note: string | null },
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const object = await loadTarget(input.target);
  if (!object) return failed("Élément introuvable.");
  const note = input.note?.trim() || null;
  const check = checkHandoffProposal({
    mode: input.mode,
    actorId: actor.id,
    ownerId: object.ownerId,
    toId: input.toId,
    open: object.open,
    note,
  });
  if (!check.ok) return failed(check.error);
  const to = await db.user.findFirst({
    where: { id: check.data.toId, role: "associe" },
    select: { id: true, name: true },
  });
  if (!to) return failed("Associé introuvable.");
  let id: string;
  try {
    const created = await db.handoff.create({
      data: {
        ...(object.kind === "task" ? { taskId: object.id } : { opportunityId: object.id }),
        fromId: check.data.fromId,
        toId: to.id,
        mode: input.mode,
        note,
      },
    });
    id = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) return failed(PENDING_HANDOFF_ERROR);
    throw e;
  }
  await recordAudit({
    action: "handoff.proposed",
    actorId: actor.id,
    projectId: object.projectId,
    targetType: object.kind,
    targetId: object.id,
    after: { handoffId: id, mode: input.mode, fromId: check.data.fromId, toId: to.id },
    reason: note ?? undefined,
  });
  await emitEvent({
    kind: "passation.demandee",
    actorId: actor.id,
    recipients: [to.id],
    title:
      input.mode === "DONNER"
        ? `${actor.name} te propose ${object.kind === "task" ? "la tâche" : "le client"} « ${object.title} »`
        : `${actor.name} propose de reprendre « ${object.title} »`,
    body: note ?? undefined,
    href: "/#passations",
    projectId: object.projectId,
    taskId: object.kind === "task" ? object.id : null,
    dedupeKey: `passation-demandee:${id}`,
    channelPost: false,
  });
  return done({ id });
}

export async function acceptHandoff(
  id: string,
  input: { nextAction: string | null; nextActionDate: Date | null },
  actor: Actor,
): Promise<ServiceResult<{ href: string }>> {
  const db = getDb();
  const h = await db.handoff.findUnique({ where: { id }, include: handoffInclude });
  if (!h) return failed("Passation introuvable.");
  const check = checkHandoffAnswer(
    { status: h.status, fromId: h.fromId, toId: h.toId, isOpportunity: !!h.opportunityId },
    actor.id,
    { kind: "accepter", ...input },
  );
  if (!check.ok) return failed(check.error);
  const { expectedOwnerId, newOwnerId } = handoffOwners(h);
  const object = h.task ?? h.opportunity;
  if (!object) return failed("Élément introuvable.");
  const stillOpen = h.task
    ? !h.task.archivedAt && h.task.status !== "TERMINE" && h.task.status !== "ANNULE"
    : !h.opportunity!.archivedAt;
  if (!stillOpen || object.ownerId !== expectedOwnerId) {
    // L'objet a bougé entre-temps : la proposition n'a plus de sens, on la retire.
    await db.handoff.updateMany({
      where: { id, status: "EN_ATTENTE" },
      data: {
        status: "ANNULEE",
        answer: "Annulée : l'élément a changé entre-temps.",
        answeredAt: new Date(),
      },
    });
    return failed(
      stillOpen
        ? "Le responsable a changé entre-temps : la proposition est annulée."
        : "Cet élément est terminé : la proposition est annulée.",
    );
  }
  // Réservation de la réponse : un double clic ou deux onglets n'acceptent qu'une fois.
  const claimed = await db.handoff.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: { status: "ACCEPTEE", answeredAt: new Date() },
  });
  if (claimed.count === 0) return failed("Cette passation a déjà été traitée.");
  const release = () =>
    db.handoff.update({ where: { id }, data: { status: "EN_ATTENTE", answeredAt: null } });

  let href: string;
  if (h.task) {
    const moved = await assignTask(h.task.id, newOwnerId, actor, {
      expectedOwnerId,
      reason: h.note ? `Passation acceptée : ${h.note}` : "Passation acceptée",
      notifyOwner: false,
    });
    if (!moved.ok) {
      await release();
      return failed(moved.error);
    }
    if (h.note)
      // La note de contexte reste sur la tâche, signée par l'auteur de la proposition.
      await db.taskComment.create({
        data: { taskId: h.task.id, authorId: h.fromId, body: `Passation : ${h.note}` },
      });
    href = `/taches/${h.task.id}`;
  } else {
    const opp = h.opportunity!;
    const moved = await changeOpportunityOwner(opp.id, newOwnerId, actor, {
      expectedOwnerId,
      note: h.note,
    });
    if (!moved.ok) {
      await release();
      return failed(moved.error);
    }
    const next = await setNextAction(
      opp.id,
      { nextAction: input.nextAction?.trim() || null, nextActionDate: input.nextActionDate },
      actor,
    );
    if (!next.ok) return failed(next.error);
    href = `/crm/opportunites/${opp.id}`;
  }
  await recordAudit({
    action: "handoff.accepted",
    actorId: actor.id,
    projectId: h.task?.projectId ?? null,
    targetType: h.task ? "task" : "opportunity",
    targetId: object.id,
    before: { ownerId: expectedOwnerId },
    after: { handoffId: id, ownerId: newOwnerId },
  });
  await emitEvent({
    kind: "passation.repondue",
    actorId: actor.id,
    recipients: [h.fromId],
    title:
      h.mode === "DONNER"
        ? `${actor.name} a accepté « ${object.title} »`
        : `${actor.name} te cède « ${object.title} »`,
    href,
    projectId: h.task?.projectId ?? null,
    taskId: h.task?.id ?? null,
    dedupeKey: `passation-repondue:${id}`,
    channelPost: false,
  });
  return done({ href });
}

export async function refuseHandoff(
  id: string,
  answer: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const h = await db.handoff.findUnique({ where: { id }, include: handoffInclude });
  if (!h) return failed("Passation introuvable.");
  const check = checkHandoffAnswer(
    { status: h.status, fromId: h.fromId, toId: h.toId, isOpportunity: !!h.opportunityId },
    actor.id,
    { kind: "refuser", answer },
  );
  if (!check.ok) return failed(check.error);
  const text = answer!.trim();
  const updated = await db.handoff.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: { status: "REFUSEE", answer: text, answeredAt: new Date() },
  });
  if (updated.count === 0) return failed("Cette passation a déjà été traitée.");
  const object = h.task ?? h.opportunity;
  await recordAudit({
    action: "handoff.refused",
    actorId: actor.id,
    projectId: h.task?.projectId ?? null,
    targetType: h.task ? "task" : "opportunity",
    targetId: object?.id,
    after: { handoffId: id },
    reason: text,
  });
  await emitEvent({
    kind: "passation.repondue",
    actorId: actor.id,
    recipients: [h.fromId],
    title: `${actor.name} ne peut pas prendre « ${object?.title ?? "l'élément"} »`,
    body: text,
    href: h.task ? `/taches/${h.task.id}` : `/crm/opportunites/${h.opportunityId}`,
    projectId: h.task?.projectId ?? null,
    taskId: h.task?.id ?? null,
    dedupeKey: `passation-repondue:${id}`,
    channelPost: false,
  });
  return done(null);
}

export async function cancelHandoff(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const h = await db.handoff.findUnique({
    where: { id },
    select: { status: true, fromId: true, toId: true, opportunityId: true, taskId: true },
  });
  if (!h) return failed("Passation introuvable.");
  const check = checkHandoffAnswer(
    { status: h.status, fromId: h.fromId, toId: h.toId, isOpportunity: !!h.opportunityId },
    actor.id,
    { kind: "annuler" },
  );
  if (!check.ok) return failed(check.error);
  const updated = await db.handoff.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: { status: "ANNULEE", answeredAt: new Date() },
  });
  if (updated.count === 0) return failed("Cette passation a déjà été traitée.");
  await recordAudit({
    action: "handoff.cancelled",
    actorId: actor.id,
    targetType: h.taskId ? "task" : "opportunity",
    targetId: h.taskId ?? h.opportunityId ?? undefined,
    after: { handoffId: id },
  });
  return done(null);
}

/** Passations en attente reçues et envoyées par un associé (QG). */
export async function listPendingHandoffs(userId: string) {
  const rows = await getDb().handoff.findMany({
    where: { status: "EN_ATTENTE", OR: [{ toId: userId }, { fromId: userId }] },
    orderBy: { createdAt: "asc" },
    include: handoffInclude,
  });
  return {
    received: rows.filter((h) => h.toId === userId),
    sent: rows.filter((h) => h.fromId === userId),
  };
}

export type PendingHandoff = Awaited<ReturnType<typeof listPendingHandoffs>>["received"][number];

/** Passation en attente sur une tâche ou une opportunité (au plus une). */
export async function pendingHandoffFor(target: Target) {
  return getDb().handoff.findFirst({
    where: { status: "EN_ATTENTE", ...target },
    include: { from: { select: { id: true, name: true } }, to: { select: { id: true, name: true } } },
  });
}
