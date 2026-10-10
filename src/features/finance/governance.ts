import "server-only";
import type { DecisionKind, Prisma, VoteChoice } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { notify } from "@/features/notifications/service";
import { tally, type GovernanceRules } from "@/features/finance/calc";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

export async function getGovernance() {
  return getDb().governanceSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export type GovernanceInput = GovernanceRules & { requiredApprovals: number; blocking: boolean };

export async function saveGovernance(input: GovernanceInput, actor: Actor): Promise<ServiceResult<null>> {
  const associates = await getDb().user.count({ where: { role: "associe" } });
  if (input.requiredApprovals < 1 || input.requiredApprovals > Math.max(1, associates))
    return failed(`Le nombre d'avis requis doit être entre 1 et ${Math.max(1, associates)}.`);
  const before = await getGovernance();
  const changes = diff(before, input);
  if (!changes.changed) return done(null);
  await getDb().governanceSetting.update({ where: { id: "default" }, data: input });
  await recordAudit({
    action: "governance.rules_updated",
    actorId: actor.id,
    targetType: "governance",
    ...changes,
  });
  return done(null);
}

export type DecisionInput = {
  projectId: string;
  kind: DecisionKind;
  title: string;
  explanation: string;
  consequences: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

/** Crée une demande de décision et prévient les autres associés (in-app + e-mail). */
export async function createDecision(input: DecisionInput, actor: Actor, tx?: Prisma.TransactionClient) {
  const db = tx ?? getDb();
  const rules = await getGovernance();
  const decision = await db.decisionRequest.create({
    data: {
      ...input,
      requiredApprovals: rules.requiredApprovals,
      blocking: rules.blocking,
      createdById: actor.id,
    },
  });
  return decision;
}

export async function announceDecision(decisionId: string, actor: Actor) {
  const db = getDb();
  const d = await db.decisionRequest.findUniqueOrThrow({
    where: { id: decisionId },
    include: { project: { select: { name: true } } },
  });
  await recordAudit({
    action: "governance.decision_requested",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "decision",
    targetId: d.id,
    after: { title: d.title, kind: d.kind },
  });
  const others = await db.user.findMany({
    where: { role: "associe", id: { not: actor.id } },
    select: { id: true },
  });
  for (const u of others)
    await notify({
      userId: u.id,
      kind: "action",
      title: `Décision requise : ${d.title}`,
      body: `${d.project.name} — ${d.explanation.slice(0, 200)}`,
      href: `/gouvernance/${d.id}`,
      projectId: d.projectId,
      dedupeKey: `decision:${d.id}`,
      email: true,
    });
}

export async function listDecisions() {
  return getDb().decisionRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      votes: true,
    },
    take: 200,
  });
}

export async function getDecision(id: string) {
  return getDb().decisionRequest.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      votes: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      budgetRevision: true,
    },
  });
}

/**
 * Enregistre un avis. Le dépouillement applique ou refuse le changement lié
 * (révision de budget, nouvelle date de fin) dès que l'issue est certaine.
 */
export async function vote(
  decisionId: string,
  choice: VoteChoice,
  comment: string | null,
  actor: Actor,
): Promise<ServiceResult<{ status: string }>> {
  const db = getDb();
  const d = await db.decisionRequest.findUnique({
    where: { id: decisionId },
    include: { votes: true, budgetRevision: true },
  });
  if (!d) return failed("Décision introuvable.");
  if (d.status !== "OUVERTE") return failed("Cette décision est déjà close.");
  await db.decisionVote.upsert({
    where: { decisionId_userId: { decisionId, userId: actor.id } },
    create: { decisionId, userId: actor.id, choice, comment },
    update: { choice, comment },
  });
  await recordAudit({
    action: "governance.vote",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "decision",
    targetId: decisionId,
    after: { choice },
    reason: comment ?? undefined,
  });
  const votes = await db.decisionVote.findMany({ where: { decisionId } });
  const eligible = await db.user.count({ where: { role: "associe" } });
  const result = tally(votes, d.requiredApprovals, eligible);
  if (result.status === "OUVERTE") return done({ status: "OUVERTE" });

  await db.$transaction(async (tx) => {
    await tx.decisionRequest.update({
      where: { id: decisionId },
      data: { status: result.status, decidedAt: new Date() },
    });
    if (d.budgetRevision)
      await tx.budgetRevision.update({
        where: { id: d.budgetRevision.id },
        data: { status: result.status === "APPROUVEE" ? "APPLIQUEE" : d.blocking ? "REFUSEE" : "APPLIQUEE" },
      });
    const after = (d.after ?? {}) as { plannedEndDate?: string };
    if (d.kind === "PLANNING" && result.status === "APPROUVEE" && d.blocking && after.plannedEndDate)
      await tx.project.update({
        where: { id: d.projectId },
        data: { plannedEndDate: new Date(after.plannedEndDate) },
      });
  });
  await recordAudit({
    action: "governance.decided",
    actorId: null,
    projectId: d.projectId,
    targetType: "decision",
    targetId: decisionId,
    after: { status: result.status, pour: result.pour, contre: result.contre, abstention: result.abstention },
  });
  await notify({
    userId: d.createdById,
    kind: "action",
    title: `Décision ${result.status === "APPROUVEE" ? "approuvée" : "refusée"} : ${d.title}`,
    href: `/gouvernance/${decisionId}`,
    projectId: d.projectId,
    dedupeKey: `decision-close:${decisionId}`,
  });
  return done({ status: result.status });
}

export async function cancelDecision(decisionId: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const d = await db.decisionRequest.findUnique({
    where: { id: decisionId },
    include: { budgetRevision: true },
  });
  if (!d || d.status !== "OUVERTE") return failed("Décision introuvable ou close.");
  if (d.createdById !== actor.id) return failed("Seul l'auteur peut retirer sa demande.");
  await db.$transaction(async (tx) => {
    await tx.decisionRequest.update({
      where: { id: decisionId },
      data: { status: "ANNULEE", decidedAt: new Date() },
    });
    if (d.budgetRevision?.status === "EN_ATTENTE")
      await tx.budgetRevision.update({ where: { id: d.budgetRevision.id }, data: { status: "REFUSEE" } });
  });
  await recordAudit({
    action: "governance.decision_cancelled",
    actorId: actor.id,
    projectId: d.projectId,
    targetType: "decision",
    targetId: decisionId,
  });
  return done(null);
}
