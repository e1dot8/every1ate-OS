import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { BudgetForm } from "@/features/finance/components/forms";
import {
  billingState,
  billingStateLabels,
  marginRate,
  type BillingState,
  type FinanceSummary,
} from "@/features/finance/calc";
import { costStatusLabels, decisionStatusLabels } from "@/features/finance/labels";
import { projectFinance } from "@/features/finance/service";
import { formatMinutes } from "@/features/planning/rules";
import { formatDay } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const billingTone: Record<BillingState, StatusTone> = {
  ATTENDU: "neutral",
  FACTURE: "info",
  PARTIELLEMENT_ENCAISSE: "warning",
  ENCAISSE: "success",
  EN_RETARD: "danger",
  ANNULE: "neutral",
};
const costTone: Record<string, StatusTone> = {
  PREVU: "neutral",
  ENGAGE: "info",
  FACTURE: "warning",
  PAYE: "success",
  ANNULE: "neutral",
};

const m = (c: number | null) => (c == null ? "—" : formatMoney(c, { round: true }));

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card p-3" data-testid={`kpi-${label}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <b
        className={cn(
          "text-lg tabular-nums",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </b>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function Summary({ s }: { s: FinanceSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-annotation text-sm text-pen-strong">Prévisionnel</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi
          label="Revenus prévus"
          value={m(s.revenuePlanned)}
          hint={s.budgetRevenue == null ? "d'après l'échéancier" : "budget approuvé"}
        />
        <Kpi
          label="Coûts prévisionnels"
          value={m(s.forecastCost)}
          hint={`budget ${m(s.budgetCost)} · lignes ${m(s.costsPlanned)}`}
        />
        <Kpi
          label="Marge prévisionnelle"
          value={m(s.marginForecast)}
          hint={
            marginRate(s.marginForecast, s.revenuePlanned) == null
              ? undefined
              : `${marginRate(s.marginForecast, s.revenuePlanned)} %`
          }
          tone={s.marginForecast < 0 ? "danger" : undefined}
        />
        <Kpi
          label="Facturation attendue"
          value={m(s.billingExpected)}
          hint={s.lateBillingCount ? `${s.lateBillingCount} échéance(s) en retard` : undefined}
          tone={s.lateBillingCount ? "danger" : undefined}
        />
      </div>
      <h3 className="font-annotation text-sm text-pen-strong">Réalisé</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi
          label="Coûts engagés"
          value={m(s.costsCommitted)}
          hint={s.budgetConsumedPct == null ? undefined : `${s.budgetConsumedPct} % du budget`}
          tone={s.budgetConsumedPct != null && s.budgetConsumedPct > 100 ? "danger" : undefined}
        />
        <Kpi label="Coûts payés" value={m(s.costsPaid)} hint={`reste à payer ${m(s.remainingToPay)}`} />
        <Kpi label="Facturé" value={m(s.billingInvoiced)} hint={`encaissé ${m(s.collected)}`} />
        <Kpi
          label="Marge réelle"
          value={m(s.marginActual)}
          hint="facturé − coûts reçus"
          tone={s.marginActual < 0 ? "danger" : undefined}
        />
      </div>
      {s.rebillable ? (
        <p className="text-xs text-muted-foreground">
          Dont coûts refacturables : {m(s.rebillable)} (refacturables ≠ marge).
        </p>
      ) : null}
    </div>
  );
}

export async function ProjectFinance({ projectId, archived }: { projectId: string; archived: boolean }) {
  const f = await projectFinance(projectId);
  if (!f) return null;
  const lots = f.lots.map((l) => ({ value: l.id, label: l.name }));
  const paidBy = (id: string) =>
    f.billing.find((b) => b.id === id)?.payments.reduce((n, p) => n + toCents(p.amount), 0) ?? 0;
  const hasProjectBudget = f.revisions.some((r) => !r.workPackageId && r.status === "APPLIQUEE");
  return (
    <div className="flex flex-col gap-5">
      <Summary s={f.summary} />
      <p className="text-xs text-muted-foreground">
        Outil de pilotage : ne remplace ni la comptabilité ni l&apos;expert-comptable. Montants HT. Temps
        passé : {formatMinutes(f.minutes)} (non valorisé).
      </p>

      {f.byLot.length ? (
        <Card className="gap-0 py-1">
          <table className="w-full text-sm">
            <caption className="py-2 text-left font-bold">Marge par lot</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 font-normal">
                  Lot
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Engagé
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Marge prév.
                </th>
                <th scope="col" className="hidden py-2 text-right font-normal sm:table-cell">
                  Marge réelle
                </th>
              </tr>
            </thead>
            <tbody>
              {f.byLot.map((l) => (
                <tr key={l.id} className="border-b last:border-b-0">
                  <th scope="row" className="py-2 text-left font-bold">
                    {l.name}
                  </th>
                  <td className="py-2 text-right tabular-nums">{m(l.summary.costsCommitted)}</td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      l.summary.marginForecast < 0 && "text-danger",
                    )}
                  >
                    {m(l.summary.marginForecast)}
                  </td>
                  <td className="hidden py-2 text-right tabular-nums sm:table-cell">
                    {m(l.summary.marginActual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>Budget</CardTitle>
          <ol className="flex flex-col gap-1.5 text-sm" aria-label="Historique du budget">
            {f.revisions.map((r) => (
              <li key={r.id} className="border-b pb-1.5 last:border-b-0">
                <b>{r.isInitial ? "Initial" : "Révision"}</b> ·{" "}
                {r.workPackageId ? (f.lots.find((l) => l.id === r.workPackageId)?.name ?? "lot") : "projet"} ·
                revenus {m(toCents(r.plannedRevenue))} · coûts {m(toCents(r.plannedCost))}
                <span className="block text-xs text-muted-foreground">
                  {formatDay(r.createdAt)} ·{" "}
                  {r.status === "APPLIQUEE"
                    ? "appliquée"
                    : r.status === "EN_ATTENTE"
                      ? "en attente de décision"
                      : "refusée"}
                  {r.reason ? ` · ${r.reason}` : ""}
                  {r.decision ? (
                    <>
                      {" · "}
                      <Link href={`/gouvernance/${r.decision.id}`} className="underline">
                        décision {decisionStatusLabels[r.decision.status].toLowerCase()}
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
            {!f.revisions.length ? <li className="text-muted-foreground">Aucun budget saisi.</li> : null}
          </ol>
          {!archived ? (
            <details>
              <summary className="min-h-tap cursor-pointer py-2 font-bold">
                {hasProjectBudget ? "Réviser le budget" : "Saisir le budget initial"}
              </summary>
              <BudgetForm projectId={projectId} lots={lots} hasBudget={hasProjectBudget} />
            </details>
          ) : null}
        </Card>

        <Card className="gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Échéancier de facturation</CardTitle>
            {!archived ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/projets/${projectId}/finance/echeance`}>
                  <Plus aria-hidden="true" /> Échéance
                </Link>
              </Button>
            ) : null}
          </div>
          <ul className="flex flex-col">
            {f.billing.map((b) => {
              const paid = paidBy(b.id);
              const state = billingState(
                { amount: toCents(b.amount), status: b.status, plannedDate: b.plannedDate },
                paid,
                f.today,
              );
              return (
                <li key={b.id} className="flex flex-col gap-1 border-b py-2.5 text-sm last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/finance/echeances/${b.id}`} className="flex-1 font-bold hover:underline">
                      {b.label}
                    </Link>
                    <StatusBadge tone={billingTone[state]} label={billingStateLabels[state]} />
                  </div>
                  <span className="text-muted-foreground">
                    {m(toCents(b.amount))} HT · prévu {formatDay(b.plannedDate)}
                    {paid ? ` · encaissé ${m(paid)}` : ""}
                    {b.invoiceRef ? ` · ${b.invoiceRef}` : ""}
                  </span>
                </li>
              );
            })}
            {!f.billing.length ? <li className="text-sm text-muted-foreground">Aucune échéance.</li> : null}
          </ul>
        </Card>
      </div>

      <Card className="gap-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Coûts</CardTitle>
            <CardDescription>
              Prévu → engagé → reçu/facturé → payé. Un coût engagé compte dans la marge prévisionnelle.
            </CardDescription>
          </div>
          {!archived ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projets/${projectId}/finance/cout`}>
                <Plus aria-hidden="true" /> Coût
              </Link>
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {f.costs.map((c) => (
            <li key={c.id} className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/finance/couts/${c.id}`} className="font-bold hover:underline">
                  {c.description}
                </Link>
                <span className="truncate text-muted-foreground">
                  {[
                    c.supplier,
                    c.workPackage?.name,
                    c.rebillable ? "refacturable" : null,
                    c.source === "IMPORT" ? "importé" : null,
                    c.invoiceDate ? `facture ${formatDay(c.invoiceDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <b className="tabular-nums">{m(toCents(c.amount))}</b>
              <StatusBadge tone={costTone[c.status]} label={costStatusLabels[c.status]} />
            </li>
          ))}
          {!f.costs.length ? <li className="text-sm text-muted-foreground">Aucun coût.</li> : null}
        </ul>
        <Link
          href="/finance/imports/nouveau"
          className="inline-flex items-center gap-1 text-sm font-bold text-pen-strong hover:underline"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" /> Importer un export CSV/Excel
        </Link>
      </Card>
    </div>
  );
}
