import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Gauge, Info, Landmark, OctagonAlert } from "lucide-react";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FinanceTabs } from "@/features/finance/components/finance-tabs";
import { TreasuryChart } from "@/features/finance/components/treasury-chart";
import { CashBalanceForm } from "@/features/finance/components/treasury-forms";
import { ChargeList, UndatedList, WeekList } from "@/features/finance/components/treasury-lists";
import { listCharges, loadCashForecast } from "@/features/finance/treasury";
import { STALE_BALANCE_DAYS, TREASURY_WEEKS } from "@/features/finance/treasury-rules";
import { requireUser } from "@/lib/auth/session";
import { daysBetween, formatDay, toDateInput, todayDate } from "@/lib/dates";
import { centsToDecimal, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trésorerie" };

const m = (c: number) => formatMoney(c, { round: true });

function Kpi({
  label,
  value,
  cents,
  hint,
  danger,
}: {
  label: string;
  value: string;
  cents: number | null;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl border bg-card p-3 max-md:last:col-span-2"
      data-testid={`kpi-${label}`}
      data-cents={cents ?? ""}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className={cn("text-lg tabular-nums", danger && "text-danger")}>{value}</b>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function Notice({ tone, children }: { tone: "danger" | "warning" | "info"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? OctagonAlert : tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        tone === "danger" && "border-danger/40 bg-danger-soft",
        tone === "warning" && "border-warning/40 bg-warning-soft",
        tone === "info" && "border-info/40 bg-info-soft",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "info" && "text-info",
        )}
      />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

const sectionTitle = "text-lg leading-tight font-bold";

async function Treasury() {
  await requireUser();
  const today = todayDate();
  const [{ forecast, balance }, { charges, monthlyTotal }] = await Promise.all([
    loadCashForecast(today),
    listCharges(today),
  ]);
  const last = forecast.weeks[forecast.weeks.length - 1];
  const age = balance?.date ? daysBetween(balance.date, today) : null;
  return (
    <>
      {!balance ? (
        <Notice tone="warning">
          <p className="font-bold">Aucun solde bancaire saisi.</p>
          <p>
            Les soldes affichés sont relatifs : variation cumulée depuis zéro.{" "}
            <a href="#solde-bancaire" className="font-bold underline">
              Saisir le solde
            </a>
          </p>
        </Notice>
      ) : age != null && age > STALE_BALANCE_DAYS ? (
        <Notice tone="info">
          <p>
            Solde saisi au {formatDay(balance.date)} (il y a {age} jours). Les mouvements datés depuis
            (contrats, charges fixes, encaissements reçus, coûts payés) sont ajoutés en S+1 ; mettez le solde
            à jour pour une prévision fiable.{" "}
            <a href="#solde-bancaire" className="font-bold underline">
              Mettre à jour
            </a>
          </p>
        </Notice>
      ) : null}
      {forecast.negativeWeeks ? (
        <Notice tone="danger">
          <p className="font-bold">
            {balance ? "Trésorerie négative prévue" : "Sorties supérieures aux entrées"} :{" "}
            {forecast.negativeWeeks} semaine{forecast.negativeWeeks > 1 ? "s" : ""} sous zéro
            {balance ? "" : " (variation cumulée)"}.
          </p>
          <p>
            Point bas : {formatMoney(forecast.lowest.balance)}, semaine du {formatDay(forecast.lowest.week)}
          </p>
        </Notice>
      ) : null}

      <section aria-labelledby="titre-kpi" className="flex flex-col gap-3">
        <h2 id="titre-kpi" className="sr-only">
          Indicateurs sur {TREASURY_WEEKS} semaines
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi
            label="Solde de départ"
            value={balance ? m(balance.cents) : "Non saisi"}
            cents={balance?.cents ?? null}
            hint={balance?.date ? `au ${formatDay(balance.date)}` : "soldes relatifs"}
            danger={!!balance && balance.cents < 0}
          />
          <Kpi
            label="Encaissements 13 sem."
            value={m(forecast.totalIn)}
            cents={forecast.totalIn}
            hint="prévisionnel"
          />
          <Kpi
            label="Décaissements 13 sem."
            value={m(forecast.totalOut)}
            cents={forecast.totalOut}
            hint="prévisionnel"
          />
          <Kpi
            label="Point bas"
            value={m(forecast.lowest.balance)}
            cents={forecast.lowest.balance}
            hint={`semaine du ${formatDay(forecast.lowest.week)}`}
            danger={forecast.lowest.balance < 0}
          />
          <Kpi
            label="Solde fin"
            value={m(forecast.endBalance)}
            cents={forecast.endBalance}
            hint={last ? `au ${formatDay(last.end)}` : undefined}
            danger={forecast.endBalance < 0}
          />
        </div>
      </section>

      <Card className="gap-3 p-3 md:p-5">
        <h2 className={sectionTitle}>Prévision sur {TREASURY_WEEKS} semaines</h2>
        <TreasuryChart forecast={forecast} />
      </Card>

      <Card className="gap-2 p-3 md:p-5">
        <h2 className={sectionTitle}>Semaine par semaine</h2>
        <p className="text-sm text-muted-foreground">
          Ouvrez une semaine pour voir le détail de ses mouvements. Les montants en retard, comme les
          mouvements datés entre le solde saisi et aujourd&apos;hui, sont comptés en S+1 (semaine en cours).
        </p>
        <WeekList forecast={forecast} />
      </Card>

      {forecast.undated.length ? (
        <Card className="gap-2">
          <h2 className={sectionTitle}>Sans date — non prévus</h2>
          <UndatedList items={forecast.undated} />
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="solde-bancaire" className="scroll-mt-20 gap-3">
          <h2 className={sectionTitle}>Solde bancaire</h2>
          <p className="text-sm text-muted-foreground">
            Saisie manuelle (aucune connexion bancaire) : c&apos;est le point de départ de la prévision. Le
            solde est pris en fin de journée : les mouvements des jours suivants s&apos;y ajoutent.
          </p>
          <CashBalanceForm
            balance={balance ? centsToDecimal(balance.cents).replace(".", ",") : ""}
            date={toDateInput(today)}
          />
        </Card>
        <Card id="charges-fixes" className="scroll-mt-20 gap-3">
          <h2 className={sectionTitle}>Charges fixes</h2>
          <ChargeList charges={charges} monthlyTotal={monthlyTotal} />
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Prévision indicative, calculée uniquement à partir des saisies. Inclus, projets archivés compris :
        reste à encaisser des échéances (date prévue, sinon facture + 30 jours), coûts engagés ou reçus non
        payés (échéance, sinon facture + 30 jours), contrats récurrents actifs et charges fixes, ainsi que les
        encaissements reçus et coûts payés après la date du solde. Exclus : coûts seulement prévus. Montants
        des projets HT ; la TVA n&apos;est pas modélisée.
      </p>
    </>
  );
}

export default function TreasuryPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Finance" description="Pilotage HT : prévisionnel et réalisé toujours séparés." />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/cockpit">
              <Gauge aria-hidden="true" /> Cockpit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/gouvernance">
              <Landmark aria-hidden="true" /> Gouvernance
            </Link>
          </Button>
        </div>
      </div>
      <FinanceTabs active="tresorerie" />
      <Suspense fallback={<PageLoading />}>
        <Treasury />
      </Suspense>
    </div>
  );
}
