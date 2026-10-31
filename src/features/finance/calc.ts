/**
 * Calculs financiers de gestion (§10), en centimes entiers. Fonctions pures, testées.
 * Rappel : prévu ≠ engagé ≠ facturé ≠ payé ; attendu ≠ facturé ≠ encaissé ;
 * budget ≠ trésorerie ; refacturable ≠ marge.
 */
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";

export type CostLine = {
  amount: number;
  status: "PREVU" | "ENGAGE" | "FACTURE" | "PAYE" | "ANNULE";
  rebillable: boolean;
  workPackageId?: string | null;
};
export type BillingLine = {
  id: string;
  amount: number;
  status: "ATTENDU" | "FACTURE" | "ANNULE";
  plannedDate: Date | null;
  workPackageId?: string | null;
};
export type PaymentLine = { amount: number; billingMilestoneId: string | null };
export type Budget = { revenue: number; cost: number } | null;

export type BillingState =
  "ATTENDU" | "FACTURE" | "PARTIELLEMENT_ENCAISSE" | "ENCAISSE" | "EN_RETARD" | "ANNULE";

export const billingStateLabels: Record<BillingState, string> = {
  ATTENDU: "Attendu",
  FACTURE: "Facturé",
  PARTIELLEMENT_ENCAISSE: "Partiellement encaissé",
  ENCAISSE: "Encaissé",
  EN_RETARD: "En retard",
  ANNULE: "Annulé",
};

/** Statut affiché d'une échéance : le statut saisi complété par les encaissements et la date. */
export function billingState(
  m: Pick<BillingLine, "amount" | "status" | "plannedDate">,
  paid: number,
  today: Date,
): BillingState {
  if (m.status === "ANNULE") return "ANNULE";
  if (m.amount > 0 && paid >= m.amount) return "ENCAISSE";
  if (paid > 0) return "PARTIELLEMENT_ENCAISSE";
  if (m.plannedDate && m.plannedDate < today) return "EN_RETARD";
  return m.status;
}

const sum = <T>(list: T[], f: (x: T) => number) => list.reduce((n, x) => n + f(x), 0);

export type FinanceSummary = ReturnType<typeof summarize>;

/**
 * Synthèse d'un projet ou d'un lot.
 * - Coûts prévisionnels = max(budget de coûts, lignes non annulées) : un coût engagé pèse
 *   sur la marge prévisionnelle dès son engagement, sans attendre le paiement.
 * - Marge prévisionnelle = revenus prévus − coûts prévisionnels.
 * - Marge réelle = facturation réalisée − coûts réels (reçus/facturés ou payés).
 */
export function summarize(input: {
  budget: Budget;
  initial: Budget;
  costs: CostLine[];
  billing: BillingLine[];
  payments: PaymentLine[];
  today: Date;
  /**
   * Temps valorisé au coût horaire interne (centimes) ; null si aucun taux n'est défini.
   * `unvaluedMinutes` / `plannedUnvaluedMinutes` : minutes passées / prévues sans aucun taux
   * (ni celui de l'associé, ni celui de l'agence) ; la valorisation est alors partielle.
   */
  time?: {
    logged: number | null;
    planned: number | null;
    unvaluedMinutes?: number;
    plannedUnvaluedMinutes?: number;
  };
}) {
  const live = input.costs.filter((c) => c.status !== "ANNULE");
  const costsPlanned = sum(live, (c) => c.amount);
  const costsCommitted = sum(
    live.filter((c) => c.status !== "PREVU"),
    (c) => c.amount,
  );
  const costsActual = sum(
    live.filter((c) => c.status === "FACTURE" || c.status === "PAYE"),
    (c) => c.amount,
  );
  const costsPaid = sum(
    live.filter((c) => c.status === "PAYE"),
    (c) => c.amount,
  );
  const rebillable = sum(
    live.filter((c) => c.rebillable),
    (c) => c.amount,
  );

  const paidBy = new Map<string, number>();
  for (const p of input.payments)
    if (p.billingMilestoneId)
      paidBy.set(p.billingMilestoneId, (paidBy.get(p.billingMilestoneId) ?? 0) + p.amount);
  const billingLive = input.billing.filter((b) => b.status !== "ANNULE");
  const billingExpected = sum(billingLive, (b) => b.amount);
  const billingInvoiced = sum(
    billingLive.filter((b) => b.status === "FACTURE" || (paidBy.get(b.id) ?? 0) > 0),
    (b) => b.amount,
  );
  const collected = sum(input.payments, (p) => p.amount);
  const lateBilling = billingLive.filter(
    (b) => billingState(b, paidBy.get(b.id) ?? 0, input.today) === "EN_RETARD",
  );

  const revenuePlanned = input.budget?.revenue || billingExpected;
  const forecastCost = Math.max(input.budget?.cost ?? 0, costsPlanned);
  // Temps partiellement valorisé (minutes sans taux) : le coût du temps n'est qu'un minimum, les
  // marges après temps seraient surestimées ; elles ne sont donc pas calculées.
  const t = input.time;
  const valued = t?.logged != null;
  const timeUnvaluedMinutes = valued ? (t?.unvaluedMinutes ?? 0) : 0;
  const timeForecastPartial = valued && (timeUnvaluedMinutes > 0 || (t?.plannedUnvaluedMinutes ?? 0) > 0);
  return {
    budgetRevenue: input.budget?.revenue ?? null,
    budgetCost: input.budget?.cost ?? null,
    initialRevenue: input.initial?.revenue ?? null,
    initialCost: input.initial?.cost ?? null,
    revenuePlanned,
    costsPlanned,
    costsCommitted,
    costsActual,
    costsPaid,
    remainingToPay: costsCommitted - costsPaid,
    rebillable,
    billingExpected,
    billingInvoiced,
    collected,
    lateBillingCount: lateBilling.length,
    forecastCost,
    marginForecast: revenuePlanned - forecastCost,
    marginActual: billingInvoiced - costsActual,
    // Temps : coût interne des heures (prévues ou passées, la plus grande des deux) — n'est ni un
    // décaissement fournisseur ni un montant facturable.
    timeCostLogged: input.time?.logged ?? null,
    /** Minutes passées sans coût horaire (0 si tout est valorisé ou si aucun taux n'est défini). */
    timeUnvaluedMinutes,
    /** Temps passé ou prévu en partie sans coût horaire : « Temps prévu valorisé » est un minimum. */
    timeForecastPartial,
    timeCostForecast:
      input.time && input.time.logged != null ? Math.max(input.time.logged, input.time.planned ?? 0) : null,
    marginForecastAfterTime:
      input.time && input.time.logged != null && !timeForecastPartial
        ? revenuePlanned - forecastCost - Math.max(input.time.logged, input.time.planned ?? 0)
        : null,
    marginActualAfterTime:
      input.time && input.time.logged != null && timeUnvaluedMinutes === 0
        ? billingInvoiced - costsActual - input.time.logged
        : null,
    budgetConsumedPct: input.budget?.cost ? Math.round((costsCommitted / input.budget.cost) * 100) : null,
  };
}

/** Taux de marge en % (une décimale), null si pas de revenu. */
export function marginRate(margin: number, revenue: number) {
  return revenue ? Math.round((margin / revenue) * 1000) / 10 : null;
}

// ─── Contrats récurrents ────────────────────────────────────────────────────

export type ContractLine = { monthlyAmount: number; status: string; startDate: Date; endDate: Date | null };

/** MRR contracté (§10.6) : somme mensuelle des contrats actifs à la date donnée. */
export function mrr(contracts: ContractLine[], today: Date) {
  return sum(
    contracts.filter(
      (c) => c.status === "ACTIF" && c.startDate <= today && (!c.endDate || c.endDate >= today),
    ),
    (c) => c.monthlyAmount,
  );
}

// ─── Gouvernance ────────────────────────────────────────────────────────────

export type GovernanceRules = {
  budgetOverrunPct: number | null;
  delayPct: number | null;
  delayMinDays: number | null;
};

/** Dépassement du budget de coûts par rapport au budget de référence (initial). */
export function budgetRuleTriggered(referenceCost: number | null, newCost: number, rules: GovernanceRules) {
  if (rules.budgetOverrunPct == null || !referenceCost)
    return { triggered: false, pct: null as number | null };
  const pct = Math.round(((newCost - referenceCost) / referenceCost) * 1000) / 10;
  return { triggered: pct > rules.budgetOverrunPct, pct };
}

/** Retard majeur : allongement en % de la durée initiale ET au moins N jours (si définis). */
export function delayRuleTriggered(
  start: Date | null,
  initialEnd: Date | null,
  newEnd: Date | null,
  rules: GovernanceRules,
) {
  if (!start || !initialEnd || !newEnd || newEnd <= initialEnd)
    return { triggered: false, days: 0, pct: null as number | null };
  if (rules.delayPct == null && rules.delayMinDays == null)
    return { triggered: false, days: daysBetween(initialEnd, newEnd), pct: null };
  const days = daysBetween(initialEnd, newEnd);
  const duration = Math.max(1, daysBetween(start, initialEnd));
  const pct = Math.round((days / duration) * 1000) / 10;
  const byPct = rules.delayPct == null || pct > rules.delayPct;
  const byDays = rules.delayMinDays == null || days >= rules.delayMinDays;
  return { triggered: byPct && byDays, days, pct };
}

export type Tally = {
  pour: number;
  contre: number;
  abstention: number;
  status: "OUVERTE" | "APPROUVEE" | "REFUSEE";
};

/**
 * Dépouillement : approuvée dès `required` avis « pour » ; refusée dès que l'approbation
 * devient impossible avec les votants restants. Règle exacte à confirmer (§14.2).
 */
export function tally(
  votes: { choice: "POUR" | "CONTRE" | "ABSTENTION" }[],
  required: number,
  eligible: number,
): Tally {
  const pour = votes.filter((v) => v.choice === "POUR").length;
  const contre = votes.filter((v) => v.choice === "CONTRE").length;
  const abstention = votes.filter((v) => v.choice === "ABSTENTION").length;
  const remaining = eligible - votes.length;
  const status = pour >= required ? "APPROUVEE" : pour + remaining < required ? "REFUSEE" : "OUVERTE";
  return { pour, contre, abstention, status };
}

// ─── Périodes du cockpit ────────────────────────────────────────────────────

export type Period = "semaine" | "mois" | "trimestre";

export function periodRange(period: Period, today: Date): [Date, Date] {
  if (period === "semaine") {
    const from = startOfWeek(today);
    return [from, addDays(from, 6)];
  }
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const first = period === "mois" ? m : m - (m % 3);
  const months = period === "mois" ? 1 : 3;
  return [new Date(Date.UTC(y, first, 1)), addDays(new Date(Date.UTC(y, first + months, 1)), -1)];
}
