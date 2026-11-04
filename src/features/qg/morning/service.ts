import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { addDays, parseDateInput, todayDate } from "@/lib/dates";
import { dueFollowUps } from "@/features/crm/service";
import { endOfWeek } from "@/features/deliverables/rules";
import { createSystemMessage, ensureGeneralChannel } from "@/features/discussions/channels";
import { emitEvent } from "@/features/events/emit";
import { parisMidnight } from "@/features/qg/quests";
import {
  buildMorningReport,
  isMorningReportDue,
  parseReportData,
  renderReportText,
  reportWindow,
  summarizeStageMoves,
  type MorningFacts,
  type MorningReportData,
} from "@/features/qg/morning/rules";

/**
 * Le point du matin (V1.3) : chaque jour ouvré à 8 h (heure de Paris), le QG publie dans la
 * Salle commune ce qui a avancé, ce qui reste et ce qui coince, puis prévient chacun (dans l'app,
 * et push / WhatsApp selon ses réglages d'alertes). Un seul point par jour (date unique).
 */

const CLOSED_TASK = ["TERMINE", "ANNULE"] as ("TERMINE" | "ANNULE")[];
const ACTIVE_PROJECT = {
  archivedAt: null,
  status: { in: ["ACTIF", "EN_ATTENTE", "BLOQUE"] as ("ACTIF" | "EN_ATTENTE" | "BLOQUE")[] },
};
/** Garde-fou de volume : l'instantané n'en garde de toute façon qu'une partie. */
const TAKE = 500;
/** Lien de la page du point (message de la Salle commune, notification). */
export const MORNING_HREF = "/qg/point";

/**
 * Faits du point, en requêtes groupées (aucune requête par élément) : ce qui a avancé depuis le
 * dernier point, ce qui est prévu aujourd'hui, ce qui est en retard ou bloqué, les projets actifs,
 * les livrables de la semaine.
 */
export async function gatherMorningFacts(now = new Date()): Promise<MorningFacts> {
  const db = getDb();
  const window = reportWindow(now);
  const { today, from, to } = window;
  const sunday = endOfWeek(today);
  const dayStart = parisMidnight(today);
  const dayEnd = parisMidnight(addDays(today, 1));
  const inWindow = { gte: from, lt: to };
  const openTask = { archivedAt: null, status: { notIn: CLOSED_TASK }, project: { archivedAt: null } };
  const liveDeliverable = {
    archivedAt: null,
    stage: { not: "LIVRE" as const },
    project: { archivedAt: null },
  };

  const [
    doneTasks,
    stageEvents,
    delivered,
    won,
    newProjects,
    openTasks,
    deliverables,
    meetings,
    followUps,
    handoffs,
    projects,
    taskCounts,
    deliverableCounts,
    nextTaskDue,
    nextDeliverableDue,
  ] = await Promise.all([
    db.task.findMany({
      where: { status: "TERMINE", completedAt: inWindow, archivedAt: null, project: { archivedAt: null } },
      select: { id: true, title: true, project: { select: { name: true } } },
      orderBy: { completedAt: "asc" },
      take: TAKE,
    }),
    db.auditEvent.findMany({
      where: { action: "deliverable.stage_changed", targetType: "deliverable", createdAt: inWindow },
      select: { targetId: true, before: true, after: true },
      orderBy: { createdAt: "asc" },
      take: TAKE,
    }),
    db.deliverable.findMany({
      where: { stage: "LIVRE", deliveredAt: inWindow, archivedAt: null, project: { archivedAt: null } },
      select: { id: true, title: true, project: { select: { name: true } } },
      take: TAKE,
    }),
    db.opportunity.findMany({
      where: { stage: "GAGNE", closedAt: inWindow, archivedAt: null },
      select: { id: true, title: true, client: { select: { name: true } } },
      take: TAKE,
    }),
    db.project.findMany({
      where: { createdAt: inWindow, archivedAt: null },
      select: { id: true, name: true, client: { select: { name: true } } },
      take: TAKE,
    }),
    db.task.findMany({
      where: { ...openTask, OR: [{ dueDate: { lte: today } }, { status: "BLOQUE" }] },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        blockedReason: true,
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      take: TAKE,
    }),
    db.deliverable.findMany({
      where: {
        archivedAt: null,
        project: { archivedAt: null },
        OR: [
          { stage: { not: "LIVRE" }, OR: [{ dueDate: { lte: sunday } }, { blockedReason: { not: null } }] },
          { publishDate: today },
        ],
      },
      select: {
        id: true,
        title: true,
        stage: true,
        dueDate: true,
        publishDate: true,
        blockedReason: true,
        channel: true,
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      take: TAKE,
    }),
    // Réunions du jour : uniquement les événements partagés (jamais le détail d'un créneau privé).
    db.calendarEvent.findMany({
      where: { cancelledAt: null, visibility: "PARTAGE", startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { id: true, title: true, startsAt: true, allDay: true, project: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: TAKE,
    }),
    dueFollowUps(today),
    db.handoff.findMany({
      where: { status: "EN_ATTENTE" },
      select: {
        id: true,
        createdAt: true,
        task: {
          select: {
            id: true,
            title: true,
            archivedAt: true,
            project: { select: { name: true, archivedAt: true } },
          },
        },
        opportunity: {
          select: { id: true, title: true, archivedAt: true, client: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: TAKE,
    }),
    db.project.findMany({
      where: ACTIVE_PROJECT,
      select: { id: true, name: true, status: true, statusReason: true, client: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: TAKE,
    }),
    db.task.groupBy({
      by: ["projectId", "status"],
      where: { archivedAt: null, project: ACTIVE_PROJECT },
      _count: { _all: true },
    }),
    db.deliverable.groupBy({
      by: ["projectId"],
      where: { archivedAt: null, stage: { not: "LIVRE" }, project: ACTIVE_PROJECT },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["projectId"],
      where: {
        archivedAt: null,
        status: { notIn: CLOSED_TASK },
        dueDate: { gte: today },
        project: ACTIVE_PROJECT,
      },
      _min: { dueDate: true },
    }),
    db.deliverable.groupBy({
      by: ["projectId"],
      where: { ...liveDeliverable, dueDate: { gte: today }, project: ACTIVE_PROJECT },
      _min: { dueDate: true },
    }),
  ]);

  // Titres des livrables passés à l'étape suivante (une seule requête pour tous).
  const moves = summarizeStageMoves(stageEvents);
  const moved = moves.length
    ? await db.deliverable.findMany({
        where: { id: { in: moves.map((m) => m.id) }, archivedAt: null, project: { archivedAt: null } },
        select: { id: true, title: true, project: { select: { name: true } } },
      })
    : [];
  const movedById = new Map(moved.map((d) => [d.id, d]));

  const tasksOf = new Map<string, { done: number; total: number }>();
  for (const row of taskCounts) {
    const entry = tasksOf.get(row.projectId) ?? { done: 0, total: 0 };
    if (row.status !== "ANNULE") entry.total += row._count._all;
    if (row.status === "TERMINE") entry.done += row._count._all;
    tasksOf.set(row.projectId, entry);
  }
  const deliverablesOf = new Map(deliverableCounts.map((r) => [r.projectId, r._count._all]));
  const nextDueOf = new Map<string, Date>();
  for (const row of [...nextTaskDue, ...nextDeliverableDue]) {
    const due = row._min.dueDate;
    const current = nextDueOf.get(row.projectId);
    if (due && (!current || due < current)) nextDueOf.set(row.projectId, due);
  }

  return {
    window,
    doneTasks: doneTasks.map((t) => ({ id: t.id, title: t.title, project: t.project.name })),
    stageMoves: moves.flatMap((m) => {
      const d = movedById.get(m.id);
      return d ? [{ ...m, title: d.title, project: d.project.name }] : [];
    }),
    delivered: delivered.map((d) => ({ id: d.id, title: d.title, project: d.project.name })),
    won: won.map((o) => ({ id: o.id, title: o.title, client: o.client.name })),
    newProjects: newProjects.map((p) => ({ id: p.id, name: p.name, client: p.client?.name ?? null })),
    openTasks: openTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      blockedReason: t.blockedReason,
      owner: t.owner?.name ?? null,
      project: t.project.name,
    })),
    deliverables: deliverables.map((d) => ({
      id: d.id,
      title: d.title,
      stage: d.stage,
      dueDate: d.dueDate,
      publishDate: d.publishDate,
      blockedReason: d.blockedReason,
      channel: d.channel,
      owner: d.owner?.name ?? null,
      project: d.project.name,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      allDay: m.allDay,
      project: m.project?.name ?? null,
    })),
    followUps: followUps.map((o) => ({
      id: o.id,
      title: o.title,
      nextAction: o.nextAction,
      nextActionDate: o.nextActionDate,
    })),
    handoffs: handoffs.flatMap((h) => {
      const task =
        h.task && !h.task.archivedAt && !h.task.project.archivedAt
          ? { id: h.task.id, title: h.task.title, project: h.task.project.name }
          : null;
      const opportunity =
        h.opportunity && !h.opportunity.archivedAt
          ? { id: h.opportunity.id, title: h.opportunity.title, client: h.opportunity.client.name }
          : null;
      return task || opportunity ? [{ id: h.id, createdAt: h.createdAt, task, opportunity }] : [];
    }),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client?.name ?? null,
      status: p.status,
      statusReason: p.statusReason,
      tasksDone: tasksOf.get(p.id)?.done ?? 0,
      tasksTotal: tasksOf.get(p.id)?.total ?? 0,
      deliverablesInProgress: deliverablesOf.get(p.id) ?? 0,
      nextDue: nextDueOf.get(p.id) ?? null,
    })),
  };
}

/** Aperçu en direct (calculé maintenant, jamais enregistré ni envoyé). */
export async function previewMorningReport(now = new Date()): Promise<MorningReportData> {
  return buildMorningReport(await gatherMorningFacts(now));
}

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

/**
 * Message du QG dans la Salle commune, retours à la ligne conservés (le texte est déjà en
 * Markdown léger). Renvoie l'identifiant du message, ou null s'il n'a pas pu être publié.
 */
async function postToCommonRoom(text: string): Promise<string | null> {
  try {
    const channel = await ensureGeneralChannel();
    if (!channel || channel.archivedAt) return null;
    return await createSystemMessage({ channelId: channel.id, text, href: MORNING_HREF });
  } catch (error) {
    console.error("[point du matin] Salle commune", error);
    return null;
  }
}

async function publish(now: Date, force: boolean): Promise<boolean> {
  try {
    if (!force && !isMorningReportDue(now)) return false;
    const db = getDb();
    const today = todayDate(now);
    if (await db.morningReport.findUnique({ where: { date: today }, select: { id: true } })) return false;
    const report = await previewMorningReport(now);
    let reportId: string;
    try {
      // La date unique est le verrou : une seule publication par jour, même en parallèle.
      const created = await db.morningReport.create({
        data: { date: today, data: report as unknown as Prisma.InputJsonObject },
        select: { id: true },
      });
      reportId = created.id;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
    const messageId = await postToCommonRoom(renderReportText(report));
    if (messageId)
      await db.morningReport
        .update({ where: { id: reportId }, data: { messageId } })
        .catch((error) => console.error("[point du matin] lien du message", error));
    await emitEvent({
      kind: "point.matin",
      actorId: null,
      title: report.title,
      body: report.summary,
      href: MORNING_HREF,
      dedupeKey: `point-matin:${report.date}`,
      // Déjà publié ci-dessus, en entier.
      channelPost: false,
    });
    return true;
  } catch (error) {
    console.error("[point du matin] publication", error);
    return false;
  }
}

/**
 * Publie le point du jour s'il est dû (jour ouvré, 8 h passées à Paris) et pas encore publié.
 * Ne lève jamais (erreurs journalisées). Renvoie true si ce point vient d'être publié.
 */
export function publishMorningReport(now = new Date()): Promise<boolean> {
  return publish(now, false);
}

/** Publie le point du jour même hors horaire (données de démonstration). Jamais deux fois par jour. */
export function publishMorningReportNow(now = new Date()): Promise<boolean> {
  return publish(now, true);
}

// ─── Lecture ────────────────────────────────────────────────────────────────

export type StoredMorningReport = {
  id: string;
  date: Date;
  createdAt: Date;
  messageId: string | null;
  /** Null si l'instantané est illisible (format inconnu). */
  data: MorningReportData | null;
};

const toStored = (row: {
  id: string;
  date: Date;
  createdAt: Date;
  messageId: string | null;
  data: unknown;
}): StoredMorningReport => ({ ...row, data: parseReportData(row.data) });

/** Après un échec, la publication opportuniste attend un peu avant de réessayer. */
const RETRY_MS = 10 * 60_000;
let lastFailure = 0;

/**
 * Point du jour pour l'accueil et la page : une seule lecture par date ; s'il manque alors qu'il
 * est dû (la tâche planifiée n'a pas tourné), il est publié maintenant.
 */
export async function todayMorningReport(now = new Date()): Promise<StoredMorningReport | null> {
  const db = getDb();
  const date = todayDate(now);
  const row = await db.morningReport.findUnique({ where: { date } });
  if (row) return toStored(row);
  if (!isMorningReportDue(now) || now.getTime() - lastFailure < RETRY_MS) return null;
  if (!(await publishMorningReport(now))) {
    const raced = await db.morningReport.findUnique({ where: { date } });
    if (!raced) lastFailure = now.getTime();
    return raced ? toStored(raced) : null;
  }
  const created = await db.morningReport.findUnique({ where: { date } });
  return created ? toStored(created) : null;
}

/** Un point publié, par sa date (AAAA-MM-JJ). */
export async function getMorningReport(date: string): Promise<StoredMorningReport | null> {
  const day = parseDateInput(date);
  if (!day) return null;
  const row = await getDb().morningReport.findUnique({ where: { date: day } });
  return row ? toStored(row) : null;
}

/** Dates des derniers points publiés (le plus récent d'abord). */
export async function listMorningReports(take = 10) {
  return getDb().morningReport.findMany({
    orderBy: { date: "desc" },
    take,
    select: { id: true, date: true },
  });
}
