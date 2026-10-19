import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Chip } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  objectiveProgressFor,
  parseScope,
  parseYear,
  profitabilityFor,
  yearChoices,
  type AnalysisScope,
  type ProfitRow,
} from "@/features/finance/analytics";
import { FinanceTabs } from "@/features/finance/components/finance-tabs";
import { ObjectiveForm } from "@/features/finance/components/objective-form";
import { ObjectiveDefinitions, ObjectiveGauges } from "@/features/finance/components/objective-gauges";
import { formatMinutes } from "@/features/planning/rules";
import { requireUser } from "@/lib/auth/session";
import { todayDate } from "@/lib/dates";
import { centsToDecimal, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analyses financières" };

type SP = { annee?: string; portee?: string };

const m = (c: number) => formatMoney(c, { round: true });
const rate = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("fr-FR")} %`);
/** Centimes → saisie (« 250000 », « 1250,50 »), vide sans objectif. */
const amountInput = (c: number | null) =>
  c == null ? "" : centsToDecimal(c).replace(".", ",").replace(/,00$/, "");

function Figures({ r, timeValued }: { r: ProfitRow; timeValued: boolean }) {
  return (
    <>
      <td className="px-2 py-2.5 text-right tabular-nums">{r.projects}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{m(r.revenue)}</td>
      <td className={cn("px-2 py-2.5 text-right font-bold tabular-nums", r.margin < 0 && "text-danger")}>
        {m(r.margin)}
      </td>
      {timeValued ? (
        <td
          className={cn(
            "px-2 py-2.5 text-right tabular-nums",
            r.marginAfterTime != null && r.marginAfterTime < 0 && "text-danger",
          )}
        >
          {r.marginAfterTime == null ? "—" : m(r.marginAfterTime)}
          {r.marginAfterTimeRate != null ? (
            <span className="block text-xs text-muted-foreground">{rate(r.marginAfterTimeRate)}</span>
          ) : null}
        </td>
      ) : null}
      <td className="px-2 py-2.5 text-right tabular-nums">{rate(r.marginRate)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">
        {r.satisfaction == null ? (
          "—"
        ) : (
          <>
            {r.satisfaction.toLocaleString("fr-FR")}/5
            <span className="block text-xs text-muted-foreground">{r.ratings} avis</span>
          </>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{r.minutes ? formatMinutes(r.minutes) : "—"}</td>
    </>
  );
}

function ProfitTable({
  caption,
  first,
  rows,
  total,
  timeValued,
  emptyText,
}: {
  caption: string;
  first: string;
  rows: ProfitRow[];
  total: ProfitRow | null;
  timeValued: boolean;
  emptyText: string;
}) {
  const head = "px-2 py-2 text-right font-normal";
  return (
    // Seul ce conteneur défile horizontalement sur petit écran, jamais la page (contain : la largeur
    // minimale du tableau n'élargit pas la colonne principale à côté du menu latéral).
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border bg-card contain-inline-size"
    >
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="px-4 pt-3 pb-1 text-left font-bold">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-4 py-2 font-normal">
              {first}
            </th>
            <th scope="col" className={head}>
              Projets
            </th>
            <th scope="col" className={head}>
              Revenus
            </th>
            <th scope="col" className={head}>
              Marge
            </th>
            {timeValued ? (
              <th scope="col" className={head}>
                Marge après temps
              </th>
            ) : null}
            <th scope="col" className={head}>
              Taux de marge
            </th>
            <th scope="col" className={head}>
              Satisfaction
            </th>
            <th scope="col" className="px-4 py-2 text-right font-normal">
              Temps passé
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-b-0">
              <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-bold">
                {r.label}
              </th>
              <Figures r={r} timeValued={timeValued} />
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={timeValued ? 8 : 7} className="px-4 py-4 text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          ) : null}
        </tbody>
        {total && rows.length > 1 ? (
          <tfoot>
            <tr className="border-t-2">
              <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-bold">
                Total
              </th>
              <Figures r={total} timeValued={timeValued} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

async function Analyses({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayDate();
  const current = today.getUTCFullYear();
  const year = parseYear(sp.annee, current);
  const scope = parseScope(sp.portee);
  const [objectives, profit] = await Promise.all([
    objectiveProgressFor(year, today),
    profitabilityFor(year, scope, today),
  ]);
  const href = (patch: { annee?: number; portee?: AnalysisScope }) => {
    const p = new URLSearchParams();
    const y = patch.annee ?? year;
    const s = patch.portee ?? scope;
    if (y !== current) p.set("annee", String(y));
    if (s !== "termines") p.set("portee", s);
    return p.toString() ? `/finance/analyses?${p}` : "/finance/analyses";
  };
  const o = objectives.objective;
  const emptyText =
    scope === "termines"
      ? `Aucun projet clôturé en ${year}. Essayez « Terminés et en cours ».`
      : `Aucun projet clôturé ou en cours en ${year}.`;
  return (
    <>
      <div role="group" aria-label="Année" className="flex flex-wrap gap-2">
        {yearChoices(current, year).map((y) => (
          <Chip key={y} href={href({ annee: y })} active={y === year}>
            {y}
          </Chip>
        ))}
      </div>

      <section id="objectifs" aria-labelledby="objectifs-titre" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="objectifs-titre" className="text-xl font-bold">
          Objectifs {year}
        </h2>
        <Card>
          <ObjectiveGauges progress={objectives} today={today} />
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="gap-3">
            <CardTitle>Fixer les objectifs</CardTitle>
            <CardDescription>
              Montants HT. Un champ vide = pas d&apos;objectif sur cet indicateur.
            </CardDescription>
            <ObjectiveForm
              key={year}
              year={year}
              values={{
                revenue: amountInput(o?.revenue ?? null),
                margin: amountInput(o?.margin ?? null),
                projectCount: o?.projectCount == null ? "" : String(o.projectCount),
              }}
            />
          </Card>
          <Card className="gap-3">
            <CardTitle>Comment l&apos;avancement est mesuré</CardTitle>
            <ObjectiveDefinitions />
          </Card>
        </div>
      </section>

      <section aria-labelledby="rentabilite-titre" className="flex flex-col gap-3">
        <h2 id="rentabilite-titre" className="text-xl font-bold">
          Rentabilité {year}
        </h2>
        <div role="group" aria-label="Projets pris en compte" className="flex flex-wrap gap-2">
          <Chip href={href({ portee: "termines" })} active={scope === "termines"}>
            Terminés dans l&apos;année
          </Chip>
          <Chip href={href({ portee: "tous" })} active={scope === "tous"}>
            Terminés et en cours
          </Chip>
        </div>
        <figure className="flex flex-col gap-4">
          <figcaption className="text-sm text-muted-foreground">
            <b className="text-foreground">Comment sont calculés ces chiffres.</b> Projets pris en compte (
            {profit.count}) : ceux{" "}
            {scope === "termines"
              ? `clôturés en ${year}`
              : `clôturés en ${year}, ou en cours et démarrés au plus tard en ${year}`}{" "}
            (archivés compris s&apos;ils ont été clôturés). Pour chaque projet, cumul à date, non limité à
            l&apos;année : <b>revenus</b> = facturé HT (échéances facturées ou encaissées) ; <b>marge</b> =
            revenus − coûts engagés HT (engagés, reçus / facturés ou payés) ;{" "}
            {profit.timeValued ? (
              <>
                <b>marge après temps</b> = marge − temps passé valorisé au coût horaire interne ;{" "}
              </>
            ) : null}
            <b>taux de marge</b> = marge ÷ revenus ; <b>satisfaction</b> = moyenne des notes données à la
            clôture (sur 5) ; <b>temps passé</b> = heures saisies. Tri par marge décroissante.
            {scope === "tous"
              ? " Un projet en cours n'a pas fini de facturer : sa marge est provisoire."
              : ""}
            {profit.timeValued ? null : (
              <>
                {" "}
                Aucun coût horaire défini : la marge après temps apparaîtra une fois les coûts horaires
                renseignés dans{" "}
                <Link href="/plus/reglages" className="underline">
                  Réglages
                </Link>
                .
              </>
            )}
          </figcaption>
          <ProfitTable
            caption="Par modèle de projet"
            first="Modèle"
            rows={profit.byTemplate}
            total={profit.total}
            timeValued={profit.timeValued}
            emptyText={emptyText}
          />
          <ProfitTable
            caption="Par client"
            first="Client"
            rows={profit.byClient}
            total={profit.total}
            timeValued={profit.timeValued}
            emptyText={emptyText}
          />
        </figure>
      </section>
    </>
  );
}

export default function AnalysesPage({ searchParams }: PageProps<"/finance/analyses">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Finance" description="Pilotage HT : prévisionnel et réalisé toujours séparés." />
      <FinanceTabs active="analyses" />
      <Suspense fallback={<PageLoading />}>
        <Analyses searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
