import "server-only";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { notify } from "@/features/notifications/service";
import { planMove, suggestPriority } from "@/features/planning/rules";
import { postSubjectComment } from "@/features/discussions/subjects";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });
const DONE = ["TERMINE", "ANNULE"];

// ─── Roadmap ────────────────────────────────────────────────────────────────

export async function getRoadmap(projectId: string) {
  const db = getDb();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      phase: true,
      status: true,
      startDate: true,
      plannedEndDate: true,
      archivedAt: true,
    },
  });
  if (!project) return null;
  const [lots, tasks, milestones, edges] = await Promise.all([
    db.workPackage.findMany({
      where: { projectId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true, plannedStart: true, plannedEnd: true },
    }),
    db.task.findMany({
      where: { projectId, archivedAt: null },
      orderBy: [{ position: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        dueDate: true,
        workPackageId: true,
        owner: { select: { name: true } },
      },
    }),
    db.milestone.findMany({ where: { projectId, archivedAt: null }, orderBy: { date: "asc" } }),
    db.taskDependency.findMany({
      where: { task: { projectId } },
      select: { taskId: true, dependsOnId: true },
    }),
  ]);
  return { project, lots, tasks, milestones, edges };
}

export type MovePreview = Awaited<ReturnType<typeof previewMove>>;

export async function previewMove(taskId: string, start: Date, due: Date) {
  const db = getDb();
  const task = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return null;
  const [tasks, edges] = await Promise.all([
    db.task.findMany({
      where: { projectId: task.projectId, archivedAt: null },
      select: { id: true, title: true, startDate: true, dueDate: true, status: true },
    }),
    db.taskDependency.findMany({
      where: { task: { projectId: task.projectId } },
      select: { taskId: true, dependsOnId: true },
    }),
  ]);
  return planMove(
    tasks.map((t) => ({ ...t, done: DONE.includes(t.status) })),
    edges,
    taskId,
    start,
    due,
  );
}

/**
 * Persiste un déplacement de la roadmap. Les tâches suivantes ne bougent que si
 * l'utilisateur a confirmé la cascade proposée (§7.6). Tout est journalisé.
 */
export async function moveTask(
  taskId: string,
  start: Date,
  due: Date,
  applyCascade: boolean,
  actor: Actor,
): Promise<ServiceResult<{ moved: number; projectId: string }>> {
  if (due < start) return failed("L'échéance précède la date de début.");
  const db = getDb();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.archivedAt) return failed("Tâche introuvable.");
  const plan = await previewMove(taskId, start, due);
  const changes = [
    { id: taskId, title: task.title, from: [task.startDate, task.dueDate], to: [start, due] as [Date, Date] },
  ];
  if (applyCascade && plan) changes.push(...plan.cascade);
  await db.$transaction(
    changes.map((c) =>
      db.task.update({ where: { id: c.id }, data: { startDate: c.to[0], dueDate: c.to[1] } }),
    ),
  );
  for (const c of changes) {
    await recordAudit({
      action: "task.rescheduled",
      actorId: actor.id,
      projectId: task.projectId,
      targetType: "task",
      targetId: c.id,
      before: { startDate: c.from[0]?.toISOString() ?? null, dueDate: c.from[1]?.toISOString() ?? null },
      after: { startDate: c.to[0].toISOString(), dueDate: c.to[1].toISOString() },
      reason: c.id === taskId ? "Roadmap" : `Cascade depuis « ${task.title} »`,
    });
  }
  // Changement important de planning : prévenir les responsables concernés (§13.2).
  const affected = await db.task.findMany({
    where: { id: { in: changes.map((c) => c.id) }, ownerId: { not: null } },
    select: { id: true, title: true, ownerId: true, dueDate: true },
  });
  const stamp = Date.now();
  for (const t of affected) {
    if (t.ownerId === actor.id) continue;
    await notify({
      userId: t.ownerId!,
      kind: "planning",
      title: `Planning modifié : ${t.title}`,
      body: "Les dates de cette tâche ont changé sur la roadmap.",
      href: `/taches/${t.id}`,
      projectId: task.projectId,
      taskId: t.id,
      dedupeKey: `planning:${t.id}:${stamp}`,
    });
  }
  return done({ moved: changes.length, projectId: task.projectId });
}

// ─── Jalons ─────────────────────────────────────────────────────────────────

export type MilestoneInput = { name: string; date: Date; workPackageId: string | null; reached: boolean };

export async function saveMilestone(
  projectId: string,
  id: string | null,
  input: MilestoneInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({ where: { id: input.workPackageId, projectId } }))
  )
    return failed("Lot invalide.");
  const data = { name: input.name, date: input.date, workPackageId: input.workPackageId };
  if (id) {
    const before = await db.milestone.findFirst({ where: { id, projectId } });
    if (!before) return failed("Jalon introuvable.");
    const reachedAt = input.reached ? (before.reachedAt ?? new Date()) : null;
    const changes = diff(before, { ...data, reachedAt });
    await db.milestone.update({ where: { id }, data: { ...data, reachedAt } });
    if (changes.changed)
      await recordAudit({
        action: "project.milestone_updated",
        actorId: actor.id,
        projectId,
        targetType: "milestone",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const m = await db.milestone.create({
    data: { ...data, projectId, reachedAt: input.reached ? new Date() : null },
  });
  await recordAudit({
    action: "project.milestone_created",
    actorId: actor.id,
    projectId,
    targetType: "milestone",
    targetId: m.id,
    after: { name: m.name, date: m.date.toISOString() },
  });
  return done({ id: m.id });
}

export async function archiveMilestone(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const m = await db.milestone.findUnique({ where: { id } });
  if (!m) return failed("Jalon introuvable.");
  await db.milestone.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "project.milestone_archived",
    actorId: actor.id,
    projectId: m.projectId,
    targetType: "milestone",
    targetId: id,
    before: { name: m.name },
  });
  return done({ projectId: m.projectId });
}

export async function moveMilestone(
  id: string,
  date: Date,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const m = await db.milestone.findUnique({ where: { id } });
  if (!m || m.archivedAt) return failed("Jalon introuvable.");
  await db.milestone.update({ where: { id }, data: { date } });
  await recordAudit({
    action: "project.milestone_moved",
    actorId: actor.id,
    projectId: m.projectId,
    targetType: "milestone",
    targetId: id,
    before: { date: m.date.toISOString() },
    after: { date: date.toISOString() },
  });
  return done({ projectId: m.projectId });
}

// ─── Priorité suggérée ──────────────────────────────────────────────────────

export async function taskPrioritySuggestion(taskId: string) {
  const task = await getDb().task.findUnique({
    where: { id: taskId },
    include: { requiredBy: { select: { task: { select: { status: true } } } } },
  });
  if (!task) return null;
  return suggestPriority({
    impact: task.impact,
    dueDate: task.dueDate,
    today: todayDate(),
    blockingCount: task.requiredBy.filter((r) => !DONE.includes(r.task.status)).length,
    done: DONE.includes(task.status),
  });
}

// ─── Commentaires ───────────────────────────────────────────────────────────

/**
 * Commentaire sur une tâche (appelants V1 : données de démonstration). Depuis la V1.3, il est
 * publié dans la discussion de la tâche (fil du salon du projet) : plus rien n'est écrit dans
 * l'ancienne table des commentaires, reprise par `moveLegacyTaskComments`.
 */
export async function addComment(
  taskId: string,
  body: string,
  actor: Actor & { name?: string },
): Promise<ServiceResult<null>> {
  const result = await postSubjectComment(actor, { type: "task", id: taskId }, { body });
  return result.ok ? done(null) : failed(result.error);
}
