import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink, Chip, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/features/planning/rules";
import { categoryLabels, overrunReasonLabels } from "@/features/time/estimate-rules";
import { timeReport } from "@/features/time/estimate-service";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDay, startOfWeek, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { OverrunReason, TaskCategory } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Rapport de temps" };

const PERIODS = {
  semaine: "Cette semaine",
  mois: "30 derniers jours",
  trimestre: "90 derniers jours",
} as const;
type Period = keyof typeof PERIODS;

function range(period: Period, today: Date): [Date, Date] {
  if (period === "semaine") return [startOfWeek(today), today];
  return [addDays(today, period === "mois" ? -29 : -89), today];
}

const signed = (m: number) => `${m >= 0 ? "+" : "−"}${formatMinutes(Math.abs(m))}`;

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <b className="tabular-nums">{formatMinutes(value)}</b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-ink" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

async function Report({ searchParams }: { searchParams: Promise<{ periode?: string; vue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period: Period = sp.periode && sp.periode in PERIODS ? (sp.periode as Period) : "mois";
  const team = sp.vue === "brigade";
  const [from, to] = range(period, todayDate());
  const r = await timeReport({ userId: team ? null : user.id, from, to });
  const q = (p: Period, v: boolean) => `/temps/rapport?periode=${p}${v ? "&vue=brigade" : ""}`;
  const maxCat = Math.max(0, ...r.byCategory.map(([, m]) => m));
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Période">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Chip key={p} href={q(p, team)} active={p === period}>
            {PERIODS[p]}
          </Chip>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
        <Chip href={q(period, false)} active={!team}>
          Moi
        </Chip>
        <Chip href={q(period, true)} active={team}>
          La brigade (totaux)
        </Chip>
      </div>
      <p className="text-sm text-muted-foreground">
        Du {formatDay(from)} au {formatDay(to)}.{" "}
        {team ? "Totaux de la brigade, sans détail par personne." : "Vos saisies uniquement."}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Temps suivi", formatMinutes(r.total)],
          ["Temps client", formatMinutes(r.client)],
          ["Temps interne", formatMinutes(r.internal)],
          ["Charge à venir", formatMinutes(r.upcoming)],
        ].map(([k, v]) => (
          <Card key={k} className="gap-0.5 py-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>
      {r.unestimated ? (
        <p className="font-annotation text-sm text-pen-strong">
          {r.unestimated} tâche{r.unestimated > 1 ? "s" : ""} ouverte{r.unestimated > 1 ? "s" : ""} sans
          estimation : la charge à venir est sous-estimée d&apos;autant.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>Prévu vs réel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tâches terminées sur la période, avec une estimation.
          </p>
          {r.compared.length ? (
            <>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Prévu</dt>
                  <dd className="text-lg font-bold">{formatMinutes(r.planned)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Réel</dt>
                  <dd className="text-lg font-bold">{formatMinutes(r.actual)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Écart</dt>
                  <dd className="text-lg font-bold">
                    {signed(r.actual - r.planned)}
                    {r.planned ? ` (${Math.round(((r.actual - r.planned) / r.planned) * 100)} %)` : ""}
                  </dd>
                </div>
              </dl>
              <ul className="flex flex-col">
                {r.compared.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-t py-2 text-sm">
                    <Link
                      href={`/taches/${c.id}`}
                      className="min-w-0 flex-1 truncate font-bold hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">
                      {formatMinutes(c.v.estimated)} → {formatMinutes(c.v.actual)}
                    </span>
                    <span
                      className={cn(
                        "w-20 text-right font-bold tabular-nums",
                        c.v.overrun ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {signed(c.v.absolute)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title="Rien à comparer pour l'instant.">
              Estimez vos tâches : à la clôture, l&apos;écart s&apos;affiche ici.
            </EmptyState>
          )}
        </Card>

        <Card className="gap-3">
          <CardTitle>Par type d&apos;activité</CardTitle>
          {r.byCategory.length ? (
            <div className="flex flex-col gap-3">
              {r.byCategory.map(([cat, m]) => (
                <Bar key={cat} label={categoryLabels[cat as TaskCategory]} value={m} max={maxCat} />
              ))}
            </div>
          ) : (
            <EmptyState title="Aucun temps suivi sur la période." />
          )}
        </Card>

        <Card className="gap-3">
          <CardTitle>Par projet</CardTitle>
          {r.byProject.length ? (
            <ul className="flex flex-col">
              {r.byProject.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-t py-2 text-sm first:border-t-0">
                  <Link
                    href={`/projets/${p.id}`}
                    className="min-w-0 flex-1 truncate font-bold hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.internal ? <span className="text-xs text-muted-foreground">interne</span> : null}
                  <span className="tabular-nums">{formatMinutes(p.tracked)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun temps suivi sur la période." />
          )}
        </Card>

        <Card className="gap-3">
          <CardTitle>Pourquoi ça a dépassé</CardTitle>
          <p className="text-sm text-muted-foreground">
            Les raisons données dans les mini-bilans. Pour mieux chiffrer, pas pour juger.
          </p>
          {r.reasons.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {r.reasons.map(([reason, n]) => (
                <li key={reason} className="flex justify-between">
                  <span>{overrunReasonLabels[reason as OverrunReason]}</span>
                  <b>{n}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun bilan sur la période." />
          )}
        </Card>
      </div>
    </>
  );
}

export default function TimeReportPage({ searchParams }: PageProps<"/temps/rapport">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/temps">Temps</BackLink>
      <PageHeader
        crumb="pour mieux chiffrer"
        title="Rapport de temps"
        description="Aucune collecte cachée : seulement le chronomètre et les saisies que vous faites."
      />
      <Suspense fallback={<PageLoading />}>
        <Report searchParams={searchParams as Promise<{ periode?: string; vue?: string }>} />
      </Suspense>
    </div>
  );
}
