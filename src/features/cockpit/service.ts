import "server-only";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { comparePriority } from "@/features/planning/rules";
import type { ServiceResult } from "@/features/projects/service";

/** Trois priorités au plus par jour : au-delà, ce n'est plus une priorité. */
export const MAX_PRIORITIES = 3;

const OPEN_STATUSES = { notIn: ["TERMINE", "ANNULE"] } as { notIn: ("TERMINE" | "ANNULE")[] };

const prioritySelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  estimatedMinutes: true,
  complexity: true,
  owner: { select: { name: true } },
  project: { select: { id: true, name: true } },
} as const;

/** Tâches ouvertes d'un associé (responsable ou contributeur) : vivier des priorités. */
export async function openTasksFor(userId: string) {
  return getDb().task.findMany({
    where: {
      archivedAt: null,
      status: OPEN_STATUSES,
      project: { archivedAt: null },
      OR: [{ ownerId: userId }, { contributors: { some: { userId } } }],
    },
    select: prioritySelect,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });
}

/**
 * Priorités du jour. Choisies : celles de l'associé (terminées comprises, pour voir le chemin
 * parcouru). Sinon : suggestion transparente (priorité, puis échéance), à confirmer.
 */
export async function getDayPriorities(userId: string, now = new Date()) {
  const day = todayDate(now);
  const chosen = await getDb().dailyPriority.findMany({
    where: { userId, day, task: { archivedAt: null } },
    orderBy: { position: "asc" },
    select: { task: { select: prioritySelect } },
  });
  if (chosen.length) return { day, chosen: true as const, tasks: chosen.map((c) => c.task) };
  const open = await openTasksFor(userId);
  const suggested = open
    .filter((t) => t.status !== "BLOQUE" && t.status !== "EN_ATTENTE")
    .sort(
      (a, b) =>
        comparePriority(b.priority, a.priority) ||
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    )
    .slice(0, MAX_PRIORITIES);
  return { day, chosen: false as const, tasks: suggested };
}

/** Remplace les priorités du jour (ordre conservé). Seules des tâches ouvertes sont acceptées. */
export async function setDayPriorities(
  userId: string,
  taskIds: string[],
  now = new Date(),
): Promise<ServiceResult<{ count: number }>> {
  const ids = [...new Set(taskIds)];
  if (ids.length > MAX_PRIORITIES)
    return { ok: false, error: `Trois priorités au plus : retirez-en ${ids.length - MAX_PRIORITIES}.` };
  const db = getDb();
  const valid = await db.task.count({
    where: { id: { in: ids }, archivedAt: null, status: OPEN_STATUSES, project: { archivedAt: null } },
  });
  if (valid !== ids.length) return { ok: false, error: "Une des tâches choisies n'est plus ouverte." };
  const day = todayDate(now);
  await db.$transaction([
    db.dailyPriority.deleteMany({ where: { userId, day } }),
    db.dailyPriority.createMany({
      data: ids.map((taskId, position) => ({ userId, day, taskId, position })),
    }),
  ]);
  return { ok: true, data: { count: ids.length } };
}

/** Projets actifs où l'associé est responsable ou a une tâche ouverte, avec la prochaine échéance. */
export async function myActiveProjects(userId: string) {
  const projects = await getDb().project.findMany({
    where: {
      archivedAt: null,
      internal: false,
      status: { notIn: ["TERMINE", "ARCHIVE"] },
      OR: [
        { ownerId: userId },
        { tasks: { some: { archivedAt: null, status: OPEN_STATUSES, ownerId: userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { name: true } },
      tasks: {
        where: { archivedAt: null, status: OPEN_STATUSES },
        select: { id: true, title: true, dueDate: true, status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return projects
    .map((p) => {
      const dated = p.tasks
        .filter((t) => t.dueDate)
        .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
      return {
        id: p.id,
        name: p.name,
        client: p.client?.name ?? null,
        status: p.status,
        open: p.tasks.length,
        blocked: p.tasks.filter((t) => t.status === "BLOQUE").length,
        next: dated[0] ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.blocked - a.blocked ||
        (a.next?.dueDate?.getTime() ?? Infinity) - (b.next?.dueDate?.getTime() ?? Infinity),
    );
}
