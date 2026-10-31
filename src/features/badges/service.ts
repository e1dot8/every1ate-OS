import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { notifyMany } from "@/features/notifications/service";
import { awardXp } from "@/features/progression/service";
import type { ServiceResult } from "@/features/projects/service";
import { postBrigadeEvent } from "@/features/brigade/service";
import { entryMinutes } from "@/features/time/service";
import { weekOf } from "@/features/briefing/service";
import { accurateStreak, badgeByKey, newlyEarned, type Badge, type BadgeStats } from "./catalog";
import { weeklyStreak } from "./streak";

type Actor = { id: string };

/** Préférences (valeurs par défaut créées au premier accès, sans conflit entre lectures parallèles). */
export async function getPreferences(userId: string) {
  const db = getDb();
  const found = await db.userPreference.findUnique({ where: { userId } });
  if (found) return found;
  await db.userPreference.createMany({ data: [{ userId }], skipDuplicates: true });
  return db.userPreference.findUniqueOrThrow({ where: { userId } });
}

export async function savePreferences(
  userId: string,
  input: { celebrations: boolean; streakEnabled: boolean; streakDays: number; badgesPublic: boolean },
) {
  const streakDays = Math.min(5, Math.max(2, Math.round(input.streakDays)));
  await getDb().userPreference.upsert({
    where: { userId },
    create: { userId, ...input, streakDays },
    update: { ...input, streakDays },
  });
}

/** Statistiques de travail réel servant aux badges automatiques. */
export async function badgeStats(userId: string): Promise<BadgeStats> {
  const db = getDb();
  const doneWhere = { ownerId: userId, status: "TERMINE" as const };
  const [byCategory, delivered, fiveStar, briefings, recent, doneIds, reused] = await Promise.all([
    db.task.groupBy({ by: ["category"], where: doneWhere, _count: { _all: true } }),
    db.project.count({ where: { ownerId: userId, internal: false, closedAt: { not: null } } }),
    db.project.count({
      where: { ownerId: userId, internal: false, closedAt: { not: null }, clientSatisfaction: 5 },
    }),
    db.dailyBriefing.count({ where: { userId } }),
    db.task.findMany({
      where: { ...doneWhere, estimatedMinutes: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        estimatedMinutes: true,
        timeEntries: {
          where: { deletedAt: null },
          select: { durationMinutes: true, startedAt: true, endedAt: true },
        },
      },
    }),
    db.task.findMany({ where: doneWhere, select: { id: true } }),
    db.recipeUse.count({ where: { recipe: { authorId: userId }, userId: { not: userId } } }),
  ]);
  const rescued = doneIds.length
    ? await db.auditEvent.findMany({
        where: {
          action: "task.status_changed",
          targetId: { in: doneIds.map((t) => t.id) },
          after: { path: ["status"], equals: "BLOQUE" },
        },
        distinct: ["targetId"],
        select: { targetId: true },
      })
    : [];
  const count = (c: string) => byCategory.find((g) => g.category === c)?._count._all ?? 0;
  return {
    tasksDone: byCategory.reduce((n, g) => n + g._count._all, 0),
    categoriesDone: byCategory.length,
    agencyTasksDone: count("AGENCE"),
    brandingTasksDone: count("BRANDING"),
    projectsDelivered: delivered,
    fiveStarProjects: fiveStar,
    rescuedTasks: rescued.length,
    accurateStreak: accurateStreak(
      recent
        .filter((t) => t.timeEntries.length)
        .map((t) => ({
          estimated: t.estimatedMinutes!,
          actual: t.timeEntries.reduce((n, e) => n + entryMinutes(e), 0),
        })),
    ),
    briefings,
    recipesReused: reused,
  };
}

async function grant(
  userId: string,
  badge: Badge,
  reason: string,
  givenById: string | null,
  source?: { type: string; id: string },
) {
  const db = getDb();
  const prefs = await getPreferences(userId);
  const created = await db.userBadge.createMany({
    data: [
      {
        userId,
        badgeKey: badge.key,
        reason,
        givenById,
        visible: prefs.badgesPublic,
        sourceType: source?.type,
        sourceId: source?.id,
      },
    ],
    skipDuplicates: true,
  });
  if (!created.count) return false;
  if (badge.xp)
    await awardXp({
      userId,
      amount: badge.xp,
      kind: "badge",
      label: `Badge « ${badge.name} »`,
      idempotencyKey: `badge:${badge.key}:${userId}`,
      sourceType: "badge",
      sourceId: badge.key,
      createdById: givenById ?? undefined,
    });
  // Un badge de reconnaissance est déjà un geste public ; un badge automatique se partage
  // au moment de la célébration, si la personne le souhaite (lot G7).
  if (givenById) await announceBadge(userId, badge, reason);
  return true;
}

/** Publie un badge dans le fil du bureau commun et prévient la brigade (une seule fois). */
async function announceBadge(userId: string, badge: Badge, reason: string) {
  const db = getDb();
  const holder = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const title = `${holder?.name ?? "Un associé"} obtient « ${badge.name} »`;
  await postBrigadeEvent({
    userId,
    kind: "badge",
    title,
    detail: reason,
    href: "/bureau",
    dedupeKey: `badge:${badge.key}:${userId}`,
  });
  const others = await db.user.findMany({
    where: { role: "associe", id: { not: userId } },
    select: { id: true },
  });
  await notifyMany(
    others.map((o) => o.id),
    { kind: "badge", title, body: reason, href: "/bureau", dedupeKey: `badge:${badge.key}:${userId}` },
  );
}

/** Partager un badge obtenu dans le bureau commun (choix de la personne, idempotent). */
export async function shareBadge(userId: string, id: string): Promise<ServiceResult<null>> {
  const db = getDb();
  const owned = await db.userBadge.findFirst({ where: { id, userId } });
  const badge = owned ? badgeByKey(owned.badgeKey) : null;
  if (!owned || !badge) return { ok: false, error: "Badge introuvable." };
  await announceBadge(userId, badge, owned.reason);
  await db.userBadge.update({ where: { id }, data: { seenAt: owned.seenAt ?? new Date(), visible: true } });
  return { ok: true, data: null };
}

/** Clés des badges déjà partagés dans le fil. */
export async function sharedBadgeKeys(userId: string): Promise<Set<string>> {
  const events = await getDb().brigadeEvent.findMany({
    where: { userId, kind: "badge" },
    select: { dedupeKey: true },
  });
  return new Set(events.map((e) => e.dedupeKey.split(":")[1]));
}

/** Vérifie et décerne les badges automatiques (idempotent : un badge par associé). */
export async function checkAutoBadges(userId: string): Promise<string[]> {
  const db = getDb();
  const [stats, owned] = await Promise.all([
    badgeStats(userId),
    db.userBadge.findMany({ where: { userId }, select: { badgeKey: true } }),
  ]);
  const earned = newlyEarned(stats, new Set(owned.map((o) => o.badgeKey)));
  const names: string[] = [];
  for (const b of earned) if (await grant(userId, b, b.because ?? b.description, null)) names.push(b.name);
  return names;
}

/** Reconnaissance : un associé décerne un badge de brigade à un autre, avec un mot. */
export async function awardPeerBadge(
  targetId: string,
  badgeKey: string,
  message: string,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const badge = badgeByKey(badgeKey);
  if (!badge || badge.earned) return { ok: false, error: "Ce badge ne se décerne pas à la main." };
  if (targetId === actor.id)
    return { ok: false, error: "Un badge de reconnaissance vient toujours d'un autre associé." };
  const target = await getDb().user.findFirst({
    where: { id: targetId, role: "associe" },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "Associé introuvable." };
  const given = await grant(targetId, badge, message, actor.id);
  if (!given) return { ok: false, error: "Cet associé a déjà ce badge." };
  await recordAudit({
    action: "progression.badge_given",
    actorId: actor.id,
    targetType: "user",
    targetId,
    after: { badge: badgeKey, message },
  });
  return { ok: true, data: null };
}

/** Badges d'un associé ; ceux qu'il a masqués ne sont visibles que par lui. */
export async function listUserBadges(userId: string, viewerId: string) {
  return getDb().userBadge.findMany({
    where: { userId, ...(userId === viewerId ? {} : { visible: true }) },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    include: { givenBy: { select: { name: true } } },
  });
}

export async function updateBadge(
  userId: string,
  id: string,
  change: { visible?: boolean; favorite?: boolean; seen?: boolean },
) {
  const db = getDb();
  if (change.favorite) {
    const favorites = await db.userBadge.count({ where: { userId, favorite: true, id: { not: id } } });
    if (favorites >= 3) return { ok: false as const, error: "Trois badges favoris au plus." };
  }
  await db.userBadge.updateMany({
    where: { userId, id },
    data: {
      ...(change.visible !== undefined ? { visible: change.visible } : {}),
      ...(change.favorite !== undefined ? { favorite: change.favorite } : {}),
      ...(change.seen ? { seenAt: new Date() } : {}),
    },
  });
  return { ok: true as const };
}

export async function unseenBadges(userId: string) {
  return getDb().userBadge.findMany({ where: { userId, seenAt: null }, orderBy: { createdAt: "asc" } });
}

/** Série de régularité de l'associé (null si désactivée). */
export async function userStreak(userId: string, today = todayDate()) {
  const db = getDb();
  const prefs = await getPreferences(userId);
  if (!prefs.streakEnabled) return null;
  const since = new Date(today.getTime() - 120 * 86_400_000);
  const [briefings, done, pauses] = await Promise.all([
    db.dailyBriefing.findMany({ where: { userId, day: { gte: since } }, select: { day: true } }),
    db.task.findMany({
      where: { ownerId: userId, status: "TERMINE", completedAt: { gte: since } },
      select: { completedAt: true },
    }),
    db.streakPause.findMany({ where: { userId }, select: { weekStart: true } }),
  ]);
  return weeklyStreak({
    activeDays: [...briefings.map((b) => b.day), ...done.map((t) => todayDate(t.completedAt!))],
    pausedWeeks: pauses.map((p) => p.weekStart),
    currentWeek: weekOf(today),
    required: prefs.streakDays,
  });
}

export async function toggleStreakPause(userId: string, weekStart: Date) {
  const db = getDb();
  const existing = await db.streakPause.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
  if (existing) await db.streakPause.delete({ where: { id: existing.id } });
  else await db.streakPause.create({ data: { userId, weekStart } });
  return !existing;
}
