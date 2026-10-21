import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarDays, Check, ListChecks } from "lucide-react";
import { BackLink, EmptyState } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { DailyForm } from "@/features/briefing/components/daily-form";
import { moodLabels } from "@/features/briefing/rules";
import { dailyContext, dailyHistory, trackedOn } from "@/features/briefing/service";
import { formatMinutes } from "@/features/planning/rules";
import { requireUser } from "@/lib/auth/session";
import { formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "La mise en place" };

async function MiseEnPlace({ searchParams }: { searchParams: Promise<{ fait?: string }> }) {
  const user = await requireUser();
  const [ctx, history, sp] = await Promise.all([dailyContext(user.id), dailyHistory(user.id), searchParams]);
  const past = await Promise.all(
    history
      .filter((h) => h.day.getTime() !== ctx.today.getTime())
      .slice(0, 7)
      .map(async (h) => ({ ...h, tracked: await trackedOn(user.id, h.day) })),
  );
  const b = ctx.briefing;
  const tasks = ctx.priorities.tasks;
  return (
    <>
      {sp.fait && b ? (
        <FormAlert tone="success" title="Mise en place faite. Bon service !">
          Vos priorités sont prêtes ci-dessous ; le cockpit est à jour.
        </FormAlert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="size-5" />
            <CardTitle>1. Mes trois priorités</CardTitle>
          </div>
          {tasks.length ? (
            <ol className="flex flex-col">
              {tasks.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 border-t py-2 first:border-t-0">
                  <span className="font-annotation font-bold text-pen-strong">{i + 1}.</span>
                  <Link
                    href={`/taches/${t.id}`}
                    className="min-w-0 flex-1 truncate font-bold hover:underline"
                  >
                    {t.title}
                  </Link>
                  {t.status === "TERMINE" ? (
                    <Check aria-label="Terminée" className="size-4 text-success" />
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="Aucune tâche ouverte à prioriser." />
          )}
          <p className="text-sm text-muted-foreground">
            {ctx.priorities.chosen
              ? "Choisies pour aujourd'hui."
              : "Suggestion : elle sera confirmée en validant la mise en place."}{" "}
            <Link href="/priorites" className="font-bold text-pen-strong hover:underline">
              Changer
            </Link>
          </p>
        </Card>

        <Card className="gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-5" />
            <CardTitle>2. La charge prévue</CardTitle>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {formatMinutes(ctx.planned)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {formatMinutes(ctx.capacity)}
            </span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn(
                "h-full",
                ctx.load.tone === "danger"
                  ? "bg-danger"
                  : ctx.load.tone === "warning"
                    ? "bg-warning"
                    : "bg-ink",
              )}
              style={{ width: `${Math.min(100, ctx.load.pct)}%` }}
            />
          </div>
          <p className={cn("text-sm font-bold", ctx.load.tone === "danger" && "text-danger")}>
            {ctx.load.label}
          </p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            <li>
              {ctx.dueToday} tâche{ctx.dueToday > 1 ? "s" : ""} à rendre aujourd&apos;hui ou en retard
            </li>
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-3.5" /> {ctx.meetings} rendez-vous
            </li>
            {ctx.unestimated ? (
              <li className="font-annotation text-pen-strong">
                {ctx.unestimated} priorité{ctx.unestimated > 1 ? "s" : ""} sans estimation : non comptée
                {ctx.unestimated > 1 ? "s" : ""}.
              </li>
            ) : null}
          </ul>
          <p className="text-xs text-muted-foreground">
            Hypothèse : temps restant des priorités face à votre capacité hebdomadaire ÷ 5.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>3. Et vous ?</CardTitle>
        <DailyForm
          initial={b}
          plannedMinutes={ctx.planned}
          confirmTaskIds={ctx.priorities.chosen ? [] : tasks.map((t) => t.id)}
        />
      </Card>

      <Card className="gap-2">
        <CardTitle>Les jours précédents</CardTitle>
        <p className="text-sm text-muted-foreground">
          Privé. Prévu au matin, suivi le soir : pour mieux planifier, pas pour se juger.
        </p>
        {past.length ? (
          <ul className="flex flex-col">
            {past.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 border-t py-2 text-sm">
                <b className="w-40">{formatWeekday(h.day)}</b>
                <span className="text-muted-foreground">{h.mood ? moodLabels[h.mood] : "—"}</span>
                <span className="ml-auto tabular-nums">
                  prévu {h.plannedMinutes != null ? formatMinutes(h.plannedMinutes) : "—"} · suivi{" "}
                  {formatMinutes(h.tracked)}
                </span>
                {h.personalGoal ? (
                  <span className="w-full text-muted-foreground">Pour moi : {h.personalGoal}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Rien encore : l&apos;historique se construit jour après jour.
          </p>
        )}
      </Card>
    </>
  );
}

export default function MiseEnPlacePage({ searchParams }: PageProps<"/mise-en-place">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/">Cockpit</BackLink>
      <PageHeader
        crumb="3 à 5 minutes, pas plus"
        title="La mise en place"
        description="L'OS a préparé la journée : confirmez, ajustez, et au travail."
      />
      <Suspense fallback={<PageLoading />}>
        <MiseEnPlace searchParams={searchParams as Promise<{ fait?: string }>} />
      </Suspense>
    </div>
  );
}
