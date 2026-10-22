import "server-only";
import type { DayMood, WeeklyItemKind, WeeklyItemStatus } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, startOfWeek, todayDate } from "@/lib/dates";
import { zonedToUtc } from "@/features/calendar/rules";
import { getDayPriorities } from "@/features/cockpit/service";
import { notify, notifyMany } from "@/features/notifications/service";
import { upcomingLoad } from "@/features/planning/load-service";
import type { ServiceResult } from "@/features/projects/service";
import { getAgencySettings } from "@/features/settings/service";
import { entryMinutes } from "@/features/time/service";
import { remaining } from "@/features/time/estimate-rules";
import { dayCapacityMinutes, dayLoad, itemLimitError } from "./rules";
import { checkAutoBadges } from "@/features/badges/service";
import { postBrigadeEvent } from "@/features/brigade/service";

type Actor = { id: string };
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = (error: string): ServiceResult<never> => ({ ok: false, error });

// ─── La mise en place (quotidien) ───────────────────────────────────────────

/** Ce que l'OS sait déjà de la journée : l'associé confirme ou ajuste, il ne ressaisit rien. */
export async function dailyContext(userId: string, now = new Date()) {
  const db = getDb();
  const today = todayDate(now);
  const dayStart = zonedToUtc(`${today.toISOString().slice(0, 10)}T00:00`)!;
  const dayEnd = zonedToUtc(`${addDays(today, 1).toISOString().slice(0, 10)}T00:00`)!;
  const [priorities, user, settings, dueToday, meetings, briefing] = await Promise.all([
    getDayPriorities(userId, now),
    db.user.findUnique({ where: { id: userId }, select: { weeklyCapacityHours: true } }),
    getAgencySettings(),
    db.task.count({
      where: {
        archivedAt: null,
        ownerId: userId,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { lte: today },
      },
    }),
    db.calendarEvent.count({
      where: {
        cancelledAt: null,
        startsAt: { gte: dayStart, lt: dayEnd },
        OR: [{ ownerId: userId }, { attendees: { some: { userId } } }],
      },
    }),
    db.dailyBriefing.findUnique({ where: { userId_day: { userId, day: today } } }),
  ]);
  const open = priorities.tasks.filter((t) => t.status !== "TERMINE" && t.status !== "ANNULE");
  const tracked = await db.timeEntry.groupBy({
    by: ["taskId"],
    where: { taskId: { in: open.map((t) => t.id) }, deletedAt: null },
    _sum: { durationMinutes: true },
  });
  const trackedBy = new Map(tracked.map((t) => [t.taskId, t._sum.durationMinutes ?? 0]));
  const remainingByTask = await db.task.findMany({
    where: { id: { in: open.map((t) => t.id) } },
    select: { id: true, remainingMinutes: true, estimatedMinutes: true },
  });
  const planned = remainingByTask.reduce(
    (n, t) => n + (remaining({ ...t, trackedMinutes: trackedBy.get(t.id) ?? 0 }) ?? 0),
    0,
  );
  const unestimated = remainingByTask.filter(
    (t) => t.estimatedMinutes == null && t.remainingMinutes == null,
  ).length;
  const capacity = dayCapacityMinutes(user?.weeklyCapacityHours ?? settings.defaultWeeklyHours);
  return {
    today,
    priorities,
    planned,
    unestimated,
    capacity,
    load: dayLoad(planned, capacity),
    dueToday,
    meetings,
    briefing,
  };
}

export type DailyInput = {
  mood: DayMood | null;
  moodShared: boolean;
  blocker: string | null;
  helpWanted: boolean;
  personalGoal: string | null;
  plannedMinutes: number | null;
};

/** Enregistre (ou ajuste) la mise en place du jour. Une demande d'aide prévient la brigade une fois. */
export async function saveDailyBriefing(actor: Actor, input: DailyInput, now = new Date()) {
  const db = getDb();
  const day = todayDate(now);
  const data = { ...input, helpWanted: input.helpWanted && !!input.blocker };
  const saved = await db.dailyBriefing.upsert({
    where: { userId_day: { userId: actor.id, day } },
    create: { userId: actor.id, day, ...data },
    update: data,
  });
  if (data.helpWanted) {
    const [me, others] = await Promise.all([
      db.user.findUnique({ where: { id: actor.id }, select: { name: true } }),
      db.user.findMany({ where: { role: "associe", id: { not: actor.id } }, select: { id: true } }),
    ]);
    await notifyMany(
      others.map((o) => o.id),
      {
        kind: "aide",
        title: `${me?.name ?? "Un associé"} demande un coup de main`,
        body: data.blocker ?? undefined,
        href: "/bureau",
        dedupeKey: `aide:${actor.id}:${day.toISOString().slice(0, 10)}`,
      },
    );
  }
  await checkAutoBadges(actor.id);
  return ok(saved);
}

export async function dailyHistory(userId: string, take = 14) {
  return getDb().dailyBriefing.findMany({ where: { userId }, orderBy: { day: "desc" }, take });
}

// ─── Le menu de la semaine (hebdomadaire) ───────────────────────────────────

export const weekOf = (date: Date) => startOfWeek(date);

const itemInclude = { owner: { select: { id: true, name: true } } } as const;

export async function getWeek(weekStart: Date) {
  return getDb().weeklyBriefing.findUnique({
    where: { weekStart },
    include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: itemInclude } },
  });
}

export async function listWeeks(take = 12) {
  return getDb().weeklyBriefing.findMany({
    orderBy: { weekStart: "desc" },
    take,
    include: { items: { where: { kind: "OBJECTIF" }, select: { status: true } } },
  });
}

/** Ouvre la page de la semaine (une seule par semaine, garantie par l'unicité du lundi). */
export async function openWeek(weekStart: Date, actor: Actor): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const existing = await db.weeklyBriefing.findUnique({ where: { weekStart }, select: { id: true } });
  if (existing) return ok(existing);
  try {
    const created = await db.weeklyBriefing.create({ data: { weekStart, createdById: actor.id } });
    await recordAudit({
      action: "briefing.week_opened",
      actorId: actor.id,
      targetType: "weekly_briefing",
      targetId: created.id,
      after: { weekStart: weekStart.toISOString().slice(0, 10) },
    });
    return ok({ id: created.id });
  } catch {
    const again = await db.weeklyBriefing.findUnique({ where: { weekStart }, select: { id: true } });
    return again ? ok(again) : fail("Impossible d'ouvrir la semaine.");
  }
}

/**
 * Synthèse préparée par l'OS : bilan des 7 derniers jours, échéances, risques, charge par associé.
 * Le système prépare ; la brigade décide.
 */
export async function weekContext(weekStart: Date, today = todayDate()) {
  const db = getDb();
  const since = addDays(weekStart, -7);
  const horizon = addDays(weekStart, 13);
  const open = { archivedAt: null, status: { notIn: ["TERMINE", "ANNULE"] as ("TERMINE" | "ANNULE")[] } };
  const [doneTasks, closedProjects, milestones, upcoming, late, blocked, decisions, xp, load, previous] =
    await Promise.all([
      db.task.count({ where: { status: "TERMINE", completedAt: { gte: since, lt: weekStart } } }),
      db.project.findMany({
        where: { internal: false, closedAt: { gte: since, lt: weekStart } },
        select: { id: true, name: true },
      }),
      db.milestone.findMany({
        where: { archivedAt: null, reachedAt: { gte: since, lt: weekStart } },
        select: { id: true, name: true, projectId: true },
      }),
      db.task.findMany({
        where: { ...open, dueDate: { gte: today, lte: horizon } },
        orderBy: { dueDate: "asc" },
        take: 12,
        select: {
          id: true,
          title: true,
          dueDate: true,
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      db.task.count({ where: { ...open, dueDate: { lt: today } } }),
      db.task.findMany({
        where: { archivedAt: null, status: "BLOQUE" },
        take: 6,
        select: { id: true, title: true, blockedReason: true },
      }),
      db.decisionRequest.findMany({
        where: { status: "OUVERTE" },
        select: { id: true, title: true },
        take: 6,
      }),
      db.xpTransaction.aggregate({
        where: {
          createdAt: {
            gte: zonedToUtc(`${since.toISOString().slice(0, 10)}T00:00`)!,
            lt: zonedToUtc(`${weekStart.toISOString().slice(0, 10)}T00:00`)!,
          },
        },
        _sum: { amount: true },
      }),
      upcomingLoad(1, weekStart > today ? weekStart : today),
      getWeek(addDays(weekStart, -7)),
    ]);
  return {
    review: {
      doneTasks,
      closedProjects,
      milestones,
      xp: xp._sum.amount ?? 0,
      previousGoals: previous?.items.filter((i) => i.kind === "OBJECTIF") ?? [],
      previousWeekStart: previous ? previous.weekStart : null,
    },
    upcoming,
    late,
    blocked,
    decisions,
    load: load.rows.map((r) => ({
      id: r.id,
      name: r.name,
      capacityHours: r.capacityHours,
      capacityIsDefault: r.capacityIsDefault,
      minutes: r.cells[0]?.minutes ?? 0,
      pct: r.cells[0]?.pct ?? 0,
      tone: r.cells[0]?.tone ?? "normal",
      unplannedMinutes: r.unplannedMinutes,
    })),
  };
}

export type ItemInput = {
  kind: WeeklyItemKind;
  title: string;
  detail: string | null;
  ownerId: string | null;
  dueDate: Date | null;
};

export async function addWeeklyItem(
  briefingId: string,
  input: ItemInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const week = await db.weeklyBriefing.findUnique({ where: { id: briefingId }, select: { id: true } });
  if (!week) return fail("Semaine introuvable.");
  const count = await db.weeklyItem.count({
    where: { briefingId, kind: input.kind, status: { not: "NON_ATTEINT" } },
  });
  const limit = itemLimitError(input.kind, count);
  if (limit) return fail(limit);
  const item = await db.weeklyItem.create({ data: { ...input, briefingId, position: count } });
  await recordAudit({
    action: "briefing.item_added",
    actorId: actor.id,
    targetType: "weekly_item",
    targetId: item.id,
    after: { kind: input.kind, title: input.title, ownerId: input.ownerId },
  });
  if (input.ownerId && input.ownerId !== actor.id)
    await notify({
      userId: input.ownerId,
      kind: "menu",
      title: `Menu de la semaine : « ${input.title} » vous est confié`,
      href: "/menu-semaine",
      dedupeKey: `menu:${item.id}`,
    });
  return ok({ id: item.id });
}

export async function setWeeklyItemStatus(id: string, status: WeeklyItemStatus, actor: Actor) {
  const db = getDb();
  const item = await db.weeklyItem.findUnique({ where: { id } });
  if (!item) return fail("Élément introuvable.");
  await db.weeklyItem.update({ where: { id }, data: { status } });
  if (item.kind === "OBJECTIF" && status === "ATTEINT")
    await postBrigadeEvent({
      userId: null,
      kind: "objectif",
      title: `Objectif de la semaine atteint : ${item.title}`,
      href: "/menu-semaine",
      dedupeKey: `objectif:${id}`,
    });
  await recordAudit({
    action: "briefing.item_status",
    actorId: actor.id,
    targetType: "weekly_item",
    targetId: id,
    before: { status: item.status },
    after: { status },
  });
  return ok(null);
}

export async function removeWeeklyItem(id: string, actor: Actor) {
  const db = getDb();
  const item = await db.weeklyItem.findUnique({ where: { id } });
  if (!item) return fail("Élément introuvable.");
  await db.weeklyItem.delete({ where: { id } });
  await recordAudit({
    action: "briefing.item_removed",
    actorId: actor.id,
    targetType: "weekly_item",
    targetId: id,
    before: { kind: item.kind, title: item.title },
  });
  return ok(null);
}

export async function saveWeekNotes(
  briefingId: string,
  input: { progressFocus: string | null; notes: string | null },
  actor: Actor,
) {
  const db = getDb();
  const week = await db.weeklyBriefing.findUnique({ where: { id: briefingId } });
  if (!week) return fail("Semaine introuvable.");
  await db.weeklyBriefing.update({ where: { id: briefingId }, data: input });
  await recordAudit({
    action: "briefing.week_notes",
    actorId: actor.id,
    targetType: "weekly_briefing",
    targetId: briefingId,
    before: { progressFocus: week.progressFocus, notes: week.notes },
    after: input,
  });
  return ok(null);
}

/** Valider le menu : la brigade a décidé. La page reste modifiable et historisée. */
export async function validateWeek(briefingId: string, actor: Actor) {
  const db = getDb();
  const week = await db.weeklyBriefing.findUnique({ where: { id: briefingId } });
  if (!week) return fail("Semaine introuvable.");
  await db.weeklyBriefing.update({
    where: { id: briefingId },
    data: { validatedAt: new Date(), validatedById: actor.id },
  });
  await recordAudit({
    action: "briefing.week_validated",
    actorId: actor.id,
    targetType: "weekly_briefing",
    targetId: briefingId,
  });
  return ok(null);
}

/** Pour le cockpit : la mise en place du jour est-elle faite ? Le menu de la semaine existe-t-il ? */
export async function briefingStatus(userId: string, now = new Date()) {
  const db = getDb();
  const today = todayDate(now);
  const [daily, week] = await Promise.all([
    db.dailyBriefing.findUnique({ where: { userId_day: { userId, day: today } }, select: { id: true } }),
    db.weeklyBriefing.findUnique({ where: { weekStart: weekOf(today) }, select: { validatedAt: true } }),
  ]);
  return { dailyDone: !!daily, weekOpened: !!week, weekValidated: !!week?.validatedAt };
}

/** Temps réellement suivi un jour donné (pour comparer au prévu dans l'historique). */
export async function trackedOn(userId: string, day: Date) {
  const entries = await getDb().timeEntry.findMany({ where: { userId, date: day, deletedAt: null } });
  return entries.reduce((n, e) => n + entryMinutes(e), 0);
}
