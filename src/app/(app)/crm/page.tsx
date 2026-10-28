import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { Building2, CalendarClock, Plus, Search, Settings2 } from "lucide-react";
import { Avatar, Chip, EmptyState, Tabs } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SignalsCard } from "@/features/crm/components/signals-card";
import { OPEN_STAGES, STAGES, effectiveProbability, stageLabels } from "@/features/crm/rules";
import { crmForecast } from "@/features/crm/service";
import { loadCommercialSignals } from "@/features/crm/signals-service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, todayDate } from "@/lib/dates";
import { formatMoney, percentOf, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "CRM" };

type SP = { onglet?: string; moi?: string; q?: string };

/** Teinte des colonnes : jaune quand ça se discute, vert quand c'est signé (lot G8, maquette). */
const STAGE_TINT: Partial<Record<(typeof STAGES)[number], string>> = {
  PROPOSITION_ENVOYEE: "bg-highlight-soft",
  NEGOCIATION: "bg-highlight-soft",
  GAGNE: "bg-success-soft",
};

/** Opportunités détectées (renouvellements, suites, dormants), chargées à part du pipeline. */
async function Signals() {
  await requireUser();
  let signals: Awaited<ReturnType<typeof loadCommercialSignals>>;
  try {
    signals = await loadCommercialSignals();
  } catch (error) {
    unstable_rethrow(error);
    // Section secondaire : son échec ne doit pas empêcher l'accès au pipeline.
    console.error("Opportunités détectées indisponibles", error);
    return (
      <p role="alert" className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Les opportunités détectées sont indisponibles pour le moment. Rechargez la page.
      </p>
    );
  }
  return (
    <SignalsCard
      signals={signals.map((s) => ({
        key: s.key,
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        clientName: s.clientName,
        clientHref: s.clientHref,
        contractHref: s.contractHref,
        createHref: s.createHref,
      }))}
    />
  );
}

async function Crm({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.onglet === "previsions" ? "previsions" : "pipeline";
  const data = await crmForecast(sp.moi ? user.id : undefined);
  const q = sp.q?.trim().toLowerCase();
  const opps = q
    ? data.opps.filter((o) => `${o.title} ${o.client.name}`.toLowerCase().includes(q))
    : data.opps;
  const today = todayDate();
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return p.toString() ? `/crm?${p}` : "/crm";
  };
  const late = new Set(data.lateIds);

  return (
    <>
      <Tabs
        active={tab}
        items={[
          { key: "salle", label: "À suivre", href: "/crm/salle" },
          { key: "pipeline", label: "Pipeline", href: href({ onglet: undefined }) },
          { key: "previsions", label: "Prévisions", href: href({ onglet: "previsions" }) },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip href={href({ moi: undefined })} active={!sp.moi}>
          Équipe
        </Chip>
        <Chip href={href({ moi: "1" })} active={!!sp.moi}>
          Mes opportunités
        </Chip>
      </div>

      {tab === "pipeline" ? (
        <>
          <form
            role="search"
            action="/crm"
            className="flex min-h-tap items-center gap-2 rounded-lg border border-input px-3"
          >
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={sp.q}
              aria-label="Rechercher une opportunité"
              placeholder="Rechercher une opportunité ou une entreprise"
              className="border-0 px-0 focus-visible:outline-none"
            />
            {sp.moi ? <input type="hidden" name="moi" value="1" /> : null}
          </form>
          {opps.length ? (
            <div className="relative -mx-4 flex flex-col gap-4 px-4 md:flex-row md:overflow-x-auto md:pb-2">
              {STAGES.map((stage) => {
                const list = opps.filter((o) => o.stage === stage);
                const closed = !OPEN_STAGES.includes(stage);
                return (
                  <section
                    key={stage}
                    aria-label={stageLabels[stage]}
                    className={cn(
                      "flex shrink-0 flex-col gap-2 rounded-xl p-2 md:w-64",
                      STAGE_TINT[stage] ?? "bg-muted/70",
                    )}
                  >
                    <h2 className="flex items-baseline justify-between px-1.5 pt-1 text-[13px] font-bold">
                      <span>
                        {stageLabels[stage]} <span className="text-muted-foreground">({list.length})</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(
                          list.reduce((n, o) => n + toCents(o.amount), 0),
                          { round: true },
                        )}
                      </span>
                    </h2>
                    {(closed ? list.slice(0, 5) : list).map((o) => {
                      const amount = toCents(o.amount);
                      const p = effectiveProbability(o.stage, o.probability, data.settings);
                      return (
                        <Card
                          key={o.id}
                          className={cn(
                            "gap-1.5 rounded-lg border-transparent p-3",
                            late.has(o.id) && "border-danger",
                          )}
                        >
                          <Link
                            href={`/crm/opportunites/${o.id}`}
                            className="font-bold leading-snug hover:underline"
                          >
                            {o.title}
                          </Link>
                          <p className="text-[13px] text-muted-foreground">{o.client.name}</p>
                          <p className="text-sm">
                            <b>{o.amount ? formatMoney(amount, { round: true }) : "Montant à définir"}</b>
                            {o.amount && !closed ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {p} % → {formatMoney(percentOf(amount, p), { round: true })}
                              </span>
                            ) : null}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            {o.nextActionDate ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  late.has(o.id) ? "font-bold text-danger" : "text-muted-foreground",
                                )}
                              >
                                <CalendarClock aria-hidden="true" className="size-3.5" />
                                {late.has(o.id) ? "Relance en retard · " : ""}
                                {formatDay(o.nextActionDate)}
                              </span>
                            ) : !closed ? (
                              <span className="text-xs text-warning">Sans prochaine action</span>
                            ) : (
                              <span />
                            )}
                            <Avatar name={o.owner.name} />
                          </div>
                        </Card>
                      );
                    })}
                    {!list.length ? (
                      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        Aucune
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Aucune opportunité.">
              Créez la première depuis le bouton « Opportunité ».
            </EmptyState>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [
                "Pipeline brut",
                formatMoney(data.gross, { round: true }),
                `${data.openCount} opportunités ouvertes`,
              ],
              ["Pondéré", formatMoney(data.weighted, { round: true }), "Indicateur commercial, pas du CA"],
              [
                "Propositions envoyées",
                formatMoney(data.proposals.gross, { round: true }),
                `${data.proposals.count} en attente de réponse`,
              ],
              [
                "Relances en retard",
                String(data.lateIds.length),
                `${data.withoutNextIds.length} sans prochaine action`,
              ],
            ].map(([k, v, hint]) => (
              <Card key={k} className="gap-0.5 py-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-xl font-bold" data-testid={`kpi-${k}`}>
                  {v}
                </p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </Card>
            ))}
          </div>
          <Card className="gap-0 py-1">
            <table className="w-full text-sm">
              <caption className="sr-only">Montants par étape</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 font-normal">
                    Étape
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Nb
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Brut
                  </th>
                  <th scope="col" className="hidden py-2 text-right font-normal sm:table-cell">
                    Proba.
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Pondéré
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byStage.map((s) => (
                  <tr key={s.stage} className="border-b last:border-b-0">
                    <th scope="row" className="py-2 text-left font-bold">
                      {stageLabels[s.stage]}
                    </th>
                    <td className="py-2 text-right tabular-nums">{s.count}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.gross, { round: true })}</td>
                    <td className="hidden py-2 text-right tabular-nums sm:table-cell">
                      {data.settings[s.stage]} %
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {OPEN_STAGES.includes(s.stage) ? formatMoney(s.weighted, { round: true }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {data.lateIds.length ? (
            <Card className="gap-2">
              <h2 className="font-bold">Relances en retard</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {data.opps
                  .filter((o) => late.has(o.id))
                  .map((o) => (
                    <li key={o.id}>
                      <Link href={`/crm/opportunites/${o.id}`} className="font-bold hover:underline">
                        {o.title}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {o.nextAction ?? "relance"} · prévue le {formatDay(o.nextActionDate)} ·{" "}
                        {o.owner.name}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Le montant pondéré multiplie chaque montant par sa probabilité (saisie, sinon celle de
            l&apos;étape). Ce n&apos;est ni du chiffre d&apos;affaires reconnu ni de la trésorerie.
            Aujourd&apos;hui : {formatDay(today)}.
          </p>
        </>
      )}
    </>
  );
}

export default function CrmPage({ searchParams }: PageProps<"/crm">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="CRM" description="Pipeline commercial, relances et prévisions." />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/crm/clients">
              <Building2 aria-hidden="true" /> Entreprises
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Réglages du CRM">
            <Link href="/crm/reglages">
              <Settings2 aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild>
            <Link href="/crm/opportunites/nouvelle">
              <Plus aria-hidden="true" /> Opportunité
            </Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Signals />
      </Suspense>
      <Suspense fallback={<PageLoading />}>
        <Crm searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
