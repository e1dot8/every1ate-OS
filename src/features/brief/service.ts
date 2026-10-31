import "server-only";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { utcToLocalInput, zonedToUtc } from "@/features/calendar/rules";
import { commercialSignals } from "@/features/crm/signals";
import { buildBrief } from "@/features/brief/rules";

const OPEN = ["TERMINE", "ANNULE"] as ("TERMINE" | "ANNULE")[];

/** Brief du jour d'un associé : ses retards, relances, réunions, avis attendus, encaissements en retard. */
export async function getBrief(userId: string, now = new Date()) {
  const db = getDb();
  const today = todayDate(now);
  const dayStart = zonedToUtc(`${today.toISOString().slice(0, 10)}T00:00`)!;
  const dayEnd = zonedToUtc(`${addDays(today, 1).toISOString().slice(0, 10)}T00:00`)!;
  const mine = { OR: [{ ownerId: userId }, { contributors: { some: { userId } } }] };
  const [tasks, followUps, meetings, decisions, billing, contracts] = await Promise.all([
    db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: OPEN },
        project: { archivedAt: null },
        AND: [mine, { OR: [{ dueDate: { lte: today } }, { status: "BLOQUE" }] }],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        blockedReason: true,
        project: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    db.opportunity.findMany({
      where: {
        ownerId: userId,
        archivedAt: null,
        stage: { notIn: ["GAGNE", "PERDU"] },
        nextActionDate: { lte: today },
      },
      select: { id: true, title: true, nextAction: true, nextActionDate: true },
      orderBy: { nextActionDate: "asc" },
    }),
    db.calendarEvent.findMany({
      where: {
        cancelledAt: null,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        OR: [{ ownerId: userId }, { attendees: { some: { userId } } }],
      },
      select: { id: true, title: true, startsAt: true, allDay: true },
      orderBy: { startsAt: "asc" },
    }),
    db.decisionRequest.findMany({
      where: { status: "OUVERTE", votes: { none: { userId } } },
      select: { id: true, title: true },
    }),
    db.billingMilestone.findMany({
      where: {
        archivedAt: null,
        status: { not: "ANNULE" },
        plannedDate: { lt: today },
        project: { ownerId: userId, archivedAt: null },
      },
      select: {
        id: true,
        label: true,
        amount: true,
        projectId: true,
        project: { select: { name: true } },
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    db.recurringContract.findMany({
      where: { status: "ACTIF", archivedAt: null },
      select: {
        id: true,
        label: true,
        status: true,
        renewalDate: true,
        endDate: true,
        noticeDays: true,
        client: { select: { name: true } },
      },
    }),
  ]);
  const renewals = commercialSignals({
    today,
    clients: [],
    closedProjects: [],
    contracts: contracts.map((c) => ({ ...c, clientName: c.client.name })),
  }).filter((s) => s.date && s.date <= addDays(today, 14));
  return buildBrief({
    overdueTasks: tasks
      .filter((t) => t.dueDate && t.dueDate < today)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, project: t.project.name })),
    dueToday: tasks
      .filter((t) => t.dueDate && t.dueDate.getTime() === today.getTime())
      .map((t) => ({ id: t.id, title: t.title, project: t.project.name })),
    blocked: tasks
      .filter((t) => t.status === "BLOQUE")
      .map((t) => ({ id: t.id, title: t.title, reason: t.blockedReason })),
    followUps: followUps.map((o) => ({
      id: o.id,
      title: o.title,
      nextAction: o.nextAction,
      late: !!o.nextActionDate && o.nextActionDate < today,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      time: m.allDay ? "Journée" : utcToLocalInput(m.startsAt).slice(11, 16),
    })),
    decisions,
    lateBilling: billing
      .filter((b) => b.payments.reduce((n, p) => n + toCents(p.amount), 0) < toCents(b.amount))
      .map((b) => ({ projectId: b.projectId, label: b.label, project: b.project.name })),
    renewals: renewals.map((r) => ({ href: r.href, title: r.title })),
  });
}
