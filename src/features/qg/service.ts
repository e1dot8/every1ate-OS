import "server-only";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import { WIP_STATES } from "@/features/projects/rules";
import { assignTask, type ServiceResult } from "@/features/projects/service";
import { upcomingLoad } from "@/features/planning/load-service";
import { effectivePresence, type PresenceInfo } from "@/features/presence/rules";
import { presenceSelect } from "@/features/presence/service";
import { getAgencySettings } from "@/features/settings/service";
import { listStandups } from "@/features/qg/standup";
import {
  BLOCKED_HOURS,
  HANDOFF_HOURS,
  computeQuests,
  currentWeek,
  type QuestFacts,
} from "@/features/qg/quests";

/** Tâche ouverte d'un projet ouvert (ni archivée, ni terminée, ni annulée). */
const OPEN_TASK = {
  archivedAt: null,
  status: { notIn: ["TERMINE", "ANNULE"] as ("TERMINE" | "ANNULE")[] },
  project: { archivedAt: null },
};

const HOUR = 3_600_000;
/** Une tâche sans activité depuis 10 jours « prend la poussière ». */
export const DUST_DAYS = 10;

// ─── Mon bureau ─────────────────────────────────────────────────────────────

export async function myDesk(userId: string) {
  const [settings, tasks] = await Promise.all([
    getAgencySettings(),
    getDb().task.findMany({
      where: { ownerId: userId, status: { in: WIP_STATES }, archivedAt: null, project: { archivedAt: null } },
      orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        blockedReason: true,
        blockedNextAction: true,
        wipOverrideReason: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { limit: settings.wipLimit, tasks, full: tasks.length >= settings.wipLimit };
}

// ─── L'équipe aujourd'hui ───────────────────────────────────────────────────

export async function teamToday(viewerId: string, now = new Date()) {
  const db = getDb();
  const today = todayDate(now);
  const [associates, settings, standups, desks, load] = await Promise.all([
    db.user.findMany({
      where: { role: "associe" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ...presenceSelect },
    }),
    getAgencySettings(),
    listStandups(today),
    db.task.groupBy({
      by: ["ownerId"],
      where: {
        ownerId: { not: null },
        status: { in: WIP_STATES },
        archivedAt: null,
        project: { archivedAt: null },
      },
      _count: { _all: true },
    }),
    upcomingLoad(1, today),
  ]);
  const deskOf = new Map(desks.map((d) => [d.ownerId, d._count._all]));
  const loadOf = new Map(load.rows.map((r) => [r.id, r.cells[0]?.pct ?? 0]));
  const standupOf = new Map(standups.map((s) => [s.userId, s]));
  const overloaded = associates
    .filter((a) => a.id !== viewerId && (loadOf.get(a.id) ?? 0) > 100)
    .map((a) => a.id);
  // Tâches non commencées des associés surchargés : on peut proposer de les reprendre.
  const notStarted = overloaded.length
    ? await db.task.findMany({
        where: {
          ownerId: { in: overloaded },
          status: "A_FAIRE",
          archivedAt: null,
          project: { archivedAt: null },
          handoffs: { none: { status: "EN_ATTENTE" } },
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        select: { id: true, title: true, ownerId: true, dueDate: true, project: { select: { name: true } } },
        take: 60,
      })
    : [];
  return associates.map((a) => {
    const info: PresenceInfo = {
      state: a.presenceState,
      until: a.presenceUntil,
      note: a.presenceNote,
      shared: a.presenceShared,
    };
    const s = standupOf.get(a.id);
    return {
      id: a.id,
      name: a.name,
      self: a.id === viewerId,
      presence: effectivePresence(info, now, a.id === viewerId),
      standup: s ? { today: s.today, blocked: s.blocked } : null,
      loadPct: loadOf.get(a.id) ?? 0,
      desk: deskOf.get(a.id) ?? 0,
      limit: settings.wipLimit,
      notStarted: notStarted.filter((t) => t.ownerId === a.id).slice(0, 5),
    };
  });
}

// ─── À prendre ──────────────────────────────────────────────────────────────

export async function tasksToTake(take = 8) {
  const where = {
    ...OPEN_TASK,
    ownerId: null,
    project: { archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] as ("TERMINE" | "ARCHIVE")[] } },
  };
  const [tasks, total] = await Promise.all([
    getDb().task.findMany({
      where,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        title: true,
        dueDate: true,
        estimatedMinutes: true,
        project: { select: { id: true, name: true } },
      },
    }),
    getDb().task.count({ where }),
  ]);
  return { tasks, total };
}

/** « Je la prends » : une tâche sans responsable devient la mienne (si personne ne l'a prise entre-temps). */
export async function takeTask(
  taskId: string,
  actor: { id: string },
): Promise<ServiceResult<{ projectId: string }>> {
  const result = await assignTask(taskId, actor.id, actor, {
    expectedOwnerId: null,
    reason: "Prise dans « À prendre » (QG)",
  });
  if (!result.ok)
    return result.error.startsWith("La tâche a changé")
      ? { ok: false, error: "Un associé vient de la prendre." }
      : result;
  return { ok: true, data: { projectId: result.data.projectId } };
}

// ─── Quêtes de la semaine ───────────────────────────────────────────────────

/** Tâches bloquées depuis plus de 48 h : date du dernier changement de statut (journal), sinon de la tâche. */
async function blockedOverHours(now: Date, hours: number) {
  const db = getDb();
  const blocked = await db.task.findMany({
    where: { status: "BLOQUE", archivedAt: null, project: { archivedAt: null } },
    select: { id: true, updatedAt: true },
  });
  if (!blocked.length) return [];
  const events = await db.auditEvent.findMany({
    where: { action: "task.status_changed", targetType: "task", targetId: { in: blocked.map((t) => t.id) } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, createdAt: true },
  });
  const since = new Map<string, Date>();
  for (const e of events) if (e.targetId && !since.has(e.targetId)) since.set(e.targetId, e.createdAt);
  const limit = now.getTime() - hours * HOUR;
  return blocked.filter((t) => (since.get(t.id) ?? t.updatedAt).getTime() < limit).map((t) => t.id);
}

export async function questFacts(now = new Date()): Promise<QuestFacts> {
  const db = getDb();
  const week = currentWeek(now);
  const today = todayDate(now);
  const [doneThisWeek, lateFollowUps, blocked, answered, handoffsOverdue] = await Promise.all([
    db.task.count({ where: { status: "TERMINE", completedAt: { gte: week.start, lt: week.end } } }),
    db.opportunity.count({
      where: { archivedAt: null, stage: { notIn: ["GAGNE", "PERDU"] }, nextActionDate: { lt: today } },
    }),
    blockedOverHours(now, BLOCKED_HOURS),
    db.handoff.findMany({
      where: { status: { in: ["ACCEPTEE", "REFUSEE"] }, answeredAt: { gte: week.start, lt: week.end } },
      select: { createdAt: true, answeredAt: true },
    }),
    db.handoff.count({
      where: { status: "EN_ATTENTE", createdAt: { lt: new Date(now.getTime() - HANDOFF_HOURS * HOUR) } },
    }),
  ]);
  return {
    doneThisWeek,
    lateFollowUps,
    blockedOver48h: blocked.length,
    handoffsAnswered: answered.length,
    handoffsAnsweredFast: answered.filter(
      (h) => h.answeredAt && h.answeredAt.getTime() - h.createdAt.getTime() <= HANDOFF_HOURS * HOUR,
    ).length,
    handoffsOverdue,
  };
}

export async function weekQuests(now = new Date()) {
  const week = currentWeek(now);
  const [facts, badges, history] = await Promise.all([
    questFacts(now),
    getDb().teamBadge.findMany({ where: { period: week.period }, orderBy: { earnedAt: "asc" } }),
    getDb().teamBadge.findMany({
      where: { period: { not: week.period } },
      orderBy: { earnedAt: "desc" },
      take: 12,
    }),
  ]);
  return { period: week.period, quests: computeQuests(facts), badges, history };
}

// ─── Stand-up ───────────────────────────────────────────────────────────────

/** Brouillon du stand-up à partir de mes tâches : en cours et dues aujourd'hui ; motifs de blocage. */
export async function standupDraft(userId: string, now = new Date()) {
  const today = todayDate(now);
  const tasks = await getDb().task.findMany({
    where: {
      ...OPEN_TASK,
      ownerId: userId,
      OR: [{ status: { in: WIP_STATES } }, { dueDate: today }],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      title: true,
      status: true,
      dueDate: true,
      blockedReason: true,
      project: { select: { name: true } },
    },
  });
  const line = (t: (typeof tasks)[number]) => `- ${t.title} (${t.project.name})`;
  const todayLines = tasks
    .filter((t) => t.status !== "BLOQUE")
    .map(
      (t) =>
        `${line(t)}${t.dueDate && t.dueDate.getTime() === today.getTime() ? " : à rendre aujourd'hui" : ""}`,
    );
  const blockedLines = tasks
    .filter((t) => t.status === "BLOQUE")
    .map((t) => `${line(t)} : ${t.blockedReason ?? "raison non précisée"}`);
  return { today: todayLines.join("\n"), blocked: blockedLines.join("\n") };
}

/** Stand-ups des 7 jours précédents, regroupés par jour (le plus récent d'abord). */
export async function standupHistory(now = new Date(), days = 7) {
  const today = todayDate(now);
  const rows = await getDb().standupEntry.findMany({
    where: { date: { gte: addDays(today, -days), lt: today } },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    include: { user: { select: { id: true, name: true } } },
  });
  const byDay = new Map<string, { date: Date; entries: typeof rows }>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const group = byDay.get(key) ?? { date: r.date, entries: [] };
    group.entries.push(r);
    byDay.set(key, group);
  }
  return [...byDay.values()];
}

// ─── Grand ménage ───────────────────────────────────────────────────────────

/**
 * Tâches ouvertes sans activité depuis 10 jours : ni modification, ni temps saisi, ni commentaire.
 * Les plus anciennes d'abord.
 */
export async function dustyTasks(now = new Date(), take = 50) {
  const db = getDb();
  const cutoff = new Date(now.getTime() - DUST_DAYS * 24 * HOUR);
  const tasks = await db.task.findMany({
    where: {
      ...OPEN_TASK,
      updatedAt: { lt: cutoff },
      timeEntries: { none: { createdAt: { gte: cutoff } } },
      comments: { none: { createdAt: { gte: cutoff } } },
    },
    orderBy: { updatedAt: "asc" },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      updatedAt: true,
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      timeEntries: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      comments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  return tasks.map(({ timeEntries, comments, ...t }) => {
    const last = Math.max(
      t.updatedAt.getTime(),
      timeEntries[0]?.createdAt.getTime() ?? 0,
      comments[0]?.createdAt.getTime() ?? 0,
    );
    return { ...t, idleDays: Math.floor((now.getTime() - last) / (24 * HOUR)) };
  });
}
