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
  /** Encaissements reçus après la date du solde (inclus dans `paid`), pas encore dans le solde. */
  receivedSinceBalance?: { amount: number; date: Date }[];
};

// ─── Date du solde ──────────────────────────────────────────────────────────

/**
 * Premier jour compté par la prévision. Le solde saisi est arrêté en fin de journée : les
 * mouvements du jour du solde y sont déjà, ceux des jours suivants non. Sans date de solde
 * (ou sans solde), on part d'aujourd'hui. Une date future est ramenée à aujourd'hui.
 */
export function forecastFrom(balanceDate: Date | null, today: Date): Date {
  if (!balanceDate) return today;
  return addDays(balanceDate < today ? balanceDate : today, 1);
}

/**
 * Encaissements d'une échéance : total encaissé et, à part, ceux reçus après la date du solde
 * (déjà sur le compte mais pas dans le solde saisi). Sans date de solde, rien n'est mis à part.
 */
export function splitPayments(
  payments: { amount: number; receivedAt: Date }[],
  balanceDate: Date | null,
): Pick<BillingRow, "paid" | "receivedSinceBalance"> {
  return {
    paid: payments.reduce((n, p) => n + p.amount, 0),
    receivedSinceBalance: balanceDate
      ? payments
          .filter((p) => p.receivedAt > balanceDate && p.amount > 0)
          .map((p) => ({ amount: p.amount, date: p.receivedAt }))
      : [],
  };
}

/**
 * Encaissements attendus : reste à encaisser (montant − encaissements) de chaque échéance
 * non annulée. Date : date prévue ; à défaut, facture + 30 jours ; sinon non datée.
 * S'y ajoutent les encaissements reçus après la date du solde, à leur date de réception.
 */
export function billingInflows(rows: BillingRow[]): CashItem[] {
  return rows.flatMap((b) => {
    if (b.status === "ANNULE") return [];
    const label = `${b.label} · ${b.projectName}`;
    const href = treasuryHref.billing(b.id);
    const received = (b.receivedSinceBalance ?? []).map((p): CashItem => ({
      label,
      amount: p.amount,
      date: p.date,
      href,
      sinceBalance: true,
    }));
    const remaining = b.amount - b.paid;
    if (remaining <= 0) return received;
    const date = b.plannedDate ?? (b.invoicedAt ? addDays(b.invoicedAt, DEFAULT_PAYMENT_TERM_DAYS) : null);
    return [{ label, amount: remaining, date, href }, ...received];
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
  paidAt: Date | null;
};

/**
 * Décaissements : coûts engagés ou reçus, pas encore payés. Les coûts seulement prévus,
 * payés ou annulés sont exclus. Date : échéance ; à défaut, facture + 30 jours ; sinon non datée.
 * Exception : un coût payé après la date du solde (pas encore dans le solde) sort à sa date de paiement.
 */
export function costOutflows(rows: CostRow[], balanceDate: Date | null = null): CashItem[] {
  return rows.flatMap((c) => {
    if (c.amount <= 0) return [];
    const who = c.supplier ? `${c.supplier} — ` : "";
    const item = {
      label: `${who}${c.description} · ${c.projectName}`,
      amount: c.amount,
      href: treasuryHref.cost(c.id),
    };
    if (c.status === "PAYE")
      return balanceDate && c.paidAt && c.paidAt > balanceDate
        ? [{ ...item, date: c.paidAt, sinceBalance: true }]
        : [];
    if (c.status !== "ENGAGE" && c.status !== "FACTURE") return [];
    const date = c.dueDate ?? (c.invoiceDate ? addDays(c.invoiceDate, DEFAULT_PAYMENT_TERM_DAYS) : null);
    return [{ ...item, date }];
  });
}

/**
 * Occurrences d'un contrat ou d'une charge dans l'horizon. La règle de répétition reste
 * celle de cash.ts (appelée pour cette seule source) : on y ajoute seulement le lien.
 */
function occurrences(
  today: Date,
  from: Date,
  href: string,
  source: { contract: Contract } | { charge: Charge },
) {
  const f = cashForecast({
    today,
    from,
    startBalance: null,
    inflows: [],
    outflows: [],
    contracts: "contract" in source ? [source.contract] : [],
    charges: "charge" in source ? [source.charge] : [],
    weeks: TREASURY_WEEKS,
  });
  return f.weeks.flatMap((w) =>
    w.items.map(({ label, amount, date, sinceBalance }): CashItem => ({
      label,
      amount,
      date,
      href,
      ...(sinceBalance ? { sinceBalance } : {}),
    })),
  );
}

export type ContractRow = Contract & { id: string };
export type ChargeRow = Charge & { id: string };

/**
 * Mensualités des contrats récurrents actifs (le jour du début de contrat, chaque mois), à partir
 * de `from` (défaut : aujourd'hui).
 */
export function contractInflows(contracts: ContractRow[], today: Date, from: Date = today): CashItem[] {
  return contracts.flatMap((c) => occurrences(today, from, treasuryHref.contract(c.id), { contract: c }));
}

/** Échéances des charges fixes (mensuelles, trimestrielles ou annuelles), à partir de `from`. */
export function chargeOutflows(charges: ChargeRow[], today: Date, from: Date = today): CashItem[] {
  return charges.flatMap((c) => occurrences(today, from, treasuryHref.charge(c.id), { charge: c }));
}

/**
 * Prévision complète à partir des lignes lues en base. `balanceDate` : date du solde saisi ;
 * les mouvements postérieurs (occurrences, coûts payés, encaissements via `receivedSinceBalance`)
 * sont ajoutés, ceux en retard tombant en semaine 1.
 */
export function treasuryForecast(input: {
  today: Date;
  startBalance: number | null;
  balanceDate?: Date | null;
  billing: BillingRow[];
  costs: CostRow[];
  contracts: ContractRow[];
  charges: ChargeRow[];
}) {
  // Sans solde saisi, la prévision est relative : pas de date de coupure.
  const balanceDate = input.startBalance == null ? null : (input.balanceDate ?? null);
  const from = forecastFrom(balanceDate, input.today);
  return cashForecast({
    today: input.today,
    startBalance: input.startBalance,
    inflows: [...billingInflows(input.billing), ...contractInflows(input.contracts, input.today, from)],
    outflows: [
      ...costOutflows(input.costs, balanceDate),
      ...chargeOutflows(input.charges, input.today, from),
    ],
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
