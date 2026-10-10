import "server-only";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { crmForecast } from "@/features/crm/service";
import { periodRange, type Period } from "@/features/finance/calc";
import { financeOverview, listContracts } from "@/features/finance/service";

export type { Period };

/** Cockpit agence (§4.3) : prévisionnel et réalisé toujours séparés. */
export async function agencyCockpit(opts: { userId: string; team: boolean; period: Period }) {
  const db = getDb();
  const today = todayDate();
  const [from, to] = periodRange(opts.period, today);
  const mine = opts.team ? undefined : opts.userId;
  const projectWhere = {
    archivedAt: null,
    status: { notIn: ["TERMINE", "ARCHIVE"] as ("TERMINE" | "ARCHIVE")[] },
    ...(mine ? { ownerId: mine } : {}),
  };
  const taskOwner = mine ? { OR: [{ ownerId: mine }, { contributors: { some: { userId: mine } } }] } : {};

  const [
    projects,
    crm,
    dueTasks,
    followUps,
    billingDue,
    payments,
    costsCommitted,
    costsPaid,
    overview,
    contracts,
    associates,
    openTasks,
    time,
  ] = await Promise.all([
    db.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true, plannedEndDate: true },
    }),
    crmForecast(mine),
    db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { gte: from, lte: to },
        project: { archivedAt: null },
        ...taskOwner,
      },
      orderBy: { dueDate: "asc" },
      take: 15,
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
    }),
    db.opportunity.findMany({
      where: {
        archivedAt: null,
        stage: { notIn: ["GAGNE", "PERDU"] },
        nextActionDate: { lte: to },
        ...(mine ? { ownerId: mine } : {}),
      },
      orderBy: { nextActionDate: "asc" },
      take: 15,
      select: { id: true, title: true, nextAction: true, nextActionDate: true },
    }),
    db.billingMilestone.findMany({
      where: {
        archivedAt: null,
        status: { not: "ANNULE" },
        plannedDate: { gte: from, lte: to },
        project: projectWhere,
      },
      select: { amount: true },
    }),
    db.paymentRecord.findMany({
      where: { deletedAt: null, receivedAt: { gte: from, lte: to }, project: mine ? { ownerId: mine } : {} },
      select: { amount: true },
    }),
    db.costItem.findMany({
      where: {
        archivedAt: null,
        status: { in: ["ENGAGE", "FACTURE", "PAYE"] },
        committedAt: { gte: from, lte: to },
        project: mine ? { ownerId: mine } : {},
      },
      select: { amount: true },
    }),
    db.costItem.findMany({
      where: {
        archivedAt: null,
        status: "PAYE",
        paidAt: { gte: from, lte: to },
        project: mine ? { ownerId: mine } : {},
      },
      select: { amount: true },
    }),
    financeOverview(),
    listContracts(),
    db.user.findMany({
      where: { role: "associe", ...(mine ? { id: mine } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        project: { archivedAt: null },
        ownerId: { not: null },
      },
      select: { ownerId: true, estimatedMinutes: true, dueDate: true },
    }),
    db.timeEntry.groupBy({
      by: ["userId"],
      where: { deletedAt: null, date: { gte: from, lte: to } },
      _sum: { durationMinutes: true },
    }),
  ]);
  const total = (list: { amount: unknown }[]) => list.reduce((n, x) => n + toCents(x.amount as string), 0);
  const scopedOverview = mine
    ? overview.filter((o) => projects.some((p) => p.id === o.id))
    : overview.filter((o) => !["TERMINE", "ARCHIVE"].includes(o.status));
  return {
    range: [from, to] as [Date, Date],
    projects: {
      active: projects.length,
      late: projects.filter((p) => p.plannedEndDate && p.plannedEndDate < today).length,
      blocked: projects.filter((p) => p.status === "BLOQUE").length,
      list: projects,
    },
    crm: { gross: crm.gross, weighted: crm.weighted, proposals: crm.proposals, late: crm.lateIds.length },
    upcoming: { tasks: dueTasks, followUps },
    finance: {
      billingExpected: total(billingDue),
      collected: total(payments),
      costsCommitted: total(costsCommitted),
      costsPaid: total(costsPaid),
      marginForecast: scopedOverview.reduce((n, o) => n + o.summary.marginForecast, 0),
      marginActual: scopedOverview.reduce((n, o) => n + o.summary.marginActual, 0),
      mrr: contracts.mrr,
    },
    workload: associates.map((a) => {
      const tasks = openTasks.filter((t) => t.ownerId === a.id);
      return {
        ...a,
        openTasks: tasks.length,
        lateTasks: tasks.filter((t) => t.dueDate && t.dueDate < today).length,
        estimatedMinutes: tasks.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0),
        loggedMinutes: time.find((t) => t.userId === a.id)?._sum.durationMinutes ?? 0,
      };
    }),
  };
}
