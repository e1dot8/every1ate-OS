import "server-only";
import type { OverrunReason, TaskCategory, TaskComplexity } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import type { ServiceResult } from "@/features/projects/service";
import { entryMinutes } from "@/features/time/service";
import {
  estimateHint,
  hintKey,
  isClientTime,
  remaining,
  variance,
  type EstimateHint,
} from "@/features/time/estimate-rules";

type Actor = { id: string };

/**
 * Durées réelles des tâches terminées (12 derniers mois), groupées par catégorie et complexité.
 * Sert aux suggestions d'estimation : `hintKey(catégorie, complexité)` → minutes par tâche.
 */
export async function completedDurations(userId?: string): Promise<Map<string, number[]>> {
  const db = getDb();
  const since = addDays(todayDate(), -365);
  const sums = await db.timeEntry.groupBy({
    by: ["taskId"],
    where: {
      deletedAt: null,
      ...(userId ? { userId } : {}),
      task: { status: "TERMINE", complexity: { not: null }, completedAt: { gte: since } },
    },
    _sum: { durationMinutes: true },
  });
  const tasks = await db.task.findMany({
    where: { id: { in: sums.map((s) => s.taskId) } },
    select: { id: true, category: true, complexity: true },
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map<string, number[]>();
  for (const s of sums) {
    const t = byId.get(s.taskId);
    const minutes = s._sum.durationMinutes ?? 0;
    if (!t?.complexity || minutes <= 0) continue;
    const key = hintKey(t.category, t.complexity);
    out.set(key, [...(out.get(key) ?? []), minutes]);
  }
  return out;
}

/** Toutes les suggestions (équipe) pour le formulaire : clé `catégorie:complexité`. */
export async function estimateHints(): Promise<Record<string, EstimateHint>> {
  const durations = await completedDurations();
  const categories: TaskCategory[] = [
    "CLIENT",
    "AGENCE",
    "GESTION",
    "BRANDING",
    "APPRENTISSAGE",
    "ENTRAIDE",
    "RITUEL",
  ];
  const complexities: TaskComplexity[] = ["SIMPLE", "MOYENNE", "COMPLEXE"];
  const hints: Record<string, EstimateHint> = {};
  for (const c of categories)
    for (const x of complexities) hints[hintKey(c, x)] = estimateHint(x, durations.get(hintKey(c, x)) ?? []);
  return hints;
}

/** Temps d'une tâche : estimé, suivi, restant et écart. */
export async function taskTimeSummary(taskId: string) {
  const db = getDb();
  const [task, entries] = await Promise.all([
    db.task.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        ownerId: true,
        estimatedMinutes: true,
        remainingMinutes: true,
        overrunReason: true,
        overrunNote: true,
        overrunReviewedAt: true,
      },
    }),
    db.timeEntry.findMany({ where: { taskId, deletedAt: null } }),
  ]);
  if (!task) return null;
  const tracked = entries.reduce((n, e) => n + entryMinutes(e), 0);
  const v = variance(task.estimatedMinutes, tracked);
  return {
    ...task,
    tracked,
    remaining: remaining({ ...task, trackedMinutes: tracked }),
    variance: v,
    /** Le mini-bilan n'est proposé qu'une fois la tâche terminée, et jamais deux fois. */
    askReview: task.status === "TERMINE" && !!v?.overrun && !task.overrunReviewedAt,
  };
}

export async function setRemaining(
  taskId: string,
  minutes: number | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { remainingMinutes: true, archivedAt: true, projectId: true },
  });
  if (!task || task.archivedAt) return { ok: false, error: "Tâche introuvable." };
  if (minutes != null && (minutes < 0 || minutes > 1000 * 60)) return { ok: false, error: "Durée invalide." };
  await db.task.update({ where: { id: taskId }, data: { remainingMinutes: minutes } });
  await recordAudit({
    action: "task.remaining_updated",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "task",
    targetId: taskId,
    before: { remainingMinutes: task.remainingMinutes },
    after: { remainingMinutes: minutes },
  });
  return { ok: true, data: null };
}

/** Mini-bilan facultatif (ou « passer ») : pour mieux estimer la prochaine fois, jamais pour juger. */
export async function saveOverrunReview(
  taskId: string,
  input: { reason: OverrunReason | null; note: string | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { ownerId: true, projectId: true, status: true },
  });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (task.ownerId && task.ownerId !== actor.id)
    return { ok: false, error: "Seul le responsable de la tâche fait ce bilan." };
  await db.task.update({
    where: { id: taskId },
    data: { overrunReason: input.reason, overrunNote: input.note, overrunReviewedAt: new Date() },
  });
  await recordAudit({
    action: "task.overrun_reviewed",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "task",
    targetId: taskId,
    after: { reason: input.reason, note: input.note },
  });
  return { ok: true, data: null };
}

export type ReportScope = { userId: string | null; from: Date; to: Date };

/**
 * Rapport de temps sur une période : total, client vs interne, par catégorie, par projet
 * (prévu vs réel des tâches terminées dans la période), raisons d'écart, charge à venir.
 * `userId` null = la brigade entière, en totaux agrégés (aucun détail par personne).
 */
export async function timeReport({ userId, from, to }: ReportScope) {
  const db = getDb();
  const mine = userId ? { userId } : {};
  const entries = await db.timeEntry.findMany({
    where: { ...mine, deletedAt: null, date: { gte: from, lte: to } },
    select: {
      durationMinutes: true,
      startedAt: true,
      endedAt: true,
      projectId: true,
      task: { select: { category: true } },
    },
  });
  // Le temps porte l'identifiant du projet (sans relation) : noms lus en une requête.
  const projects = new Map(
    (
      await db.project.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.projectId))] } },
        select: { id: true, name: true, internal: true },
      })
    ).map((p) => [p.id, p]),
  );
  const byCategory = new Map<TaskCategory, number>();
  const byProject = new Map<string, { name: string; internal: boolean; tracked: number }>();
  let total = 0;
  let client = 0;
  for (const e of entries) {
    const m = entryMinutes(e);
    total += m;
    if (isClientTime(e.task.category)) client += m;
    byCategory.set(e.task.category, (byCategory.get(e.task.category) ?? 0) + m);
    const info = projects.get(e.projectId);
    const p = byProject.get(e.projectId) ?? {
      name: info?.name ?? "—",
      internal: !!info?.internal,
      tracked: 0,
    };
    p.tracked += m;
    byProject.set(e.projectId, p);
  }

  // Prévu vs réel : tâches terminées dans la période, avec une estimation.
  const finished = await db.task.findMany({
    where: {
      status: "TERMINE",
      estimatedMinutes: { not: null },
      completedAt: { gte: from, lt: addDays(to, 1) },
      // Les miennes : dont je suis responsable, ou sans responsable si j'y ai passé du temps.
      ...(userId
        ? { OR: [{ ownerId: userId }, { ownerId: null, timeEntries: { some: { userId, deletedAt: null } } }] }
        : {}),
    },
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      overrunReason: true,
      projectId: true,
      timeEntries: {
        where: { deletedAt: null },
        select: { durationMinutes: true, startedAt: true, endedAt: true },
      },
    },
  });
  const compared = finished.map((t) => {
    const actual = t.timeEntries.reduce((n, e) => n + entryMinutes(e), 0);
    return {
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      reason: t.overrunReason,
      v: variance(t.estimatedMinutes, actual)!,
    };
  });
  const planned = compared.reduce((n, c) => n + c.v.estimated, 0);
  const actual = compared.reduce((n, c) => n + c.v.actual, 0);
  const reasons = new Map<string, number>();
  for (const c of compared) if (c.reason) reasons.set(c.reason, (reasons.get(c.reason) ?? 0) + 1);

  // Charge à venir : restant des tâches ouvertes (saisi, sinon estimation − suivi).
  const open = await db.task.findMany({
    where: {
      archivedAt: null,
      status: { notIn: ["TERMINE", "ANNULE"] },
      project: { archivedAt: null },
      ...(userId ? { ownerId: userId } : {}),
    },
    select: {
      estimatedMinutes: true,
      remainingMinutes: true,
      timeEntries: {
        where: { deletedAt: null },
        select: { durationMinutes: true, startedAt: true, endedAt: true },
      },
    },
  });
  let upcoming = 0;
  let unestimated = 0;
  for (const t of open) {
    const r = remaining({ ...t, trackedMinutes: t.timeEntries.reduce((n, e) => n + entryMinutes(e), 0) });
    if (r == null) unestimated++;
    else upcoming += r;
  }

  return {
    total,
    client,
    internal: total - client,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    byProject: [...byProject.entries()]
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.tracked - a.tracked),
    compared: compared.sort((a, b) => Math.abs(b.v.absolute) - Math.abs(a.v.absolute)),
    planned,
    actual,
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
    upcoming,
    unestimated,
    openCount: open.length,
  };
}
