import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import type { ServiceResult } from "@/features/projects/service";
import { levelInfo, levelUp, taskCompletionXp } from "./rules";

type Actor = { id: string };

/** Conflit sur la clé d'idempotence : l'événement a déjà été compté. */
const isDuplicate = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";

export type XpAward = {
  amount: number;
  label: string;
  /** Niveau atteint par ce gain (célébration), sinon null. */
  levelUp: { level: number; rankTitle: string | null } | null;
};

export async function totalXp(userId: string): Promise<number> {
  const agg = await getDb().xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

/**
 * Inscrit un gain au registre. Idempotent : une clé déjà utilisée ne crée rien
 * et renvoie null (événement rejoué, double envoi, tâche rouverte puis refermée).
 */
export async function awardXp(input: {
  userId: string;
  amount: number;
  kind: string;
  label: string;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
  createdById?: string;
}): Promise<XpAward | null> {
  const db = getDb();
  const before = await totalXp(input.userId);
  try {
    await db.xpTransaction.create({ data: input });
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  const up = levelUp(before, before + input.amount);
  return {
    amount: input.amount,
    label: input.label,
    levelUp: up ? { level: up.level, rankTitle: up.newRank?.title ?? null } : null,
  };
}

/** XP de tâches déjà gagnés aujourd'hui (jour de Paris) : sert au plafond quotidien. */
async function taskXpToday(userId: string, now: Date): Promise<number> {
  const today = todayDate(now);
  const recent = await getDb().xpTransaction.findMany({
    where: { userId, kind: "task.done", createdAt: { gte: addDays(today, -1) } },
    select: { amount: true, createdAt: true },
  });
  return recent
    .filter((t) => todayDate(t.createdAt).getTime() === today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Clôture d'une tâche : une seule attribution par tâche, au responsable (à défaut, à qui
 * l'a terminée). Rouvrir puis refermer la tâche ne rapporte rien de plus.
 */
export async function awardTaskCompletion(
  task: {
    id: string;
    title: string;
    ownerId: string | null;
    complexity: Parameters<typeof taskCompletionXp>[0];
  },
  actor: Actor,
  now = new Date(),
): Promise<XpAward | null> {
  const userId = task.ownerId ?? actor.id;
  const xp = taskCompletionXp(task.complexity, await taskXpToday(userId, now));
  return awardXp({
    userId,
    amount: xp.amount,
    kind: "task.done",
    label: `${xp.label} : « ${task.title} »`,
    idempotencyKey: `task.done:${task.id}`,
    sourceType: "task",
    sourceId: task.id,
    createdById: actor.id,
  });
}

export async function getProgress(userId: string) {
  const db = getDb();
  const [xp, last] = await Promise.all([
    totalXp(userId),
    db.xpTransaction.findFirst({ where: { userId, amount: { not: 0 } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { ...levelInfo(xp), last };
}

export async function listXpTransactions(userId: string, take = 50) {
  return getDb().xpTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { reversedBy: { select: { id: true } } },
  });
}

/**
 * Corrige une attribution erronée : une transaction inverse, jamais une suppression.
 * Seul le bénéficiaire corrige ses propres XP ; la correction est journalisée.
 */
export async function reverseXp(id: string, reason: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const tx = await db.xpTransaction.findUnique({ where: { id }, include: { reversedBy: true } });
  if (!tx || tx.userId !== actor.id) return { ok: false, error: "Attribution introuvable." };
  if (tx.reversesId) return { ok: false, error: "Une correction ne se corrige pas : elle est définitive." };
  if (tx.reversedBy) return { ok: false, error: "Cette attribution est déjà corrigée." };
  if (tx.amount === 0) return { ok: false, error: "Rien à corriger : cette ligne ne rapporte aucun XP." };
  try {
    await db.xpTransaction.create({
      data: {
        userId: tx.userId,
        amount: -tx.amount,
        kind: "correction",
        label: `Correction : ${tx.label}`,
        idempotencyKey: `reverse:${tx.id}`,
        reversesId: tx.id,
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
        createdById: actor.id,
      },
    });
  } catch (e) {
    if (isDuplicate(e)) return { ok: false, error: "Cette attribution est déjà corrigée." };
    throw e;
  }
  await recordAudit({
    action: "progression.xp_reversed",
    actorId: actor.id,
    targetType: "xp_transaction",
    targetId: tx.id,
    before: { amount: tx.amount, label: tx.label },
    after: { amount: 0 },
    reason,
  });
  return { ok: true, data: null };
}
