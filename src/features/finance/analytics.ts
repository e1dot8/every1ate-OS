import "server-only";
/**
 * Analyses financières : rentabilité par modèle et par client, objectifs annuels.
 *
 * La première partie est pure (testée sans base) ; les chargeurs, regroupés en fin de fichier,
 * lisent la base en un nombre fixe de requêtes. Montants en centimes entiers, hors taxes.
 *
 * Définitions (reprises sur la page) :
 * - CA facturé de l'année : échéances non annulées au statut « Facturé » (ou déjà encaissées),
 *   datées dans l'année (date de facturation, à défaut date prévue), tous projets, archivés compris.
 * - Marge de l'année : ce CA facturé − les coûts engagés (Engagé, Reçu / facturé ou Payé) datés dans
 *   l'année (facture, à défaut paiement, échéance, puis engagement). Hors temps interne valorisé et
 *   hors charges fixes de l'agence.
 * - Projets de l'année : projets (archivés compris) dont la date de début (à défaut le démarrage
 *   réel, puis la création, jour de Paris) tombe dans l'année, au plus tard aujourd'hui.
 * - Rentabilité : par projet, cumul à date du facturé HT et des coûts engagés HT (non limité à
 *   l'année) ; « terminés » = projets clôturés dans l'année, « tous » = ceux-ci + les projets en
 *   cours ayant démarré au plus tard cette année-là.
 */
import { recordAudit, diff } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, daysBetween, todayDate } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";
import { marginRate, summarize, type BillingLine, type CostLine } from "@/features/finance/calc";
import { billingDate, costDate } from "@/features/finance/export";
import { loggedTimeCost, type RateOf } from "@/features/finance/time-cost";
import { getTemplate } from "@/features/projects/templates";
import { loadRates } from "@/features/settings/service";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

// ─── Paramètres de la page ──────────────────────────────────────────────────

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
export const SCOPES = ["termines", "tous"] as const;
export type AnalysisScope = (typeof SCOPES)[number];

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw)?.trim();

/** `?annee=AAAA` (2000 à 2100), sinon l'année par défaut. */
export function parseYear(raw: string | string[] | undefined, fallback: number): number {
  const v = first(raw);
  if (!v || !/^\d{4}$/.test(v)) return fallback;
  const year = Number(v);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : fallback;
}

/** `?portee=tous`, sinon « terminés » (la rentabilité d'un projet se lit une fois clôturé). */
export const parseScope = (raw: string | string[] | undefined): AnalysisScope =>
  first(raw) === "tous" ? "tous" : "termines";

/** Années proposées : les 3 précédentes, l'année en cours et la suivante (+ l'année affichée). */
export function yearChoices(current: number, selected: number): number[] {
  const years = new Set([current - 3, current - 2, current - 1, current, current + 1, selected]);
  return [...years].filter((y) => y >= MIN_YEAR && y <= MAX_YEAR).sort((a, b) => a - b);
}

// ─── Année calendaire ───────────────────────────────────────────────────────

/** 1er janvier et 31 décembre (dates calendrier, minuit UTC), bornes incluses. */
export function yearRange(year: number): [Date, Date] {
  return [new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31))];
}

const inYear = (date: Date | null, year: number) => !!date && date.getUTCFullYear() === year;

/**
 * Part de l'année écoulée, aujourd'hui compris (0 avant le 1er janvier, 1 après le 31 décembre) :
 * repère du rythme attendu sur les jauges.
 */
export function yearPace(year: number, today: Date): number {
  const [from, to] = yearRange(year);
  if (today < from) return 0;
  if (today > to) return 1;
  return (daysBetween(from, today) + 1) / (daysBetween(from, to) + 1);
}

// ─── Objectifs : réalisé de l'année ─────────────────────────────────────────

export type YearBilling = {
  amount: number;
  status: BillingLine["status"];
  invoicedAt: Date | null;
  plannedDate: Date | null;
  /** Total encaissé sur l'échéance (toutes dates). */
  paid: number;
};

/** CA facturé HT de l'année : facturé (ou encaissé), non annulé, daté dans l'année. */
export function invoicedInYear(billing: YearBilling[], year: number): number {
  return billing
    .filter(
      (b) => b.status !== "ANNULE" && (b.status === "FACTURE" || b.paid > 0) && inYear(billingDate(b), year),
    )
    .reduce((n, b) => n + b.amount, 0);
}

export type YearCost = {
  amount: number;
  status: CostLine["status"];
  invoiceDate: Date | null;
  paidAt: Date | null;
  dueDate: Date | null;
  committedAt: Date | null;
};

/** Statuts comptés comme coûts : engagés, reçus / facturés ou payés (ni prévus, ni annulés). */
export const COUNTED_COST_STATUSES = ["ENGAGE", "FACTURE", "PAYE"] as const;

/** Coûts engagés HT datés dans l'année. */
export function costsInYear(costs: YearCost[], year: number): number {
  return costs
    .filter(
      (c) => (COUNTED_COST_STATUSES as readonly string[]).includes(c.status) && inYear(costDate(c), year),
    )
    .reduce((n, c) => n + c.amount, 0);
}

export type ProjectDates = { startDate: Date | null; actualStartDate: Date | null; createdAt: Date };

/** Début d'un projet : date de début, à défaut démarrage réel, à défaut jour de création (Paris). */
export const projectStart = (p: ProjectDates): Date =>
  p.startDate ?? p.actualStartDate ?? todayDate(p.createdAt);

/**
 * Projets démarrés dans l'année, au plus tard aujourd'hui : un démarrage prévu plus tard dans
 * l'année n'est pas encore « démarré » (sinon la jauge serait atteinte dès janvier).
 */
export const projectsStartedInYear = (projects: ProjectDates[], year: number, today: Date) =>
  projects.filter((p) => {
    const start = projectStart(p);
    return inYear(start, year) && start <= today;
  }).length;

export type Objective = { revenue: number | null; margin: number | null; projectCount: number | null };

export type GaugeStatus = "atteint" | "non-atteint" | "dans-le-rythme" | "en-retard";

export type Gauge = {
  value: number;
  target: number | null;
  /** % de l'objectif (peut dépasser 100 ou être négatif) ; null sans objectif. */
  pct: number | null;
  /** Largeur de la barre, bornée entre 0 et 100. */
  barPct: number;
  status: GaugeStatus | null;
};

/** Jauge : avancement vers l'objectif comparé au rythme attendu (part de l'année écoulée). */
export function gauge(value: number, target: number | null, pace: number): Gauge {
  if (target == null || target <= 0) return { value, target: null, pct: null, barPct: 0, status: null };
  const ratio = value / target;
  const pct = Math.round(ratio * 100);
  const status: GaugeStatus =
    ratio >= 1 ? "atteint" : pace >= 1 ? "non-atteint" : ratio >= pace ? "dans-le-rythme" : "en-retard";
  return { value, target, pct, barPct: Math.min(100, Math.max(0, pct)), status };
}

export function objectiveProgress(input: {
  year: number;
  today: Date;
  objective: Objective | null;
  billing: YearBilling[];
  costs: YearCost[];
  projects: ProjectDates[];
}) {
  const { year, objective: o } = input;
  const pace = yearPace(year, input.today);
  const revenue = invoicedInYear(input.billing, year);
  const costs = costsInYear(input.costs, year);
  return {
    year,
    pace,
    objective: o,
    hasObjective: !!o && (o.revenue != null || o.margin != null || o.projectCount != null),
    costs,
    revenue: gauge(revenue, o?.revenue ?? null, pace),
    margin: gauge(revenue - costs, o?.margin ?? null, pace),
    projects: gauge(projectsStartedInYear(input.projects, year, input.today), o?.projectCount ?? null, pace),
  };
}

export type ObjectiveProgress = ReturnType<typeof objectiveProgress>;

// ─── Rentabilité ────────────────────────────────────────────────────────────

export type ScopedProject = ProjectDates & {
  status: string;
  closedAt: Date | null;
  actualEndDate: Date | null;
};

const FINISHED = ["TERMINE", "ARCHIVE"];

/** Jour de clôture (Paris) d'un projet terminé ; null s'il est en cours (ou rouvert). */
export function closedOn(p: ScopedProject): Date | null {
  if (!FINISHED.includes(p.status)) return null;
  return p.closedAt ? todayDate(p.closedAt) : p.actualEndDate;
}

/**
 * Projet retenu pour l'année : clôturé dans l'année ; avec la portée « tous », aussi en cours et
 * démarré au plus tard le 31 décembre. Un projet archivé sans clôture n'est rattaché à aucune année.
 */
export function inScope(p: ScopedProject, year: number, scope: AnalysisScope): boolean {
  const closed = closedOn(p);
  if (closed) return closed.getUTCFullYear() === year;
  if (scope === "termines" || FINISHED.includes(p.status)) return false;
  return projectStart(p) <= yearRange(year)[1];
}

export type ProfitInput = {
  key: string;
  label: string;
  /** Facturé HT à date. */
  revenue: number;
  /** Coûts engagés HT à date. */
  costs: number;
  /** Temps passé valorisé ; null si aucun coût horaire n'est défini ou si du temps n'en a pas. */
  timeCost: number | null;
  minutes: number;
  /** Satisfaction client à la clôture (1 à 5). */
  satisfaction: number | null;
};

export type ProfitRow = {
  key: string;
  label: string;
  projects: number;
  revenue: number;
  costs: number;
  margin: number;
  marginRate: number | null;
  /** null dès qu'un projet du groupe n'a pas tout son temps valorisé. */
  marginAfterTime: number | null;
  marginAfterTimeRate: number | null;
  /** Moyenne (une décimale) des notes renseignées ; null sans note. */
  satisfaction: number | null;
  ratings: number;
  minutes: number;
};

/**
 * Temps passé valorisé d'un projet ; null sans aucun coût horaire, ou si une partie du temps n'a
 * pas de taux (ni celui de l'associé, ni celui de l'agence) : la compter à 0 € surestimerait la
 * marge après temps.
 */
export function projectTimeCost(
  entries: { userId: string; minutes: number }[],
  rateOf: RateOf,
  anyRate: boolean,
): number | null {
  if (!anyRate) return null;
  const { cost, unvaluedMinutes } = loggedTimeCost(entries, rateOf);
  return unvaluedMinutes > 0 ? null : cost;
}

/** Regroupe par clé (modèle, client…) et trie par marge décroissante. */
export function groupProfitability(rows: ProfitInput[]): ProfitRow[] {
  const groups = new Map<string, ProfitInput[]>();
  for (const r of rows) groups.set(r.key, [...(groups.get(r.key) ?? []), r]);
  return [...groups.values()]
    .map((list) => {
      const sum = (f: (r: ProfitInput) => number) => list.reduce((n, r) => n + f(r), 0);
      const revenue = sum((r) => r.revenue);
      const margin = revenue - sum((r) => r.costs);
      const timeKnown = list.every((r) => r.timeCost != null);
      const marginAfterTime = timeKnown ? margin - sum((r) => r.timeCost ?? 0) : null;
      const rated = list.filter((r) => r.satisfaction != null);
      return {
        key: list[0].key,
        label: list[0].label,
        projects: list.length,
        revenue,
        costs: sum((r) => r.costs),
        margin,
        marginRate: marginRate(margin, revenue),
        marginAfterTime,
        marginAfterTimeRate: marginAfterTime == null ? null : marginRate(marginAfterTime, revenue),
        satisfaction: rated.length
          ? Math.round((rated.reduce((n, r) => n + (r.satisfaction ?? 0), 0) / rated.length) * 10) / 10
          : null,
        ratings: rated.length,
        minutes: sum((r) => r.minutes),
      };
    })
    .sort((a, b) => b.margin - a.margin || a.label.localeCompare(b.label, "fr"));
}

/** Ligne de total (null sans projet). */
export const totalProfitability = (rows: ProfitInput[]): ProfitRow | null =>
  rows.length ? groupProfitability(rows.map((r) => ({ ...r, key: "total", label: "Total" })))[0] : null;

export const NO_KEY = "_aucun";
export const templateLabel = (key: string | null) => (key ? (getTemplate(key)?.name ?? key) : "Sans modèle");

// ─── Lecture ────────────────────────────────────────────────────────────────

/** Avancement des objectifs de l'année, en quatre requêtes (bornées à l'année). */
export async function objectiveProgressFor(year: number, today = todayDate()): Promise<ObjectiveProgress> {
  const db = getDb();
  const [from, to] = yearRange(year);
  const range = { gte: from, lte: to };
  const [objective, billing, costs, projects] = await Promise.all([
    db.annualObjective.findUnique({ where: { year } }),
    db.billingMilestone.findMany({
      where: {
        archivedAt: null,
        status: { not: "ANNULE" },
        OR: [{ invoicedAt: range }, { invoicedAt: null, plannedDate: range }],
      },
      select: {
        amount: true,
        status: true,
        invoicedAt: true,
        plannedDate: true,
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    // Sur-ensemble (une des dates dans l'année), affiné par la date de rattachement.
    db.costItem.findMany({
      where: {
        archivedAt: null,
        status: { in: [...COUNTED_COST_STATUSES] },
        OR: [{ invoiceDate: range }, { paidAt: range }, { dueDate: range }, { committedAt: range }],
      },
      select: {
        amount: true,
        status: true,
        invoiceDate: true,
        paidAt: true,
        dueDate: true,
        committedAt: true,
      },
    }),
    db.project.findMany({
      where: {
        OR: [
          { startDate: range },
          { startDate: null, actualStartDate: range },
          // Création : marge d'un jour de chaque côté pour le décalage de Paris, affinée ensuite.
          {
            startDate: null,
            actualStartDate: null,
            createdAt: { gte: addDays(from, -1), lt: addDays(to, 2) },
          },
        ],
      },
      select: { startDate: true, actualStartDate: true, createdAt: true },
    }),
  ]);
  return objectiveProgress({
    year,
    today,
    objective: objective
      ? {
          revenue: objective.revenue == null ? null : toCents(objective.revenue),
          margin: objective.margin == null ? null : toCents(objective.margin),
          projectCount: objective.projectCount,
        }
      : null,
    billing: billing.map((b) => ({
      amount: toCents(b.amount),
      status: b.status,
      invoicedAt: b.invoicedAt,
      plannedDate: b.plannedDate,
      paid: b.payments.reduce((n, p) => n + toCents(p.amount), 0),
    })),
    costs: costs.map((c) => ({ ...c, amount: toCents(c.amount) })),
    projects,
  });
}

/**
 * Rentabilité des projets retenus pour l'année, par modèle et par client.
 * Deux allers-retours : les projets (champs légers), puis leurs chiffres groupés.
 */
export type Profitability = {
  byTemplate: ProfitRow[];
  byClient: ProfitRow[];
  total: ProfitRow | null;
  count: number;
  /** Au moins un coût horaire est défini : la marge après temps est calculable. */
  timeValued: boolean;
};

export async function profitabilityFor(
  year: number,
  scope: AnalysisScope,
  today = todayDate(),
): Promise<Profitability> {
  const db = getDb();
  const [all, { rateOf, anyRate }] = await Promise.all([
    db.project.findMany({
      select: {
        id: true,
        status: true,
        templateKey: true,
        clientId: true,
        client: { select: { name: true } },
        startDate: true,
        actualStartDate: true,
        actualEndDate: true,
        createdAt: true,
        closedAt: true,
        clientSatisfaction: true,
      },
    }),
    loadRates(),
  ]);
  const projects = all.filter((p) => inScope(p, year, scope));
  const ids = projects.map((p) => p.id);
  if (!ids.length) return { byTemplate: [], byClient: [], total: null, count: 0, timeValued: anyRate };
  const [billing, payments, costs, time] = await Promise.all([
    db.billingMilestone.findMany({
      where: { projectId: { in: ids }, archivedAt: null },
      select: { id: true, projectId: true, amount: true, status: true, plannedDate: true },
    }),
    db.paymentRecord.findMany({
      where: { projectId: { in: ids }, deletedAt: null },
      select: { projectId: true, amount: true, billingMilestoneId: true },
    }),
    db.costItem.findMany({
      where: { projectId: { in: ids }, archivedAt: null },
      select: { projectId: true, amount: true, status: true, rebillable: true },
    }),
    db.timeEntry.groupBy({
      by: ["projectId", "userId"],
      where: { projectId: { in: ids }, deletedAt: null },
      _sum: { durationMinutes: true },
    }),
  ]);
  const byProject = <T extends { projectId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.projectId, [...(m.get(x.projectId) ?? []), x]);
    return m;
  };
  const [bill, pay, cost, logged] = [
    byProject(billing),
    byProject(payments),
    byProject(costs),
    byProject(time),
  ];
  const inputs = projects.map((p) => {
    const s = summarize({
      budget: null,
      initial: null,
      costs: (cost.get(p.id) ?? []).map((c) => ({ ...c, amount: toCents(c.amount) })),
      billing: (bill.get(p.id) ?? []).map((b) => ({ ...b, amount: toCents(b.amount) })),
      payments: (pay.get(p.id) ?? []).map((x) => ({ ...x, amount: toCents(x.amount) })),
      today,
    });
    const entries = (logged.get(p.id) ?? []).map((t) => ({
      userId: t.userId,
      minutes: t._sum.durationMinutes ?? 0,
    }));
    return {
      project: p,
      figures: {
        revenue: s.billingInvoiced,
        costs: s.costsCommitted,
        timeCost: projectTimeCost(entries, rateOf, anyRate),
        minutes: entries.reduce((n, e) => n + e.minutes, 0),
        satisfaction: p.clientSatisfaction,
      },
    };
  });
  const byTemplate = inputs.map(({ project: p, figures }) => ({
    ...figures,
    key: p.templateKey ?? NO_KEY,
    label: templateLabel(p.templateKey),
  }));
  const byClient = inputs.map(({ project: p, figures }) => ({
    ...figures,
    key: p.clientId ?? NO_KEY,
    label: p.client?.name ?? "Sans client",
  }));
  return {
    byTemplate: groupProfitability(byTemplate),
    byClient: groupProfitability(byClient),
    total: totalProfitability(byTemplate),
    count: projects.length,
    timeValued: anyRate,
  };
}

// ─── Écriture ───────────────────────────────────────────────────────────────

export type ObjectiveInput = { year: number } & Objective;

const positiveInt = (v: number | null, max: number) =>
  v == null || (Number.isInteger(v) && v > 0 && v <= max);

/** Objectifs d'une année (création ou mise à jour), journalisés : « finance.objective ». */
export async function saveObjective(
  input: ObjectiveInput,
  actor: Actor,
): Promise<ServiceResult<{ year: number }>> {
  if (!Number.isInteger(input.year) || input.year < MIN_YEAR || input.year > MAX_YEAR)
    return failed("Année invalide.");
  if (!positiveInt(input.revenue, 999_999_999_999) || !positiveInt(input.margin, 999_999_999_999))
    return failed("Montant invalide.");
  if (!positiveInt(input.projectCount, 9999)) return failed("Nombre de projets invalide.");
  const db = getDb();
  const before = await db.annualObjective.findUnique({ where: { year: input.year } });
  const decimal = (v: { toString(): string } | null | undefined) =>
    v == null ? null : centsToDecimal(toCents(v));
  const data = {
    revenue: input.revenue == null ? null : centsToDecimal(input.revenue),
    margin: input.margin == null ? null : centsToDecimal(input.margin),
    projectCount: input.projectCount,
  };
  const changes = diff(
    {
      revenue: decimal(before?.revenue),
      margin: decimal(before?.margin),
      projectCount: before?.projectCount ?? null,
    },
    data,
  );
  if (before && !changes.changed) return done({ year: input.year });
  // Upsert natif (INSERT … ON CONFLICT) : deux enregistrements simultanés ne se gênent pas.
  await db.annualObjective.upsert({
    where: { year: input.year },
    create: { year: input.year, ...data },
    update: data,
  });
  await recordAudit({
    action: "finance.objective",
    actorId: actor.id,
    targetType: "annual_objective",
    targetId: String(input.year),
    before: before ? changes.before : undefined,
    after: { year: input.year, ...data },
  });
  return done({ year: input.year });
}
