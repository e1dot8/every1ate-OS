import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Download, FileSpreadsheet, Gauge, Landmark, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { marginRate } from "@/features/finance/calc";
import { FinanceTabs, type FinanceTab } from "@/features/finance/components/finance-tabs";
import { listImports } from "@/features/finance/imports";
import { contractStatusLabels } from "@/features/finance/labels";
import { financeOverview, listContracts } from "@/features/finance/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, toDateInput, todayDate } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

const m = (c: number) => formatMoney(c, { round: true });

async function Finance({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab = ["contrats", "imports"].includes(sp.onglet ?? "") ? sp.onglet! : "projets";
  return (
    <>
      <FinanceTabs active={tab as FinanceTab} />
      {tab === "projets" ? <Projects /> : tab === "contrats" ? <Contracts /> : <Imports />}
    </>
  );
}

async function Projects() {
  const rows = await financeOverview();
  const live = rows.filter((r) => !["TERMINE", "ARCHIVE"].includes(r.status));
  const total = (k: "marginForecast" | "marginActual" | "costsCommitted" | "billingExpected" | "collected") =>
    live.reduce((n, r) => n + r.summary[k], 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Facturation attendue", m(total("billingExpected")), "prévisionnel"],
          ["Encaissé", m(total("collected")), "réalisé"],
          ["Coûts engagés", m(total("costsCommitted")), "réalisé"],
          ["Marge prévisionnelle", m(total("marginForecast")), "prévisionnel"],
        ].map(([k, v, hint]) => (
          <Card key={k} className="gap-0.5 py-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-xl font-bold tabular-nums">{v}</p>
            <p className="font-annotation text-xs text-pen-strong">{hint}</p>
          </Card>
        ))}
      </div>
      {rows.length ? (
        <Card className="gap-0 py-1">
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/projets/${r.id}?onglet=finance`} className="font-bold hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-[13px] text-muted-foreground">
                    {r.client?.name ?? "Sans client"} · engagé {m(r.summary.costsCommitted)} · facturé{" "}
                    {m(r.summary.billingInvoiced)}
                  </span>
                </div>
                <span className="text-right text-sm">
                  <b className={cn("tabular-nums", r.summary.marginForecast < 0 && "text-danger")}>
                    {m(r.summary.marginForecast)}
                  </b>
                  <span className="block text-xs text-muted-foreground">
                    marge prév.
                    {marginRate(r.summary.marginForecast, r.summary.revenuePlanned) != null
                      ? ` · ${marginRate(r.summary.marginForecast, r.summary.revenuePlanned)} %`
                      : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Aucun projet." />
      )}
    </>
  );
}

async function Contracts() {
  const { contracts, mrr } = await listContracts();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Card className="gap-0.5 py-3">
          <p className="text-xs text-muted-foreground">MRR contracté</p>
          <p className="text-2xl font-bold tabular-nums" data-testid="mrr">
            {formatMoney(mrr)}
          </p>
          <p className="text-xs text-muted-foreground">contrats actifs à date · ≠ CA ponctuel ÷ 12</p>
        </Card>
        <Button asChild>
          <Link href="/finance/contrats/nouveau">
            <Plus aria-hidden="true" /> Contrat
          </Link>
        </Button>
      </div>
      <Card className="gap-0 py-1">
        <ul>
          {contracts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/finance/contrats/${c.id}`} className="font-bold hover:underline">
                  {c.label}
                </Link>
                <span className="text-[13px] text-muted-foreground">
                  {c.client.name} · du {formatDay(c.startDate)}
                  {c.endDate ? ` au ${formatDay(c.endDate)}` : ""}
                  {c.renewalDate ? ` · renouvellement ${formatDay(c.renewalDate)}` : ""}
                  {c.noticeDays != null ? ` · préavis ${c.noticeDays} j` : ""}
                </span>
              </div>
              <b className="tabular-nums">{formatMoney(toCents(c.monthlyAmount))}/mois</b>
              <StatusBadge
                tone={c.status === "ACTIF" ? "success" : "neutral"}
                label={contractStatusLabels[c.status]}
              />
            </li>
          ))}
          {!contracts.length ? (
            <li className="py-4 text-sm text-muted-foreground">Aucun contrat récurrent.</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}

async function Imports() {
  const imports = await listImports();
  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/finance/imports/nouveau">
            <FileSpreadsheet aria-hidden="true" /> Nouvel import
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Pennylane (comptabilité) et Qonto (banque) : import manuel CSV/Excel avec prévisualisation et
        rapprochement contrôlé. Aucune API automatique n&apos;est utilisée.
      </p>
      <Card className="gap-0 py-1">
        <ul>
          {imports.map((i) => (
            <li key={i.id} className="flex items-center gap-3 border-b py-3 text-sm last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/finance/imports/${i.id}`} className="truncate font-bold hover:underline">
                  {i.fileName}
                </Link>
                <span className="text-muted-foreground">
                  {formatDay(i.createdAt)} · {i.createdBy.name} ·{" "}
                  {i.kind === "COUTS"
                    ? "coûts"
                    : i.kind === "ENCAISSEMENTS"
                      ? "encaissements"
                      : "type à choisir"}{" "}
                  · {i.rowCount} lignes
                  {i.status === "IMPORTE"
                    ? ` · ${i.importedCount} importées, ${i.skippedCount} écartées`
                    : ""}
                </span>
              </div>
              <StatusBadge
                tone={i.status === "IMPORTE" ? "success" : i.status === "ANNULE" ? "neutral" : "warning"}
                label={i.status === "IMPORTE" ? "Importé" : i.status === "ANNULE" ? "Annulé" : "Brouillon"}
              />
            </li>
          ))}
          {!imports.length ? <li className="py-4 text-sm text-muted-foreground">Aucun import.</li> : null}
        </ul>
      </Card>
    </>
  );
}

/**
 * Export comptable : formulaire GET sans JavaScript vers la route de téléchargement.
 * « Toute l'année » exporte l'année du mois choisi (?mois=AAAA-MM&periode=annee).
 */
function ExportForm({ month }: { month?: string }) {
  return (
    <form
      action="/api/export/finance"
      method="get"
      aria-label="Export comptable"
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="export-mois" className="text-sm font-bold">
          Export comptable (mois)
        </label>
        <Input
          id="export-mois"
          type="month"
          name="mois"
          required
          defaultValue={month}
          pattern="\d{4}-\d{2}"
          placeholder="AAAA-MM"
          className="w-44"
        />
      </div>
      <Button type="submit" variant="outline" name="periode" value="mois">
        <Download aria-hidden="true" /> Exporter
      </Button>
      <Button type="submit" variant="ghost" name="periode" value="annee">
        Toute l&apos;année<span className="sr-only"> du mois choisi</span>
      </Button>
    </form>
  );
}

/** Mois en cours (Paris) par défaut : lecture de l'heure, donc dynamique et sous Suspense. */
async function ExportControl() {
  await connection();
  return <ExportForm month={toDateInput(todayDate()).slice(0, 7)} />;
}

export default function FinancePage({ searchParams }: PageProps<"/finance">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Finance" description="Pilotage HT : prévisionnel et réalisé toujours séparés." />
        <div className="flex flex-col gap-3 md:items-end">
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
          <Suspense fallback={<ExportForm />}>
            <ExportControl />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Finance searchParams={searchParams as Promise<{ onglet?: string }>} />
      </Suspense>
    </div>
  );
}
