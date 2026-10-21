import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/features/planning/rules";
import { ManualTimeForm, TimerControl } from "@/features/time/components/timer";
import { entryMinutes, getActiveTimer, listEntries, listTasksForTime } from "@/features/time/service";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatTime, formatWeekday, startOfWeek, toDateInput, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Temps" };

async function TimeView() {
  const user = await requireUser();
  const today = todayDate();
  const monday = startOfWeek(today);
  const [active, entries, tasks] = await Promise.all([
    getActiveTimer(user.id),
    listEntries(user.id, addDays(monday, -21), today),
    listTasksForTime(),
  ]);
  const now = new Date();
  const week = entries.filter((e) => e.date >= monday).reduce((n, e) => n + entryMinutes(e, now), 0);
  const day = entries
    .filter((e) => e.date.getTime() === today.getTime())
    .reduce((n, e) => n + entryMinutes(e, now), 0);
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = toDateInput(e.date);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1">
          <p className="text-sm text-muted-foreground">Aujourd&apos;hui</p>
          <p className="text-2xl font-bold" data-testid="temps-jour">
            {formatMinutes(day)}
          </p>
        </Card>
        <Card className="gap-1">
          <p className="text-sm text-muted-foreground">Cette semaine</p>
          <p className="text-2xl font-bold" data-testid="temps-semaine">
            {formatMinutes(week)}
          </p>
        </Card>
      </div>
      {active ? (
        <Card className="gap-2 border-2 border-ink">
          <CardTitle>
            Chronomètre en cours :{" "}
            <Link href={`/taches/${active.taskId}`} className="underline">
              {active.task.title}
            </Link>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{active.task.project.name}</p>
          <TimerControl taskId={active.taskId} startedAt={active.startedAt!.toISOString()} />
        </Card>
      ) : null}
      <Card className="gap-3">
        <CardTitle>Saisir du temps</CardTitle>
        <ManualTimeForm
          today={toDateInput(today)}
          tasks={tasks.map((t) => ({ value: t.id, label: `${t.title} · ${t.project.name}` }))}
        />
      </Card>
      <section aria-labelledby="releve" className="flex flex-col gap-3">
        <h2 id="releve" className="text-xl font-bold">
          Mes saisies (4 dernières semaines)
        </h2>
        {[...byDay.entries()].map(([k, list]) => (
          <Card key={k} className="gap-1 py-3">
            <div className="flex justify-between text-sm font-bold">
              <span>{formatWeekday(new Date(`${k}T00:00:00Z`))}</span>
              <span>{formatMinutes(list.reduce((n, e) => n + entryMinutes(e, now), 0))}</span>
            </div>
            <ul className="flex flex-col">
              {list.map((e) => {
                const running = e.source === "TIMER" && !e.endedAt;
                return (
                  <li
                    key={e.id}
                    className="flex min-h-tap items-center gap-2 border-t text-sm first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col py-1.5">
                      <Link href={`/taches/${e.taskId}`} className="truncate font-bold hover:underline">
                        {e.task.title}
                      </Link>
                      <span className="truncate text-muted-foreground">
                        {e.task.project.name} ·{" "}
                        {e.source === "TIMER"
                          ? `chrono ${formatTime(e.startedAt)}–${running ? "…" : formatTime(e.endedAt)}`
                          : "saisie manuelle"}
                        {e.comment ? ` · ${e.comment}` : ""}
                      </span>
                    </span>
                    <b className="tabular-nums">
                      {running ? "en cours" : formatMinutes(e.durationMinutes ?? 0)}
                    </b>
                    {!running ? (
                      <Link
                        href={`/temps/${e.id}`}
                        aria-label={`Corriger la saisie ${e.task.title}`}
                        className="inline-flex size-tap items-center justify-center rounded-lg hover:bg-muted"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        {!entries.length ? (
          <p className="text-sm text-muted-foreground">Aucune saisie sur la période.</p>
        ) : null}
      </section>
      <p className="text-sm text-muted-foreground">
        Les heures réelles servent aux analyses de charge et de marge ; elles ne sont pas des montants
        facturables.
      </p>
    </>
  );
}

export default function TimePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Temps" description="Chronomètre, saisies manuelles et corrections historisées." />
      <Link
        href="/temps/rapport"
        className="inline-flex min-h-tap w-fit items-center gap-1.5 rounded-full border px-3 text-sm font-bold hover:bg-muted"
      >
        Prévu vs réel, client vs interne : le rapport
      </Link>
      <Suspense fallback={<PageLoading />}>
        <TimeView />
      </Suspense>
    </div>
  );
}
