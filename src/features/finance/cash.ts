/**
 * Trésorerie prévisionnelle sur 13 semaines (pure). Point de départ : le solde bancaire
 * saisi. Entrées : échéances restant à encaisser, contrats récurrents actifs. Sorties : coûts
 * engagés ou facturés non payés, charges fixes. Les éléments en retard tombent en semaine 1.
 */
import { addDays, addMonths, startOfWeek } from "@/lib/dates";

export type CashItem = { label: string; amount: number; date: Date | null; href?: string; late?: boolean };
export type Charge = {
  label: string;
  amount: number;
  frequency: "MENSUELLE" | "TRIMESTRIELLE" | "ANNUELLE";
  nextDate: Date;
  endDate: Date | null;
};
export type Contract = {
  label: string;
  monthlyAmount: number;
  startDate: Date;
  endDate: Date | null;
  status: string;
};

export type CashWeek = {
  start: Date;
  end: Date;
  inflow: number;
  outflow: number;
  balance: number;
  items: (CashItem & { direction: "in" | "out" })[];
};

const STEP = { MENSUELLE: 1, TRIMESTRIELLE: 3, ANNUELLE: 12 } as const;

export function cashForecast(input: {
  today: Date;
  startBalance: number | null;
  inflows: CashItem[];
  outflows: CashItem[];
  contracts: Contract[];
  charges: Charge[];
  weeks?: number;
}) {
  const weeks = input.weeks ?? 13;
  const first = startOfWeek(input.today);
  const end = addDays(first, weeks * 7);
  const buckets: CashWeek[] = Array.from({ length: weeks }, (_, i) => ({
    start: addDays(first, i * 7),
    end: addDays(first, i * 7 + 6),
    inflow: 0,
    outflow: 0,
    balance: 0,
    items: [],
  }));
  const undated: (CashItem & { direction: "in" | "out" })[] = [];
  const place = (item: CashItem, direction: "in" | "out") => {
    if (!item.date) return undated.push({ ...item, direction });
    const late = item.date < input.today;
    const date = late ? input.today : item.date;
    if (date >= end) return;
    const idx = Math.floor((date.getTime() - first.getTime()) / (7 * 86_400_000));
    const b = buckets[idx];
    b.items.push({ ...item, late: late || item.late, direction });
    if (direction === "in") b.inflow += item.amount;
    else b.outflow += item.amount;
  };
  for (const i of input.inflows) place(i, "in");
  for (const o of input.outflows) place(o, "out");
  for (const c of input.contracts) {
    if (c.status !== "ACTIF") continue;
    // Une échéance par mois, le même jour que le début du contrat.
    for (let k = 0, d = c.startDate; d < end; k++, d = addMonths(c.startDate, k)) {
      if (d < input.today || (c.endDate && d > c.endDate)) continue;
      place({ label: c.label, amount: c.monthlyAmount, date: d }, "in");
    }
  }
  for (const ch of input.charges) {
    for (let k = 0, d = ch.nextDate; d < end; k++, d = addMonths(ch.nextDate, k * STEP[ch.frequency])) {
      if (ch.endDate && d > ch.endDate) break;
      if (d < input.today) continue;
      place({ label: ch.label, amount: ch.amount, date: d }, "out");
    }
  }
  let balance = input.startBalance ?? 0;
  for (const b of buckets) {
    balance += b.inflow - b.outflow;
    b.balance = balance;
  }
  const lowest = buckets.reduce((min, b) => (b.balance < min.balance ? b : min), buckets[0]);
  return {
    weeks: buckets,
    undated,
    hasStartBalance: input.startBalance != null,
    totalIn: buckets.reduce((n, b) => n + b.inflow, 0),
    totalOut: buckets.reduce((n, b) => n + b.outflow, 0),
    endBalance: balance,
    lowest: { balance: lowest.balance, week: lowest.start },
    negativeWeeks: buckets.filter((b) => b.balance < 0).length,
  };
}
