import "server-only";
import { weekOf } from "@/features/briefing/service";
import { awardXp, type XpAward } from "@/features/progression/service";
import type { ServiceResult } from "@/features/projects/service";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import { MAX_ACTIVE_QUESTS, QUESTS, questByKey, type Quest, type QuestMetric } from "./catalog";
import { canAccept, progressOf, questXpKey, type QuestProgress } from "./rules";

type Actor = { id: string };

/** Valeur réelle d'une mesure pour un associé, sur la semaine [from, to[. */
async function measure(metric: QuestMetric, userId: string, from: Date, to: Date): Promise<number> {
  const db = getDb();
  const range = { gte: from, lt: to };
  switch (metric) {
    case "tasksDone":
      return db.task.count({ where: { ownerId: userId, status: "TERMINE", completedAt: range } });
    case "clientNotes":
      // Les changements d'étape sont automatiques : seuls les échanges consignés comptent.
      return db.opportunityActivity.count({
        where: { authorId: userId, kind: { not: "ETAPE" }, occurredAt: range },
      });
    case "recipesWritten":
      return db.recipe.count({ where: { authorId: userId, archivedAt: null, createdAt: range } });
    case "briefingDays":
      return db.dailyBriefing.count({ where: { userId, day: range } });
    case "minutesTracked": {
      const sum = await db.timeEntry.aggregate({
        where: { userId, deletedAt: null, date: range },
        _sum: { durationMinutes: true },
      });
      return sum._sum.durationMinutes ?? 0;
    }
    case "helpGiven":
      return db.helpRequest.count({ where: { takenById: userId, resolvedAt: range } });
    case "cheersGiven":
      return db.brigadeCheer.count({ where: { userId, createdAt: range } });
  }
}

export type WeekQuest = Quest & {
  progress: QuestProgress;
  accepted: boolean;
  completedAt: Date | null;
};

/** Les quêtes de la semaine d'un associé : acceptées d'abord, avec leur progression réelle. */
export async function weekQuests(userId: string, today = todayDate()) {
  const weekStart = weekOf(today);
  const weekEnd = addDays(weekStart, 7);
  const enrolled = await getDb().questEnrollment.findMany({ where: { userId, weekStart } });
  const quests: WeekQuest[] = await Promise.all(
    QUESTS.map(async (q) => {
      const e = enrolled.find((x) => x.questKey === q.key);
      return {
        ...q,
        accepted: !!e,
        completedAt: e?.completedAt ?? null,
        // Une quête non acceptée n'est pas mesurée : rien à calculer pour rien.
        progress: progressOf(e ? await measure(q.metric, userId, weekStart, weekEnd) : 0, q.target),
      };
    }),
  );
  return {
    weekStart,
    active: quests.filter((q) => q.accepted),
    available: quests.filter((q) => !q.accepted),
    slotsLeft: Math.max(0, MAX_ACTIVE_QUESTS - enrolled.length),
  };
}

export async function acceptQuest(
  key: string,
  actor: Actor,
  today = todayDate(),
): Promise<ServiceResult<null>> {
  if (!questByKey(key)) return { ok: false, error: "Quête inconnue." };
  const db = getDb();
  const weekStart = weekOf(today);
  const enrolled = await db.questEnrollment.findMany({ where: { userId: actor.id, weekStart } });
  const check = canAccept(key, enrolled);
  if (!check.ok) return check;
  await db.questEnrollment.createMany({
    data: [{ userId: actor.id, questKey: key, weekStart }],
    skipDuplicates: true,
  });
  return { ok: true, data: null };
}

/** Abandonner libère la place ; une quête déjà validée reste acquise. */
export async function abandonQuest(
  key: string,
  actor: Actor,
  today = todayDate(),
): Promise<ServiceResult<null>> {
  const { count } = await getDb().questEnrollment.deleteMany({
    where: { userId: actor.id, questKey: key, weekStart: weekOf(today), completedAt: null },
  });
  return count ? { ok: true, data: null } : { ok: false, error: "Quête introuvable ou déjà validée." };
}

/**
 * Valider une quête : la progression est recalculée côté serveur, puis les XP sont inscrits
 * une seule fois (clé d'idempotence par quête, semaine et associé).
 */
export async function completeQuest(
  key: string,
  actor: Actor,
  today = todayDate(),
): Promise<ServiceResult<{ xp: XpAward | null; title: string }>> {
  const quest = questByKey(key);
  if (!quest) return { ok: false, error: "Quête inconnue." };
  const db = getDb();
  const weekStart = weekOf(today);
  const e = await db.questEnrollment.findUnique({
    where: { userId_questKey_weekStart: { userId: actor.id, questKey: key, weekStart } },
  });
  if (!e) return { ok: false, error: "Acceptez d'abord cette quête." };
  if (e.completedAt) return { ok: false, error: "Quête déjà validée cette semaine." };
  const value = await measure(quest.metric, actor.id, weekStart, addDays(weekStart, 7));
  if (!progressOf(value, quest.target).reached)
    return { ok: false, error: `Pas encore : ${value} / ${quest.target} ${quest.unit(quest.target)}.` };
  // Marque d'abord la quête (condition sur completedAt : un double envoi ne passe qu'une fois).
  const { count } = await db.questEnrollment.updateMany({
    where: { id: e.id, completedAt: null },
    data: { completedAt: new Date() },
  });
  if (!count) return { ok: false, error: "Quête déjà validée cette semaine." };
  const xp = await awardXp({
    userId: actor.id,
    amount: quest.xp,
    kind: "quest.done",
    label: `Quête : ${quest.title}`,
    idempotencyKey: questXpKey(key, weekStart, actor.id),
    sourceType: "quest",
    sourceId: e.id,
  });
  return { ok: true, data: { xp, title: quest.title } };
}

/**
 * Petit mot d'avancée après une action (ex. tâche terminée) : seulement si une quête acceptée
 * et non validée mesure cette donnée. Jamais bloquant, jamais de notification en plus.
 */
export async function questNudge(userId: string, metric: QuestMetric, today = todayDate()) {
  const weekStart = weekOf(today);
  const keys = QUESTS.filter((q) => q.metric === metric).map((q) => q.key);
  const e = await getDb().questEnrollment.findFirst({
    where: { userId, weekStart, completedAt: null, questKey: { in: keys } },
  });
  const quest = e ? questByKey(e.questKey) : null;
  if (!quest) return null;
  const p = progressOf(await measure(metric, userId, weekStart, addDays(weekStart, 7)), quest.target);
  return p.reached
    ? `Quête « ${quest.title} » prête à valider !`
    : `Quête « ${quest.title} » : ${p.value} / ${quest.target}.`;
}
