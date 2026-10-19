/**
 * Trésorerie 13 semaines : règles pures qui transforment les saisies (échéances et
 * encaissements, coûts, contrats récurrents, charges fixes) en éléments datés pour
 * `cashForecast` (cash.ts). Montants en centimes entiers. Aucune dépendance à la base.
 */
import { addDays, addMonths } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import {
  cashForecast,
  type CashItem,
  type CashWeek,
  type Charge,
  type Contract,
} from "@/features/finance/cash";

export const TREASURY_WEEKS = 13;
/** Délai de paiement par défaut (30 jours après la facture) quand aucune date n'est saisie. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;

export type ChargeFrequency = Charge["frequency"];
export const CHARGE_FREQUENCIES = ["MENSUELLE", "TRIMESTRIELLE", "ANNUELLE"] as const;
export const chargeFrequencyLabels: Record<ChargeFrequency, string> = {
  MENSUELLE: "Mensuelle",
  TRIMESTRIELLE: "Trimestrielle",
  ANNUELLE: "Annuelle",
};
const MONTHS: Record<ChargeFrequency, number> = { MENSUELLE: 1, TRIMESTRIELLE: 3, ANNUELLE: 12 };

// ─── Liens vers les fiches sources ──────────────────────────────────────────

export const treasuryHref = {
  billing: (id: string) => `/finance/echeances/${id}`,
  cost: (id: string) => `/finance/couts/${id}`,
  contract: (id: string) => `/finance/contrats/${id}`,
  charge: (id: string) => `/finance/tresorerie/charges/${id}`,
};

export type ItemKind = "echeance" | "cout" | "contrat" | "charge";
export const itemKindLabels: Record<ItemKind, string> = {
  echeance: "Échéance",
  cout: "Coût",
  contrat: "Contrat",
  charge: "Charge fixe",
};

/** Nature d'un élément, déduite du lien vers sa fiche. */
export function itemKind(href: string | undefined): ItemKind | null {
  if (!href) return null;
  if (href.startsWith("/finance/echeances/")) return "echeance";
  if (href.startsWith("/finance/couts/")) return "cout";
  if (href.startsWith("/finance/contrats/")) return "contrat";
  if (href.startsWith("/finance/tresorerie/charges/")) return "charge";
  return null;
}

// ─── Entrées et sorties datées ──────────────────────────────────────────────

export type BillingRow = {
  id: string;
  label: string;
  projectName: string;
  amount: number;
  status: "ATTENDU" | "FACTURE" | "ANNULE";
  plannedDate: Date | null;
  invoicedAt: Date | null;
  /** Total encaissé sur cette échéance (centimes). */
  paid: number;
};

/**
 * Encaissements attendus : reste à encaisser (montant − encaissements) de chaque échéance
 * non annulée. Date : date prévue ; à défaut, facture + 30 jours ; sinon non datée.
 */
export function billingInflows(rows: BillingRow[]): CashItem[] {
  return rows.flatMap((b) => {
    if (b.status === "ANNULE") return [];
    const remaining = b.amount - b.paid;
    if (remaining <= 0) return [];
    const date = b.plannedDate ?? (b.invoicedAt ? addDays(b.invoicedAt, DEFAULT_PAYMENT_TERM_DAYS) : null);
    return [
      {
        label: `${b.label} · ${b.projectName}`,
        amount: remaining,
        date,
        href: treasuryHref.billing(b.id),
      },
    ];
  });
}

export type CostRow = {
  id: string;
  description: string;
  supplier: string | null;
  projectName: string;
  amount: number;
  status: "PREVU" | "ENGAGE" | "FACTURE" | "PAYE" | "ANNULE";
  dueDate: Date | null;
  invoiceDate: Date | null;
};

/**
 * Décaissements : coûts engagés ou reçus, pas encore payés. Les coûts seulement prévus,
 * payés ou annulés sont exclus. Date : échéance ; à défaut, facture + 30 jours ; sinon non datée.
 */
export function costOutflows(rows: CostRow[]): CashItem[] {
  return rows.flatMap((c) => {
    if (c.status !== "ENGAGE" && c.status !== "FACTURE") return [];
    if (c.amount <= 0) return [];
    const date = c.dueDate ?? (c.invoiceDate ? addDays(c.invoiceDate, DEFAULT_PAYMENT_TERM_DAYS) : null);
    const who = c.supplier ? `${c.supplier} — ` : "";
    return [
      {
        label: `${who}${c.description} · ${c.projectName}`,
        amount: c.amount,
        date,
        href: treasuryHref.cost(c.id),
      },
    ];
  });
}

/**
 * Occurrences d'un contrat ou d'une charge dans l'horizon. La règle de répétition reste
 * celle de cash.ts (appelée pour cette seule source) : on y ajoute seulement le lien.
 */
function occurrences(today: Date, href: string, source: { contract: Contract } | { charge: Charge }) {
  const f = cashForecast({
    today,
    startBalance: null,
    inflows: [],
    outflows: [],
    contracts: "contract" in source ? [source.contract] : [],
    charges: "charge" in source ? [source.charge] : [],
    weeks: TREASURY_WEEKS,
  });
  return f.weeks.flatMap((w) =>
    w.items.map(({ label, amount, date }): CashItem => ({ label, amount, date, href })),
  );
}

export type ContractRow = Contract & { id: string };
export type ChargeRow = Charge & { id: string };

/** Mensualités des contrats récurrents actifs (le jour du début de contrat, chaque mois). */
export function contractInflows(contracts: ContractRow[], today: Date): CashItem[] {
  return contracts.flatMap((c) => occurrences(today, treasuryHref.contract(c.id), { contract: c }));
}

/** Échéances des charges fixes (mensuelles, trimestrielles ou annuelles). */
export function chargeOutflows(charges: ChargeRow[], today: Date): CashItem[] {
  return charges.flatMap((c) => occurrences(today, treasuryHref.charge(c.id), { charge: c }));
}

/** Prévision complète à partir des lignes lues en base. */
export function treasuryForecast(input: {
  today: Date;
  startBalance: number | null;
  billing: BillingRow[];
  costs: CostRow[];
  contracts: ContractRow[];
  charges: ChargeRow[];
}) {
  return cashForecast({
    today: input.today,
    startBalance: input.startBalance,
    inflows: [...billingInflows(input.billing), ...contractInflows(input.contracts, input.today)],
    outflows: [...costOutflows(input.costs), ...chargeOutflows(input.charges, input.today)],
    contracts: [],
    charges: [],
    weeks: TREASURY_WEEKS,
  });
}

export type TreasuryForecast = ReturnType<typeof treasuryForecast>;

// ─── Charges fixes ──────────────────────────────────────────────────────────

/** Prochaine échéance à partir d'aujourd'hui (null si la charge est terminée). */
export function chargeNextDate(
  charge: Pick<Charge, "nextDate" | "endDate" | "frequency">,
  today: Date,
): Date | null {
  const step = MONTHS[charge.frequency];
  // Même ancrage que cash.ts : on ajoute k périodes à la date saisie (pas de dérive de jour).
  for (let k = 0; ; k++) {
    const d = addMonths(charge.nextDate, k * step);
    if (charge.endDate && d > charge.endDate) return null;
    if (d >= today) return d;
  }
}

/** Équivalent mensuel d'une charge, arrondi au centime. */
export function monthlyEquivalent(amount: number, frequency: ChargeFrequency): number {
  return Math.round(amount / MONTHS[frequency]);
}

/** Total mensuel des charges encore en cours. */
export function chargesMonthlyTotal(
  charges: Pick<Charge, "amount" | "nextDate" | "endDate" | "frequency">[],
  today: Date,
): number {
  return charges.reduce(
    (n, c) => (chargeNextDate(c, today) ? n + monthlyEquivalent(c.amount, c.frequency) : n),
    0,
  );
}

/** Contrôles métier d'une charge fixe (en plus du format, vérifié par le formulaire). */
export function chargeIssue(input: { amount: number; nextDate: Date; endDate: Date | null }): string | null {
  if (!(input.amount > 0)) return "Le montant doit être supérieur à 0.";
  if (input.endDate && input.endDate < input.nextDate)
    return "La fin ne peut pas précéder la prochaine échéance.";
  return null;
}

// ─── Solde bancaire ─────────────────────────────────────────────────────────

/** Comme parseMoney, mais accepte un signe moins (compte à découvert). */
export function parseSignedMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const sign = /^\s*[-−–]\s*/.exec(raw);
  const cents = parseMoney(sign ? raw.slice(sign[0].length) : raw);
  if (cents == null) return null;
  return sign && cents ? -cents : cents;
}

/** Ancienneté (en jours) au-delà de laquelle le solde saisi est signalé comme à mettre à jour. */
export const STALE_BALANCE_DAYS = 7;

// ─── Graphique ──────────────────────────────────────────────────────────────

/**
 * Géométrie du graphique, en % de la hauteur de chaque panneau :
 * - solde : barres de part et d'autre d'une ligne zéro (`zeroPct` depuis le bas) ;
 * - flux : entrées et sorties côte à côte, à la même échelle.
 */
export function chartGeometry(weeks: Pick<CashWeek, "inflow" | "outflow" | "balance">[]) {
  const round = (x: number) => Math.round(x * 10) / 10;
  const maxFlow = Math.max(0, ...weeks.flatMap((w) => [w.inflow, w.outflow])) || 1;
  const maxPos = Math.max(0, ...weeks.map((w) => w.balance));
  const maxNeg = Math.max(0, ...weeks.map((w) => -w.balance));
  const range = maxPos + maxNeg || 1;
  return {
    zeroPct: round((maxNeg / range) * 100),
    bars: weeks.map((w) => ({
      inflowPct: round((w.inflow / maxFlow) * 100),
      outflowPct: round((w.outflow / maxFlow) * 100),
      balancePct: round((Math.abs(w.balance) / range) * 100),
      negative: w.balance < 0,
    })),
  };
}

/** Résumé textuel du graphique (alternative accessible). */
export function chartSummary(
  f: Pick<
    TreasuryForecast,
    "weeks" | "hasStartBalance" | "totalIn" | "totalOut" | "endBalance" | "lowest" | "negativeWeeks"
  >,
  money: (cents: number) => string,
  day: (date: Date) => string,
): string {
  const start = f.weeks[0]?.start;
  // Séparateurs « ; » : les dates abrégées (« 12 oct. ») finissent déjà par un point.
  const parts = [
    `Prévision de trésorerie sur ${f.weeks.length} semaines${start ? ` à partir du ${day(start)}` : ""}`,
    f.hasStartBalance
      ? `solde de départ ${money(f.endBalance - f.totalIn + f.totalOut)}`
      : "aucun solde de départ saisi, soldes relatifs (variation cumulée depuis zéro)",
    `encaissements ${money(f.totalIn)}, décaissements ${money(f.totalOut)}`,
    `point bas ${money(f.lowest.balance)} la semaine du ${day(f.lowest.week)}`,
    `solde en fin de période ${money(f.endBalance)}`,
    f.negativeWeeks
      ? `${f.negativeWeeks} semaine${f.negativeWeeks > 1 ? "s" : ""} sous zéro`
      : "aucune semaine sous zéro",
  ];
  return `${parts.join(" ; ")}.`;
}
