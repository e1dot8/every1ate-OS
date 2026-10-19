import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { BackLink, Chip, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { objectiveProgressFor } from "@/features/finance/analytics";
import { agencyCockpit, type Period } from "@/features/finance/cockpit";
import { ObjectiveGauges } from "@/features/finance/components/objective-gauges";
import { LOAD_WEEKS, upcomingLoad, type LoadTone, type UpcomingLoad } from "@/features/planning/load-service";
import { formatMinutes } from "@/features/planning/rules";
import { requireUser } from "@/lib/auth/session";
import { formatDay, todayDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cockpit agence" };

type SP = { periode?: string; equipe?: string };
const m = (c: number) => formatMoney(c, { round: true });

function Kpi({
  label,
  value,
  tag,
  tone,
}: {
  label: string;
  value: string | number;
  tag?: "prévisionnel" | "réalisé";
  tone?: "danger";
}) {
  return (
    <Card className="gap-0.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", tone === "danger" && "text-danger")}>{value}</p>
      {tag ? <p className="font-annotation text-xs text-pen-strong">{tag}</p> : null}
    </Card>
  );
}

const loadToneClass: Record<LoadTone, string> = {
  danger: "bg-danger-soft font-bold text-danger",
  warning: "bg-warning-soft font-bold text-warning",
  normal: "",
};

/** Grille associé × semaine : % de la capacité hebdomadaire (défile dans son cadre sur mobile). */
function LoadTable({ load }: { load: UpcomingLoad }) {
  if (!load.rows.length) return <EmptyState title="Aucun associé." />;
  return (
    <div
      role="region"
      aria-label="Charge à venir par associé"
      tabIndex={0}
      className="overflow-x-auto rounded-xl border bg-card"
    >
      <table className="w-full min-w-[38rem] text-sm">
        <caption className="sr-only">
          Charge à venir par associé et par semaine, en pourcentage de la capacité hebdomadaire
        </caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-3 py-2 text-left font-normal">
              Associé
            </th>
            {load.weekStarts.map((w) => (
              <th key={w.toISOString()} scope="col" className="px-1 py-2 text-center font-normal">
                <span className="sr-only">Semaine du </span>
                {formatDay(w)}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-normal">
              Non planifié
            </th>
          </tr>
        </thead>
        <tbody>
          {load.rows.map((r) => (
            <tr key={r.id} className="border-b last:border-b-0">
              <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left">
                <span className="block font-bold">{r.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {r.capacityHours} h/sem.{r.capacityIsDefault ? " (agence)" : ""}
                </span>
              </th>
              {r.cells.map((cell) => (
                <td key={cell.weekStart.toISOString()} className="px-1 py-2 text-center">
                  <span
                    title={`${formatMinutes(cell.minutes)} sur ${r.capacityHours} h`}
                    className={cn(
                      "inline-flex min-w-14 items-center justify-center gap-1 rounded-md px-1.5 py-1 tabular-nums",
                      loadToneClass[cell.tone],
                    )}
                  >
                    {cell.tone === "danger" ? (
                      <OctagonAlert aria-hidden="true" className="size-3" />
                    ) : cell.tone === "warning" ? (
                      <AlertTriangle aria-hidden="true" className="size-3" />
                    ) : null}
                    {cell.pct} %
                    <span className="sr-only">
                      {cell.tone === "danger" ? ", surchargé" : cell.tone === "warning" ? ", chargé" : ""} (
                      {formatMinutes(cell.minutes)})
                    </span>
                  </span>
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">
                {r.unplannedMinutes ? formatMinutes(r.unplannedMinutes) : "0 h"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Cockpit({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period: Period = sp.periode === "mois" || sp.periode === "trimestre" ? sp.periode : "semaine";
  const team = sp.equipe === "1";
  const today = todayDate();
  const [c, objectives, load] = await Promise.all([
    agencyCockpit({ userId: user.id, team, period }),
    objectiveProgressFor(today.getUTCFullYear(), today),
    upcomingLoad(LOAD_WEEKS, today),
  ]);
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return p.toString() ? `/cockpit?${p}` : "/cockpit";
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(["semaine", "mois", "trimestre"] as const).map((p) => (
          <Chip key={p} href={href({ periode: p === "semaine" ? undefined : p })} active={period === p}>
            {p === "semaine" ? "Semaine" : p === "mois" ? "Mois" : "Trimestre"}
          </Chip>
        ))}
        <span className="mx-1 w-px bg-border" aria-hidden="true" />
        <Chip href={href({ equipe: undefined })} active={!team}>
          Ma vue
        </Chip>
        <Chip href={href({ equipe: "1" })} active={team}>
          Équipe
        </Chip>
      </div>
      <p className="text-sm text-muted-foreground">
        Du {formatDay(c.range[0])} au {formatDay(c.range[1])} ·{" "}
        {team ? "toute l'agence" : "mes projets et tâches"}
      </p>

      <section aria-labelledby="c-projets" className="flex flex-col gap-2">
        <h2 id="c-projets" className="font-bold">
          Projets
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Actifs" value={c.projects.active} />
          <Kpi label="En retard" value={c.projects.late} tone={c.projects.late ? "danger" : undefined} />
          <Kpi label="Bloqués" value={c.projects.blocked} tone={c.projects.blocked ? "danger" : undefined} />
        </div>
      </section>

      <section aria-labelledby="c-crm" className="flex flex-col gap-2">
        <h2 id="c-crm" className="font-bold">
          Commercial
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Pipeline brut" value={m(c.crm.gross)} tag="prévisionnel" />
          <Kpi label="Pondéré" value={m(c.crm.weighted)} tag="prévisionnel" />
          <Kpi
            label="Propositions envoyées"
            value={`${c.crm.proposals.count} · ${m(c.crm.proposals.gross)}`}
          />
          <Kpi label="Relances en retard" value={c.crm.late} tone={c.crm.late ? "danger" : undefined} />
        </div>
      </section>

      <section aria-labelledby="c-finance" className="flex flex-col gap-2">
        <h2 id="c-finance" className="font-bold">
          Finance (période)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Facturation attendue" value={m(c.finance.billingExpected)} tag="prévisionnel" />
          <Kpi label="Encaissements" value={m(c.finance.collected)} tag="réalisé" />
          <Kpi label="Coûts engagés" value={m(c.finance.costsCommitted)} tag="réalisé" />
          <Kpi label="Coûts payés" value={m(c.finance.costsPaid)} tag="réalisé" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi
            label="Marge prévisionnelle (projets en cours)"
            value={m(c.finance.marginForecast)}
            tag="prévisionnel"
          />
          <Kpi label="Marge réelle (projets en cours)" value={m(c.finance.marginActual)} tag="réalisé" />
          <Kpi label="MRR contracté" value={m(c.finance.mrr)} />
        </div>
      </section>

      <section aria-labelledby="c-objectifs" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="c-objectifs" className="font-bold">
            Objectifs {objectives.year}
          </h2>
          {objectives.hasObjective ? (
            <Link
              href="/finance/analyses#objectifs"
              className="inline-flex min-h-tap items-center text-sm font-bold hover:underline"
            >
              Modifier les objectifs
            </Link>
          ) : null}
        </div>
        <Card>
          <ObjectiveGauges progress={objectives} today={today} editHref="/finance/analyses#objectifs" />
        </Card>
      </section>

      <section aria-labelledby="c-charge" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="c-charge" className="font-bold">
            Charge à venir ({LOAD_WEEKS} semaines)
          </h2>
          <Link
            href="/plus/reglages"
            className="inline-flex min-h-tap items-center text-sm font-bold hover:underline"
          >
            Régler les capacités
          </Link>
        </div>
        <LoadTable load={load} />
        <p className="text-xs text-muted-foreground">
          Reste à faire des tâches ouvertes (estimation − temps passé), réparti sur les jours ouvrés
          jusqu&apos;à l&apos;échéance ; une tâche en retard pèse sur la semaine en cours. Non planifié :
          tâches estimées sans échéance. Tâches sans estimation non comptées. Au-delà de 85 % : chargé ;
          au-delà de 100 % : surchargé.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-2">
          <CardTitle>Échéances de la période</CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {c.upcoming.tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/taches/${t.id}`} className="font-bold hover:underline">
                  {t.title}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {t.project.name} · {formatDay(t.dueDate)}
                </span>
              </li>
            ))}
            {!c.upcoming.tasks.length ? <li className="text-muted-foreground">Aucune échéance.</li> : null}
          </ul>
        </Card>
        <Card className="gap-2">
          <CardTitle>Prochaines actions commerciales</CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {c.upcoming.followUps.map((o) => (
              <li key={o.id}>
                <Link href={`/crm/opportunites/${o.id}`} className="font-bold hover:underline">
                  {o.title}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {o.nextAction ?? "relance"} · {formatDay(o.nextActionDate)}
                </span>
              </li>
            ))}
            {!c.upcoming.followUps.length ? <li className="text-muted-foreground">Aucune relance.</li> : null}
          </ul>
        </Card>
        <Card className="gap-2">
          <CardTitle>Charge de travail</CardTitle>
          <ul className="flex flex-col gap-1.5 text-sm">
            {c.workload.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2 border-b pb-1.5 last:border-b-0">
                <b>{w.name}</b>
                <span className="text-muted-foreground">
                  {w.openTasks} tâches ouvertes{w.lateTasks ? ` (${w.lateTasks} en retard)` : ""} · estimé{" "}
                  {formatMinutes(w.estimatedMinutes)} · suivi {formatMinutes(w.loggedMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="gap-2">
          <CardTitle>Livrables en attente de validation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bientôt disponible : arrive avec la collaboration externe (V2).
          </p>
        </Card>
      </div>
    </>
  );
}

export default function CockpitPage({ searchParams }: PageProps<"/cockpit">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/">Mon espace</BackLink>
      <PageHeader
        title="Cockpit agence"
        description="Les indicateurs financiers distinguent toujours le prévisionnel du réalisé."
      />
      <Suspense fallback={<PageLoading />}>
        <Cockpit searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
