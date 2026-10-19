import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CashItem } from "@/features/finance/cash";
import {
  chargeFrequencyLabels,
  itemKind,
  itemKindLabels,
  type ChargeFrequency,
  type TreasuryForecast,
} from "@/features/finance/treasury-rules";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Item = CashItem & { direction: "in" | "out" };
const m = (c: number) => formatMoney(c, { round: true });
const signed = (i: Item) => `${i.direction === "in" ? "+" : "−"}${formatMoney(i.amount)}`;
const byDate = (a: Item, b: Item) =>
  (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || a.direction.localeCompare(b.direction);

function ItemRow({ item, fixLabel }: { item: Item; fixLabel?: string }) {
  const kind = itemKind(item.href);
  return (
    <li className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {kind ? itemKindLabels[kind] : item.direction === "in" ? "Entrée" : "Sortie"}
          {item.date ? <span>· {formatDay(item.date)}</span> : null}
          {item.late ? <StatusBadge tone="danger" label="En retard" /> : null}
        </span>
        {item.href ? (
          <Link href={item.href} className="font-bold break-words hover:underline">
            {item.label}
          </Link>
        ) : (
          <span className="font-bold break-words">{item.label}</span>
        )}
        {fixLabel && item.href ? (
          <Link
            href={item.href}
            aria-label={`${fixLabel} : ${item.label}`}
            className="inline-flex min-h-tap w-fit items-center text-sm underline"
          >
            {fixLabel}
          </Link>
        ) : null}
      </div>
      <b
        className={cn(
          "shrink-0 text-right whitespace-nowrap tabular-nums",
          item.direction === "in" && "text-success",
        )}
      >
        {signed(item)}
      </b>
    </li>
  );
}

function WeekLine({
  index,
  week,
  relative,
  expandable,
}: {
  index: number;
  week: TreasuryForecast["weeks"][number];
  relative: boolean;
  expandable: boolean;
}) {
  const negative = week.balance < 0;
  return (
    <span className="grid w-full grid-cols-3 gap-x-3 gap-y-1 py-2.5 md:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem] md:items-center">
      <span className="col-span-3 flex flex-wrap items-center gap-2 md:col-span-1">
        {expandable ? (
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}
        <b>S+{index + 1}</b>
        <span className="text-sm text-muted-foreground">
          {formatDay(week.start)} – {formatDay(week.end)}
        </span>
        {negative ? <StatusBadge tone="danger" label="Sous zéro" /> : null}
        {expandable ? (
          <span className="text-xs text-muted-foreground">
            {week.items.length} mouvement{week.items.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col text-sm md:text-right">
        <span className="text-xs text-muted-foreground">Entrées</span>
        <span className={cn("tabular-nums", week.inflow && "text-success")}>
          {week.inflow ? "+" : ""}
          {m(week.inflow)}
        </span>
      </span>
      <span className="flex flex-col text-sm md:text-right">
        <span className="text-xs text-muted-foreground">Sorties</span>
        <span className="tabular-nums">
          {week.outflow ? "−" : ""}
          {m(week.outflow)}
        </span>
      </span>
      <span className="flex flex-col text-sm md:text-right">
        <span className="text-xs text-muted-foreground">{relative ? "Cumul" : "Solde"}</span>
        <b className={cn("tabular-nums", negative && "text-danger")}>{m(week.balance)}</b>
      </span>
    </span>
  );
}

/** Détail par semaine : entrées, sorties, solde, et mouvements dépliables (<details>). */
export function WeekList({ forecast }: { forecast: TreasuryForecast }) {
  const relative = !forecast.hasStartBalance;
  return (
    <ol aria-label="Détail par semaine" className="flex flex-col">
      {forecast.weeks.map((w, i) => (
        <li
          key={w.start.toISOString()}
          className={cn("border-b px-2 last:border-b-0", w.balance < 0 && "bg-danger-soft")}
        >
          {w.items.length ? (
            <details className="group">
              <summary className="flex min-h-tap cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
                <WeekLine index={i} week={w} relative={relative} expandable />
              </summary>
              <ul
                aria-label={`Mouvements de la semaine S+${i + 1}`}
                className="mb-2 rounded-lg border bg-card px-3"
              >
                {[...w.items].sort(byDate).map((item, k) => (
                  <ItemRow key={`${item.href ?? item.label}-${k}`} item={item} />
                ))}
              </ul>
            </details>
          ) : (
            <WeekLine index={i} week={w} relative={relative} expandable={false} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Montants sans date : exclus de la prévision tant qu'aucune date n'est saisie. */
export function UndatedList({ items }: { items: Item[] }) {
  const total = (d: "in" | "out") => items.filter((i) => i.direction === d).reduce((n, i) => n + i.amount, 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Non comptés dans la prévision : entrées {formatMoney(total("in"))}, sorties{" "}
        {formatMoney(total("out"))}. Ajoutez une date pour les y intégrer.
      </p>
      <ul aria-label="Montants sans date" className="flex flex-col">
        {items.map((item, k) => (
          <ItemRow key={`${item.href ?? item.label}-${k}`} item={item} fixLabel="Ajouter une date" />
        ))}
      </ul>
    </div>
  );
}

export type ChargeLine = {
  id: string;
  label: string;
  category: string | null;
  amount: number;
  frequency: ChargeFrequency;
  endDate: Date | null;
  upcoming: Date | null;
  monthly: number;
};

/** Charges fixes en cours, avec leur équivalent mensuel. */
export function ChargeList({ charges, monthlyTotal }: { charges: ChargeLine[]; monthlyTotal: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex flex-col">
          <span className="text-xs text-muted-foreground">Équivalent mensuel</span>
          <b className="text-xl tabular-nums" data-testid="charges-monthly-total" data-cents={monthlyTotal}>
            {formatMoney(monthlyTotal)}/mois
          </b>
        </p>
        <Button asChild variant="outline">
          <Link href="/finance/tresorerie/charges/nouvelle">
            <Plus aria-hidden="true" /> Ajouter une charge
          </Link>
        </Button>
      </div>
      {charges.length ? (
        <ul aria-label="Charges fixes" className="flex flex-col">
          {charges.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={`/finance/tresorerie/charges/${c.id}`}
                  className="font-bold break-words hover:underline"
                >
                  {c.label}
                </Link>
                <span className="text-[13px] text-muted-foreground">
                  {chargeFrequencyLabels[c.frequency]}
                  {c.category ? ` · ${c.category}` : ""}
                  {c.upcoming ? ` · prochaine le ${formatDay(c.upcoming)}` : ""}
                  {c.endDate ? ` · jusqu'au ${formatDay(c.endDate)}` : ""}
                </span>
                {!c.upcoming ? (
                  <span>
                    <StatusBadge tone="neutral" label="Terminée" />
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-right text-sm">
                <b className="tabular-nums">{formatMoney(c.amount)}</b>
                {c.frequency !== "MENSUELLE" ? (
                  <span className="block text-xs text-muted-foreground">
                    soit {formatMoney(c.monthly)}/mois
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Aucune charge fixe.">
          Loyer, salaires, abonnements, assurances : ajoutez-les pour une prévision réaliste.
        </EmptyState>
      )}
    </div>
  );
}
