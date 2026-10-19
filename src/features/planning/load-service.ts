import "server-only";
/**
 * Charge à venir par associé (cockpit) : reste à faire des tâches ouvertes réparti par semaine
 * (weeklyLoad), rapporté à la capacité hebdomadaire de chacun (la sienne, sinon celle de l'agence).
 * Une tâche sans estimation ne pèse pas ; une tâche estimée sans échéance est « non planifiée ».
 */
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { getAgencySettings } from "@/features/settings/service";
import { loadPercent, weeklyLoad, type LoadTask } from "@/features/planning/workload";

export const LOAD_WEEKS = 6;

export type LoadTone = "danger" | "warning" | "normal";

/** Au-delà de 100 % : surcharge ; au-delà de 85 % : chargé. */
export const loadTone = (pct: number): LoadTone => (pct > 100 ? "danger" : pct > 85 ? "warning" : "normal");

export type LoadAssociate = { id: string; name: string; weeklyCapacityHours: number | null };

export type LoadCell = { weekStart: Date; minutes: number; pct: number; tone: LoadTone };

export type LoadRow = {
  id: string;
  name: string;
  capacityHours: number;
  /** Capacité de l'agence appliquée faute de capacité personnelle. */
  capacityIsDefault: boolean;
  cells: LoadCell[];
  /** Reste à faire des tâches estimées sans échéance. */
  unplannedMinutes: number;
};

/** Grille associé × semaine (pure). */
export function loadGrid(input: {
  associates: LoadAssociate[];
  tasks: LoadTask[];
  today: Date;
  defaultWeeklyHours: number;
  weeks?: number;
}): { weekStarts: Date[]; rows: LoadRow[] } {
  const weeks = input.weeks ?? LOAD_WEEKS;
  const load = weeklyLoad(input.tasks, input.today, weeks);
  const unplanned = new Map<string, number>();
  for (const t of input.tasks) {
    if (!t.ownerId || t.dueDate) continue;
    const remaining = Math.max(0, (t.estimatedMinutes ?? 0) - t.loggedMinutes);
    if (remaining) unplanned.set(t.ownerId, (unplanned.get(t.ownerId) ?? 0) + remaining);
  }
  return {
    weekStarts: load.weekStarts,
    rows: input.associates.map((a) => {
      const capacityHours = a.weeklyCapacityHours ?? input.defaultWeeklyHours;
      const minutes: number[] = load.perOwner.get(a.id) ?? Array(weeks).fill(0);
      return {
        id: a.id,
        name: a.name,
        capacityHours,
        capacityIsDefault: a.weeklyCapacityHours == null,
        cells: minutes.map((m, i) => {
          const pct = loadPercent(m, capacityHours);
          return { weekStart: load.weekStarts[i], minutes: m, pct, tone: loadTone(pct) };
        }),
        unplannedMinutes: unplanned.get(a.id) ?? 0,
      };
    }),
  };
}

/** Tâches ouvertes et assignées, hors archives (tâche ou projet). */
const OPEN_TASKS = {
  archivedAt: null,
  status: { notIn: ["TERMINE", "ANNULE"] },
  ownerId: { not: null },
  project: { archivedAt: null },
} satisfies Prisma.TaskWhereInput;

/** Charge des prochaines semaines : quatre requêtes en parallèle, temps passé groupé par tâche. */
export async function upcomingLoad(weeks = LOAD_WEEKS, today = todayDate()) {
  const db = getDb();
  const [associates, settings, tasks, logged] = await Promise.all([
    db.user.findMany({
      where: { role: "associe" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weeklyCapacityHours: true },
    }),
    getAgencySettings(),
    db.task.findMany({
      where: OPEN_TASKS,
      select: { id: true, ownerId: true, startDate: true, dueDate: true, estimatedMinutes: true },
    }),
    db.timeEntry.groupBy({
      by: ["taskId"],
      where: { deletedAt: null, task: OPEN_TASKS },
      _sum: { durationMinutes: true },
    }),
  ]);
  const loggedByTask = new Map(logged.map((g) => [g.taskId, g._sum.durationMinutes ?? 0]));
  return loadGrid({
    associates,
    today,
    weeks,
    defaultWeeklyHours: settings.defaultWeeklyHours,
    tasks: tasks.map((t) => ({ ...t, loggedMinutes: loggedByTask.get(t.id) ?? 0 })),
  });
}

export type UpcomingLoad = Awaited<ReturnType<typeof upcomingLoad>>;
