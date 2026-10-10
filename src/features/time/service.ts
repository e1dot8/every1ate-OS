import "server-only";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, startOfWeek, todayDate } from "@/lib/dates";
import { minutesBetween } from "@/features/planning/rules";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

const entryInclude = {
  task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
} as const;

export async function getActiveTimer(userId: string) {
  return getDb().timeEntry.findFirst({
    where: { userId, source: "TIMER", endedAt: null, deletedAt: null },
    include: entryInclude,
  });
}

export type StartResult =
  ServiceResult<{ id: string }> | { ok: false; error: string; conflict: { taskTitle: string } };

/**
 * Démarre un chronomètre. Si un autre tourne, refuse sauf confirmation explicite (`force`) :
 * l'ancien est alors arrêté dans la même transaction (§8).
 */
export async function startTimer(taskId: string, force: boolean, actor: Actor): Promise<StartResult> {
  const db = getDb();
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, archivedAt: true, title: true },
  });
  if (!task || task.archivedAt) return failed("Tâche introuvable.");
  const active = await getActiveTimer(actor.id);
  if (active?.taskId === taskId) return done({ id: active.id });
  if (active && !force)
    return {
      ok: false,
      error: `Un chronomètre tourne déjà sur « ${active.task.title} ».`,
      conflict: { taskTitle: active.task.title },
    };
  const now = new Date();
  const entry = await db.$transaction(async (tx) => {
    if (active) {
      await tx.timeEntry.update({
        where: { id: active.id },
        data: { endedAt: now, durationMinutes: minutesBetween(active.startedAt!, now) },
      });
    }
    return tx.timeEntry.create({
      data: {
        userId: actor.id,
        taskId,
        projectId: task.projectId,
        date: todayDate(now),
        startedAt: now,
        source: "TIMER",
      },
    });
  });
  if (active)
    await recordAudit({
      action: "time.timer_stopped",
      actorId: actor.id,
      projectId: active.projectId,
      targetType: "time_entry",
      targetId: active.id,
      after: { durationMinutes: minutesBetween(active.startedAt!, now) },
      reason: "Remplacé par un nouveau chronomètre",
    });
  await recordAudit({
    action: "time.timer_started",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "time_entry",
    targetId: entry.id,
    after: { task: task.title },
  });
  return done({ id: entry.id });
}

export async function stopTimer(actor: Actor): Promise<ServiceResult<{ minutes: number } | null>> {
  const active = await getActiveTimer(actor.id);
  if (!active) return done(null);
  const now = new Date();
  const minutes = minutesBetween(active.startedAt!, now);
  await getDb().timeEntry.update({
    where: { id: active.id },
    data: { endedAt: now, durationMinutes: minutes },
  });
  await recordAudit({
    action: "time.timer_stopped",
    actorId: actor.id,
    projectId: active.projectId,
    targetType: "time_entry",
    targetId: active.id,
    after: { durationMinutes: minutes },
  });
  return done({ minutes });
}

export type ManualEntry = { taskId: string; date: Date; minutes: number; comment: string | null };

function checkEntry(input: Omit<ManualEntry, "taskId">) {
  if (input.minutes < 1 || input.minutes > 24 * 60) return "Durée entre 1 minute et 24 heures.";
  if (input.date > addDays(todayDate(), 1)) return "Impossible de saisir du temps dans le futur.";
  return null;
}

export async function addManualEntry(
  input: ManualEntry,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const error = checkEntry(input);
  if (error) return failed(error);
  const db = getDb();
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    select: { projectId: true, archivedAt: true, title: true },
  });
  if (!task || task.archivedAt) return failed("Tâche introuvable.");
  const entry = await db.timeEntry.create({
    data: {
      userId: actor.id,
      taskId: input.taskId,
      projectId: task.projectId,
      date: input.date,
      durationMinutes: input.minutes,
      comment: input.comment,
      source: "MANUEL",
    },
  });
  await recordAudit({
    action: "time.entry_created",
    actorId: actor.id,
    projectId: task.projectId,
    targetType: "time_entry",
    targetId: entry.id,
    after: { task: task.title, durationMinutes: input.minutes, date: input.date.toISOString().slice(0, 10) },
  });
  return done({ id: entry.id });
}

/** Correction manuelle : seulement ses propres saisies terminées ; historique complet dans l'audit. */
export async function correctEntry(
  id: string,
  input: Omit<ManualEntry, "taskId"> & { reason: string | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.deletedAt || entry.userId !== actor.id) return failed("Saisie introuvable.");
  if (entry.source === "TIMER" && !entry.endedAt) return failed("Arrêtez le chronomètre avant de corriger.");
  const error = checkEntry(input);
  if (error) return failed(error);
  const changes = diff(entry, { date: input.date, durationMinutes: input.minutes, comment: input.comment });
  if (!changes.changed) return done(null);
  await db.timeEntry.update({
    where: { id },
    data: { date: input.date, durationMinutes: input.minutes, comment: input.comment },
  });
  await recordAudit({
    action: "time.entry_corrected",
    actorId: actor.id,
    projectId: entry.projectId,
    targetType: "time_entry",
    targetId: id,
    before: changes.before,
    after: changes.after,
    reason: input.reason ?? undefined,
  });
  return done(null);
}

export async function deleteEntry(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.deletedAt || entry.userId !== actor.id) return failed("Saisie introuvable.");
  await db.timeEntry.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      ...(entry.endedAt || entry.source === "MANUEL" ? {} : { endedAt: new Date() }),
    },
  });
  await recordAudit({
    action: "time.entry_deleted",
    actorId: actor.id,
    projectId: entry.projectId,
    targetType: "time_entry",
    targetId: id,
    before: { durationMinutes: entry.durationMinutes, date: entry.date.toISOString().slice(0, 10) },
  });
  return done(null);
}

export async function getEntry(id: string, userId: string) {
  return getDb().timeEntry.findFirst({ where: { id, userId, deletedAt: null }, include: entryInclude });
}

export async function entryHistory(id: string) {
  return getDb().auditEvent.findMany({
    where: { targetType: "time_entry", targetId: id },
    orderBy: { createdAt: "desc" },
  });
}

/** Saisies de l'utilisateur sur une période (dates calendrier incluses). */
export async function listEntries(userId: string, from: Date, to: Date) {
  return getDb().timeEntry.findMany({
    where: { userId, deletedAt: null, date: { gte: from, lte: to } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: entryInclude,
  });
}

/** Durée d'une saisie ; un chronomètre en cours compte jusqu'à maintenant. */
export function entryMinutes(
  e: { durationMinutes: number | null; startedAt: Date | null; endedAt: Date | null },
  now = new Date(),
) {
  if (e.durationMinutes != null) return e.durationMinutes;
  return e.startedAt && !e.endedAt ? minutesBetween(e.startedAt, now) : 0;
}

export async function userTotals(userId: string, now = new Date()) {
  const today = todayDate(now);
  const entries = await listEntries(userId, startOfWeek(today), today);
  const sum = (list: typeof entries) => list.reduce((n, e) => n + entryMinutes(e, now), 0);
  return { today: sum(entries.filter((e) => e.date.getTime() === today.getTime())), week: sum(entries) };
}

export async function taskTime(taskId: string) {
  const entries = await getDb().timeEntry.findMany({
    where: { taskId, deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, name: true } } },
  });
  return { entries, total: entries.reduce((n, e) => n + entryMinutes(e), 0) };
}

/** Tâches ouvertes sur lesquelles saisir du temps (projets actifs, tous associés). */
export async function listTasksForTime() {
  return getDb().task.findMany({
    where: {
      archivedAt: null,
      status: { not: "ANNULE" },
      project: { archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] } },
    },
    orderBy: [{ project: { updatedAt: "desc" } }, { position: "asc" }],
    select: { id: true, title: true, project: { select: { name: true } } },
    take: 1000,
  });
}
