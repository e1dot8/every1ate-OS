import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { EventVisibility } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, formatDateTime } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { notify } from "@/features/notifications/service";
import { buildIcs, findConflicts, viewFor, type IcsEvent } from "@/features/calendar/rules";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const eventInclude = {
  attendees: { include: { user: { select: { id: true, name: true } } } },
  owner: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
} as const;

/** Événements qui chevauchent la période, vus par `viewerId` (occupé/libre si non partagés). */
export async function listEvents(from: Date, to: Date, viewerId: string, mineOnly: boolean) {
  const events = await getDb().calendarEvent.findMany({
    where: {
      cancelledAt: null,
      startsAt: { lt: to },
      endsAt: { gt: from },
      ...(mineOnly ? { OR: [{ ownerId: viewerId }, { attendees: { some: { userId: viewerId } } }] } : {}),
    },
    orderBy: { startsAt: "asc" },
    include: eventInclude,
  });
  return events.map((e) => viewFor({ ...e, attendeeIds: e.attendees.map((a) => a.userId) }, viewerId));
}

/** Échéances de tâches et jalons sur la période (affichés dans le calendrier). */
export async function listDeadlines(from: Date, to: Date, userId: string, mineOnly: boolean) {
  const db = getDb();
  const [tasks, milestones] = await Promise.all([
    db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { gte: from, lt: to },
        project: { archivedAt: null },
        ...(mineOnly ? { OR: [{ ownerId: userId }, { contributors: { some: { userId } } }] } : {}),
      },
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
    }),
    db.milestone.findMany({
      where: {
        archivedAt: null,
        date: { gte: from, lt: to },
        project: { archivedAt: null, ...(mineOnly ? { ownerId: userId } : {}) },
      },
      select: { id: true, name: true, date: true, projectId: true, project: { select: { name: true } } },
    }),
  ]);
  return { tasks, milestones };
}

export async function getEvent(id: string, viewerId: string) {
  const e = await getDb().calendarEvent.findUnique({ where: { id }, include: eventInclude });
  if (!e) return null;
  return viewFor({ ...e, attendeeIds: e.attendees.map((a) => a.userId) }, viewerId);
}

export type EventInput = {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  visibility: EventVisibility;
  attendeeIds: string[];
  projectId: string | null;
  clientId: string | null;
  opportunityId: string | null;
};

export type SaveEventResult =
  | { ok: true; id: string; conflicts: { id: string; title: string; when: string }[] }
  | {
      ok: false;
      error: string;
      concurrent?: {
        version: number;
        title: string;
        startsAt: string;
        endsAt: string;
        location: string | null;
        updatedAt: string;
      };
    };

async function overlapping(input: EventInput, ownerId: string, id: string | null) {
  const people = [...new Set([ownerId, ...input.attendeeIds])];
  const candidates = await getDb().calendarEvent.findMany({
    where: {
      cancelledAt: null,
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(id ? { id: { not: id } } : {}),
      OR: [{ ownerId: { in: people } }, { attendees: { some: { userId: { in: people } } } }],
    },
    include: { attendees: true },
  });
  return findConflicts(
    { id: id ?? "nouveau", startsAt: input.startsAt, endsAt: input.endsAt, people },
    candidates.map((c) => ({
      id: c.id,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      people: [c.ownerId, ...c.attendees.map((a) => a.userId)],
    })),
  ).map((c) => {
    const full = candidates.find((x) => x.id === c.id)!;
    const visible = viewFor({ ...full, attendeeIds: full.attendees.map((a) => a.userId) }, ownerId);
    return {
      id: c.id,
      title: visible.title,
      when: `${formatDateTime(full.startsAt)} → ${formatDateTime(full.endsAt)}`,
    };
  });
}

/**
 * Création ou modification. Les conflits d'agenda sont signalés (non bloquants).
 * Modification concurrente (version périmée) : refusée avec la version actuelle, sauf si
 * l'utilisateur choisit explicitement de conserver la sienne (`force`).
 */
export async function saveEvent(
  id: string | null,
  input: EventInput,
  version: number | null,
  force: boolean,
  actor: Actor,
): Promise<SaveEventResult> {
  const db = getDb();
  if (input.endsAt <= input.startsAt) return { ok: false, error: "La fin doit suivre le début." };
  const associates = await db.user.findMany({
    where: { role: "associe", id: { in: input.attendeeIds } },
    select: { id: true },
  });
  const attendeeIds = associates.map((a) => a.id).filter((u) => u !== actor.id);
  const data = { ...input, attendeeIds: undefined };
  delete data.attendeeIds;

  if (id) {
    const before = await db.calendarEvent.findUnique({ where: { id }, include: { attendees: true } });
    if (!before || before.cancelledAt) return { ok: false, error: "Événement introuvable." };
    if (before.ownerId !== actor.id && !before.attendees.some((a) => a.userId === actor.id))
      return { ok: false, error: "Seuls l'organisateur et les participants peuvent modifier cet événement." };
    if (!force && version !== before.version)
      return {
        ok: false,
        error: "Cet événement a été modifié entre-temps. Choisissez la version à conserver.",
        concurrent: {
          version: before.version,
          title: before.title,
          startsAt: before.startsAt.toISOString(),
          endsAt: before.endsAt.toISOString(),
          location: before.location,
          updatedAt: before.updatedAt.toISOString(),
        },
      };
    const updated = await db.calendarEvent.updateMany({
      where: { id, ...(force ? {} : { version: before.version }) },
      data: { ...data, version: { increment: 1 } },
    });
    if (!updated.count) return { ok: false, error: "Modification concurrente : rechargez l'événement." };
    const previous = new Set(before.attendees.map((a) => a.userId));
    await db.eventAttendee.deleteMany({ where: { eventId: id, userId: { notIn: attendeeIds } } });
    await db.eventAttendee.createMany({
      data: attendeeIds.map((userId) => ({ eventId: id, userId })),
      skipDuplicates: true,
    });
    const changes = diff(before, data);
    await recordAudit({
      action: "calendar.event_updated",
      actorId: actor.id,
      projectId: input.projectId,
      targetType: "event",
      targetId: id,
      ...changes,
      reason: force ? "Version conservée malgré une modification concurrente" : undefined,
    });
    for (const userId of attendeeIds.filter((u) => !previous.has(u))) await invite(userId, id, input, actor);
    return { ok: true, id, conflicts: await overlapping(input, actor.id, id) };
  }

  const event = await db.calendarEvent.create({
    data: { ...data, ownerId: actor.id, attendees: { create: attendeeIds.map((userId) => ({ userId })) } },
  });
  await recordAudit({
    action: "calendar.event_created",
    actorId: actor.id,
    projectId: input.projectId,
    targetType: "event",
    targetId: event.id,
    after: { title: event.title, startsAt: event.startsAt.toISOString() },
  });
  for (const userId of attendeeIds) await invite(userId, event.id, input, actor);
  return { ok: true, id: event.id, conflicts: await overlapping(input, actor.id, event.id) };
}

async function invite(userId: string, eventId: string, input: EventInput, actor: Actor) {
  const author = await getDb().user.findUnique({ where: { id: actor.id }, select: { name: true } });
  await notify({
    userId,
    kind: "action",
    title: `${author?.name ?? "Un associé"} vous invite : ${input.title}`,
    body: `${formatDateTime(input.startsAt)} → ${formatDateTime(input.endsAt)}${input.location ? ` · ${input.location}` : ""}`,
    href: `/calendrier/${eventId}`,
    projectId: input.projectId,
    dedupeKey: `invitation:${eventId}:${userId}`,
    email: true,
  });
}

export async function cancelEvent(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const e = await db.calendarEvent.findUnique({ where: { id }, include: { attendees: true } });
  if (!e || e.cancelledAt) return failed("Événement introuvable.");
  if (e.ownerId !== actor.id) return failed("Seul l'organisateur peut annuler l'événement.");
  await db.calendarEvent.update({
    where: { id },
    data: { cancelledAt: new Date(), version: { increment: 1 } },
  });
  await recordAudit({
    action: "calendar.event_cancelled",
    actorId: actor.id,
    projectId: e.projectId,
    targetType: "event",
    targetId: id,
    before: { title: e.title },
  });
  for (const a of e.attendees)
    await notify({
      userId: a.userId,
      kind: "planning",
      title: `Annulé : ${e.title}`,
      body: formatDateTime(e.startsAt),
      href: "/calendrier",
      dedupeKey: `annulation:${id}:${a.userId}`,
    });
  return done(null);
}

/** Prochains rendez-vous d'un associé (Mon espace). */
export async function upcomingEvents(userId: string, limit = 5) {
  const now = new Date();
  return getDb().calendarEvent.findMany({
    where: {
      cancelledAt: null,
      endsAt: { gt: now },
      startsAt: { lt: addDays(now, 14) },
      OR: [{ ownerId: userId }, { attendees: { some: { userId } } }],
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: { id: true, title: true, startsAt: true, location: true },
  });
}

// ─── Flux ICS personnel ─────────────────────────────────────────────────────

export async function getFeed(userId: string) {
  return getDb().calendarFeed.findUnique({ where: { userId } });
}

/** Crée ou renouvelle le flux : l'ancien lien cesse immédiatement de fonctionner. Le jeton n'est montré qu'une fois. */
export async function rotateFeed(actor: Actor, includeTasks: boolean): Promise<{ url: string }> {
  const token = randomBytes(32).toString("base64url");
  await getDb().calendarFeed.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, tokenHash: hashToken(token), includeTasks },
    update: {
      tokenHash: hashToken(token),
      includeTasks,
      createdAt: new Date(),
      lastAccessAt: null,
      accessCount: 0,
    },
  });
  await recordAudit({ action: "calendar.feed_rotated", actorId: actor.id, targetType: "calendar_feed" });
  return { url: `${getServerEnv().appUrl}/api/calendrier/${token}.ics` };
}

export async function deleteFeed(actor: Actor) {
  await getDb().calendarFeed.deleteMany({ where: { userId: actor.id } });
  await recordAudit({ action: "calendar.feed_deleted", actorId: actor.id, targetType: "calendar_feed" });
}

/** Contenu ICS d'un flux (lecture seule) : ses événements et, si choisi, ses échéances. */
export async function feedIcs(token: string): Promise<string | null> {
  const db = getDb();
  const feed = await db.calendarFeed.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!feed) return null;
  await db.calendarFeed.update({
    where: { id: feed.id },
    data: { lastAccessAt: new Date(), accessCount: { increment: 1 } },
  });
  const userId = feed.userId;
  const since = addDays(new Date(), -60);
  const base = getServerEnv().appUrl;
  const events = await db.calendarEvent.findMany({
    where: {
      cancelledAt: null,
      endsAt: { gt: since },
      OR: [{ ownerId: userId }, { attendees: { some: { userId } } }],
    },
    orderBy: { startsAt: "asc" },
  });
  const items: IcsEvent[] = events.map((e) => ({
    uid: `${e.id}@every1ate-os`,
    start: e.startsAt,
    end: e.endsAt,
    allDay: e.allDay,
    summary: e.title,
    description: e.description,
    location: e.location,
    url: `${base}/calendrier/${e.id}`,
    updated: e.updatedAt,
  }));
  if (feed.includeTasks) {
    const tasks = await db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { gte: since },
        OR: [{ ownerId: userId }, { contributors: { some: { userId } } }],
      },
      select: { id: true, title: true, dueDate: true, updatedAt: true, project: { select: { name: true } } },
    });
    for (const t of tasks)
      items.push({
        uid: `task-${t.id}@every1ate-os`,
        start: t.dueDate!,
        end: addDays(t.dueDate!, 1),
        allDay: true,
        summary: `Échéance : ${t.title}`,
        description: t.project.name,
        url: `${base}/taches/${t.id}`,
        updated: t.updatedAt,
      });
  }
  return buildIcs(`${feed.user.name} · Every1.ate OS`, items);
}
