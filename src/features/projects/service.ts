import "server-only";
import type { Prisma, ProjectPhase, ProjectStatus, TaskStatus, Priority } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { CLOSURE_ITEMS, getTemplate } from "@/features/projects/templates";
import {
  TASK_DONE_STATES,
  checkProjectTransition,
  checkTaskTransition,
  findDependencyCycle,
  type RuleResult,
} from "@/features/projects/rules";

type Actor = { id: string };
export type ServiceResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });
const fromRule = (r: RuleResult) => (r.ok ? null : r.error);

// ─── Lectures ───────────────────────────────────────────────────────────────

export const userSelect = { id: true, name: true } as const;

export async function listAssociates() {
  return getDb().user.findMany({ where: { role: "associe" }, orderBy: { name: "asc" }, select: userSelect });
}

export async function listClients() {
  return getDb().client.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type ProjectFilter = {
  scope: "en-cours" | "termines" | "archives";
  mine?: string;
  phase?: ProjectPhase;
  q?: string;
};

export async function listProjects(filter: ProjectFilter) {
  const where: Prisma.ProjectWhereInput =
    filter.scope === "archives"
      ? { archivedAt: { not: null } }
      : filter.scope === "termines"
        ? { archivedAt: null, status: "TERMINE" }
        : { archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] } };
  if (filter.mine) where.ownerId = filter.mine;
  if (filter.phase) where.phase = filter.phase;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { client: { name: { contains: filter.q, mode: "insensitive" } } },
    ];
  }
  const projects = await getDb().project.findMany({
    where,
    orderBy: [{ plannedEndDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      client: { select: { name: true } },
      owner: { select: userSelect },
      tasks: { where: { archivedAt: null }, select: { status: true } },
    },
  });
  return projects.map((p) => ({
    ...p,
    taskTotal: p.tasks.filter((t) => t.status !== "ANNULE").length,
    taskDone: p.tasks.filter((t) => t.status === "TERMINE").length,
    taskBlocked: p.tasks.filter((t) => t.status === "BLOQUE").length,
  }));
}

export async function getProject(id: string) {
  return getDb().project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      owner: { select: userSelect },
      closureItems: { orderBy: { position: "asc" }, include: { checkedBy: { select: userSelect } } },
      workPackages: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        include: {
          owner: { select: userSelect },
          members: { include: { user: { select: userSelect } } },
          tasks: { where: { archivedAt: null }, select: { id: true, status: true } },
        },
      },
      tasks: {
        where: { archivedAt: null },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }],
        include: taskListInclude,
      },
    },
  });
}

export const taskListInclude = {
  owner: { select: userSelect },
  project: { select: { id: true, name: true } },
  workPackage: { select: { id: true, name: true } },
  dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
} satisfies Prisma.TaskInclude;

export async function getWorkPackage(projectId: string, lotId: string) {
  return getDb().workPackage.findFirst({
    where: { id: lotId, projectId },
    include: {
      project: { select: { id: true, name: true } },
      owner: { select: userSelect },
      members: { include: { user: { select: userSelect } } },
      tasks: {
        where: { archivedAt: null },
        orderBy: [{ position: "asc" }, { dueDate: "asc" }],
        include: taskListInclude,
      },
    },
  });
}

export async function getTask(id: string) {
  return getDb().task.findUnique({
    where: { id },
    include: {
      ...taskListInclude,
      contributors: { include: { user: { select: userSelect } } },
      requiredBy: { include: { task: { select: { id: true, title: true, status: true } } } },
    },
  });
}

export async function listTasksForUser(userId: string | null) {
  return getDb().task.findMany({
    where: {
      archivedAt: null,
      project: { archivedAt: null },
      status: { notIn: ["TERMINE", "ANNULE"] },
      ...(userId ? { OR: [{ ownerId: userId }, { contributors: { some: { userId } } }] } : {}),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: taskListInclude,
  });
}

export async function projectJournal(projectId: string) {
  const events = await getDb().auditEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const actors = await getDb().user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorId).filter(Boolean) as string[])] } },
    select: userSelect,
  });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return events.map((e) => ({ ...e, actorName: e.actorId ? (names.get(e.actorId) ?? "—") : "Système" }));
}

// ─── Création depuis un modèle ──────────────────────────────────────────────

export type NewProjectInput = {
  name: string;
  description?: string | null;
  clientId?: string | null;
  newClientName?: string | null;
  ownerId: string;
  templateKey: string;
  startDate: Date;
  plannedEndDate?: Date | null;
  lots: {
    name: string;
    tasks: { title: string; startDate: Date | null; dueDate: Date | null; after?: string | null }[];
  }[];
};

export async function createProject(
  input: NewProjectInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (!(await db.user.findFirst({ where: { id: input.ownerId, role: "associe" } })))
    return failed("Responsable global invalide.");
  if (!getTemplate(input.templateKey)) return failed("Modèle inconnu.");

  const project = await db.$transaction(async (tx) => {
    let clientId = input.clientId ?? null;
    if (!clientId && input.newClientName?.trim()) {
      clientId = (await tx.client.create({ data: { name: input.newClientName.trim() } })).id;
    }
    const lotEnds = input.lots.flatMap((l) => l.tasks.map((t) => t.dueDate?.getTime() ?? 0));
    const computedEnd = lotEnds.length ? new Date(Math.max(...lotEnds)) : null;
    const created = await tx.project.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        clientId,
        ownerId: input.ownerId,
        templateKey: input.templateKey,
        startDate: input.startDate,
        plannedEndDate:
          input.plannedEndDate ?? (computedEnd && computedEnd.getTime() > 0 ? computedEnd : null),
        createdById: actor.id,
        closureItems: { create: CLOSURE_ITEMS.map((c, i) => ({ key: c.key, label: c.label, position: i })) },
      },
    });
    let taskPosition = 0;
    for (const [lotIndex, lot] of input.lots.entries()) {
      const starts = lot.tasks.map((t) => t.startDate?.getTime()).filter(Boolean) as number[];
      const ends = lot.tasks.map((t) => t.dueDate?.getTime()).filter(Boolean) as number[];
      const wp = await tx.workPackage.create({
        data: {
          projectId: created.id,
          name: lot.name.trim(),
          position: lotIndex,
          plannedStart: starts.length ? new Date(Math.min(...starts)) : null,
          plannedEnd: ends.length ? new Date(Math.max(...ends)) : null,
        },
      });
      const byTitle = new Map<string, string>();
      for (const t of lot.tasks) {
        const task = await tx.task.create({
          data: {
            projectId: created.id,
            workPackageId: wp.id,
            title: t.title.trim(),
            startDate: t.startDate,
            dueDate: t.dueDate,
            position: taskPosition++,
            createdById: actor.id,
          },
        });
        byTitle.set(t.title, task.id);
      }
      // Dépendances du modèle (même lot ou lots précédents).
      for (const t of lot.tasks) {
        if (!t.after) continue;
        const predecessorId =
          byTitle.get(t.after) ??
          (await tx.task.findFirst({ where: { projectId: created.id, title: t.after } }))?.id;
        if (predecessorId)
          await tx.taskDependency.create({
            data: { taskId: byTitle.get(t.title)!, dependsOnId: predecessorId },
          });
      }
    }
    return created;
  });

  await recordAudit({
    action: "project.created",
    actorId: actor.id,
    projectId: project.id,
    targetType: "project",
    targetId: project.id,
    after: { name: project.name, ownerId: project.ownerId, templateKey: project.templateKey },
  });
  return done({ id: project.id });
}

// ─── Projet ─────────────────────────────────────────────────────────────────

export type ProjectUpdate = {
  name: string;
  description: string | null;
  clientId: string | null;
  phase: ProjectPhase;
  startDate: Date | null;
  plannedEndDate: Date | null;
};

export async function updateProject(
  id: string,
  input: ProjectUpdate,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const before = await db.project.findUnique({ where: { id } });
  if (!before || before.archivedAt) return failed("Projet introuvable.");
  if (input.startDate && input.plannedEndDate && input.plannedEndDate < input.startDate)
    return failed("La fin prévue précède le début.");
  const changes = diff(before, input);
  if (!changes.changed) return done(null);
  await db.project.update({ where: { id }, data: input });
  await recordAudit({
    action: "project.updated",
    actorId: actor.id,
    projectId: id,
    targetType: "project",
    targetId: id,
    ...changes,
  });
  return done(null);
}

export async function changeProjectStatus(
  id: string,
  to: ProjectStatus,
  reason: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const project = await db.project.findUnique({ where: { id }, include: { closureItems: true } });
  if (!project) return failed("Projet introuvable.");
  if (project.status === to) return done(null);
  const error = fromRule(
    checkProjectTransition(project.status, to, {
      reason,
      closureComplete: project.closureItems.length > 0 && project.closureItems.every((c) => c.checked),
      actorIsOwner: project.ownerId === actor.id,
    }),
  );
  if (error) return failed(error);
  const data: Prisma.ProjectUpdateInput = {
    status: to,
    statusReason: to === "BLOQUE" || to === "EN_ATTENTE" ? reason : null,
  };
  if (to === "ACTIF" && !project.actualStartDate) data.actualStartDate = new Date();
  if (to === "TERMINE")
    Object.assign(data, {
      closedAt: new Date(),
      closedById: actor.id,
      actualEndDate: project.actualEndDate ?? new Date(),
    });
  if (to === "ARCHIVE") data.archivedAt = new Date();
  if (project.status === "ARCHIVE") data.archivedAt = null;
  await db.project.update({ where: { id }, data });
  await recordAudit({
    action:
      to === "TERMINE"
        ? "project.closed"
        : to === "ARCHIVE"
          ? "project.archived"
          : project.status === "ARCHIVE"
            ? "project.restored"
            : "project.status_changed",
    actorId: actor.id,
    projectId: id,
    targetType: "project",
    targetId: id,
    before: { status: project.status },
    after: { status: to },
    reason: reason ?? undefined,
  });
  return done(null);
}

export async function changeProjectOwner(
  id: string,
  ownerId: string,
  reason: string,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const project = await db.project.findUnique({ where: { id } });
  if (!project || project.archivedAt) return failed("Projet introuvable.");
  if (!reason.trim()) return failed("Indiquez le motif du changement.");
  if (!(await db.user.findFirst({ where: { id: ownerId, role: "associe" } })))
    return failed("Responsable invalide.");
  if (project.ownerId === ownerId) return done(null);
  await db.project.update({ where: { id }, data: { ownerId } });
  await recordAudit({
    action: "project.owner_changed",
    actorId: actor.id,
    projectId: id,
    targetType: "project",
    targetId: id,
    before: { ownerId: project.ownerId },
    after: { ownerId },
    reason,
  });
  return done(null);
}

export async function toggleClosureItem(
  projectId: string,
  itemId: string,
  checked: boolean,
  note: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const item = await db.closureItem.findFirst({ where: { id: itemId, projectId } });
  if (!item) return failed("Élément introuvable.");
  await db.closureItem.update({
    where: { id: itemId },
    data: {
      checked,
      checkedAt: checked ? new Date() : null,
      checkedById: checked ? actor.id : null,
      note: note?.trim() || item.note,
    },
  });
  await recordAudit({
    action: "project.closure_item",
    actorId: actor.id,
    projectId,
    targetType: "closure_item",
    targetId: itemId,
    before: { checked: item.checked },
    after: { checked, label: item.label },
  });
  return done(null);
}

export async function saveClosingReview(
  projectId: string,
  review: string,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  await db.project.update({ where: { id: projectId }, data: { closingReview: review.trim() || null } });
  await recordAudit({
    action: "project.review_saved",
    actorId: actor.id,
    projectId,
    targetType: "project",
    targetId: projectId,
  });
  return done(null);
}

// ─── Lots ───────────────────────────────────────────────────────────────────

export type LotInput = {
  name: string;
  description: string | null;
  ownerId: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  memberIds: string[];
};

export async function saveWorkPackage(
  projectId: string,
  lotId: string | null,
  input: LotInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (input.plannedStart && input.plannedEnd && input.plannedEnd < input.plannedStart)
    return failed("La fin prévue précède le début.");
  if (lotId) {
    const before = await db.workPackage.findFirst({ where: { id: lotId, projectId } });
    if (!before) return failed("Lot introuvable.");
    const { memberIds, ...fields } = input;
    const changes = diff(before, fields);
    await db.workPackage.update({
      where: { id: lotId },
      data: { ...fields, members: { deleteMany: {}, create: memberIds.map((userId) => ({ userId })) } },
    });
    if (changes.changed)
      await recordAudit({
        action: "lot.updated",
        actorId: actor.id,
        projectId,
        targetType: "lot",
        targetId: lotId,
        ...changes,
      });
    return done({ id: lotId });
  }
  const position = await db.workPackage.count({ where: { projectId } });
  const { memberIds, ...fields } = input;
  const lot = await db.workPackage.create({
    data: { ...fields, projectId, position, members: { create: memberIds.map((userId) => ({ userId })) } },
  });
  await recordAudit({
    action: "lot.created",
    actorId: actor.id,
    projectId,
    targetType: "lot",
    targetId: lot.id,
    after: { name: lot.name },
  });
  return done({ id: lot.id });
}

/** Archive ou restaure un lot ou une tâche. Les projets passent par leur statut (Terminé → Archivé). */
export async function setArchived(
  kind: "lot" | "task",
  id: string,
  archived: boolean,
  actor: Actor,
): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const at = archived ? new Date() : null;
  let projectId: string;
  if (kind === "lot") {
    const l = await db.workPackage.update({ where: { id }, data: { archivedAt: at } });
    projectId = l.projectId;
  } else {
    const t = await db.task.update({ where: { id }, data: { archivedAt: at } });
    projectId = t.projectId;
  }
  await recordAudit({
    action:
      kind === "lot"
        ? `lot.${archived ? "archived" : "restored"}`
        : `task.${archived ? "archived" : "restored"}`,
    actorId: actor.id,
    projectId,
    targetType: kind,
    targetId: id,
  });
  return done({ projectId });
}

export async function listArchives() {
  const db = getDb();
  const [projects, lots, tasks] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, archivedAt: true, status: true },
    }),
    db.workPackage.findMany({
      where: { archivedAt: { not: null }, project: { archivedAt: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, archivedAt: true, project: { select: { id: true, name: true } } },
    }),
    db.task.findMany({
      where: { archivedAt: { not: null }, project: { archivedAt: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, title: true, archivedAt: true, project: { select: { id: true, name: true } } },
    }),
  ]);
  return { projects, lots, tasks };
}

// ─── Tâches ─────────────────────────────────────────────────────────────────

export type TaskInput = {
  title: string;
  description: string | null;
  workPackageId: string | null;
  ownerId: string | null;
  contributorIds: string[];
  priority: Priority;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
};

export async function saveTask(
  projectId: string,
  taskId: string | null,
  input: TaskInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (input.startDate && input.dueDate && input.dueDate < input.startDate)
    return failed("L'échéance précède la date de début.");
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({ where: { id: input.workPackageId, projectId } }))
  )
    return failed("Lot invalide.");
  const { contributorIds, ...fields } = input;
  if (taskId) {
    const before = await db.task.findFirst({ where: { id: taskId, projectId } });
    if (!before) return failed("Tâche introuvable.");
    const changes = diff(before, fields);
    await db.task.update({
      where: { id: taskId },
      data: {
        ...fields,
        contributors: {
          deleteMany: {},
          create: contributorIds.filter((u) => u !== fields.ownerId).map((userId) => ({ userId })),
        },
      },
    });
    if (changes.changed)
      await recordAudit({
        action: "task.updated",
        actorId: actor.id,
        projectId,
        targetType: "task",
        targetId: taskId,
        ...changes,
      });
    return done({ id: taskId });
  }
  const position = await db.task.count({ where: { projectId } });
  const task = await db.task.create({
    data: {
      ...fields,
      projectId,
      position,
      createdById: actor.id,
      contributors: {
        create: contributorIds.filter((u) => u !== fields.ownerId).map((userId) => ({ userId })),
      },
    },
  });
  await recordAudit({
    action: "task.created",
    actorId: actor.id,
    projectId,
    targetType: "task",
    targetId: task.id,
    after: { title: task.title, ownerId: task.ownerId },
  });
  return done({ id: task.id });
}

export async function changeTaskStatus(
  taskId: string,
  to: TaskStatus,
  details: { reason: string | null; nextAction: string | null; reviewDate: Date | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { dependsOn: { include: { dependsOn: true } } },
  });
  if (!task || task.archivedAt) return failed("Tâche introuvable.");
  if (task.status === to && to !== "BLOQUE") return done(null);
  const unfinished = task.dependsOn
    .filter((d) => !TASK_DONE_STATES.includes(d.dependsOn.status))
    .map((d) => `« ${d.dependsOn.title} »`);
  const error = fromRule(
    checkTaskTransition(task.status, to, { reason: details.reason, unfinishedPredecessors: unfinished }),
  );
  if (error) return failed(error);
  await db.task.update({
    where: { id: taskId },
    data: {
      status: to,
      blockedReason: to === "BLOQUE" ? details.reason : null,
      blockedNextAction: to === "BLOQUE" ? details.nextAction : null,
      blockedReviewDate: to === "BLOQUE" ? details.reviewDate : null,
      cancelReason: to === "ANNULE" ? details.reason : null,
      completedAt: to === "TERMINE" ? new Date() : null,
    },
  });
  await recordAudit({
    action: "task.status_changed",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "task",
    targetId: taskId,
    before: { status: task.status },
    after: { status: to },
    reason: details.reason ?? undefined,
  });
  return done(null);
}

export async function addDependency(
  taskId: string,
  dependsOnId: string,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const [task, other] = await Promise.all([
    db.task.findUnique({ where: { id: taskId } }),
    db.task.findUnique({ where: { id: dependsOnId } }),
  ]);
  if (!task || !other) return failed("Tâche introuvable.");
  if (task.projectId !== other.projectId) return failed("Les deux tâches doivent appartenir au même projet.");
  const edges = await db.taskDependency.findMany({
    where: { task: { projectId: task.projectId } },
    select: { taskId: true, dependsOnId: true },
  });
  if (edges.some((e) => e.taskId === taskId && e.dependsOnId === dependsOnId)) return done(null);
  const cycle = findDependencyCycle(edges, taskId, dependsOnId);
  if (cycle) {
    const titles = await db.task.findMany({
      where: { id: { in: cycle } },
      select: { id: true, title: true },
    });
    const name = new Map(titles.map((t) => [t.id, t.title]));
    return failed(`Boucle détectée : ${cycle.map((id) => name.get(id)).join(" → ")}.`);
  }
  await db.taskDependency.create({ data: { taskId, dependsOnId } });
  await recordAudit({
    action: "task.dependency_added",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "task",
    targetId: taskId,
    after: { dependsOn: other.title },
  });
  return done(null);
}

export async function removeDependency(
  taskId: string,
  dependsOnId: string,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const dep = await db.taskDependency.findUnique({
    where: { taskId_dependsOnId: { taskId, dependsOnId } },
    include: { task: true, dependsOn: true },
  });
  if (!dep) return done(null);
  await db.taskDependency.delete({ where: { id: dep.id } });
  await recordAudit({
    action: "task.dependency_removed",
    actorId: actor.id,
    projectId: dep.task.projectId,
    targetType: "task",
    targetId: taskId,
    before: { dependsOn: dep.dependsOn.title },
  });
  return done(null);
}
