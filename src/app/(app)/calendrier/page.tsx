import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Diamond, Lock, Plus, Rss } from "lucide-react";
import { Chip } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { localDay, utcToLocalInput, zonedToUtc } from "@/features/calendar/rules";
import { listDeadlines, listEvents } from "@/features/calendar/service";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatWeekday, parseDateInput, startOfWeek, toDateInput, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendrier" };

type SP = { vue?: string; date?: string; equipe?: string };
type Item = {
  key: string;
  day: string;
  time: string | null;
  title: string;
  href: string | null;
  kind: "event" | "busy" | "task" | "milestone";
  sub?: string;
};

const time = (d: Date) => utcToLocalInput(d).slice(11, 16);

async function CalendarView({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.vue === "semaine" || sp.vue === "mois" ? sp.vue : "agenda";
  const team = sp.equipe === "1";
  const anchor = parseDateInput(sp.date) ?? todayDate();
  let from: Date;
  let to: Date;
  if (view === "semaine") {
    from = startOfWeek(anchor);
    to = addDays(from, 7);
  } else if (view === "mois") {
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    from = startOfWeek(first);
    to = addDays(startOfWeek(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))), 7);
  } else {
    from = anchor;
    to = addDays(anchor, 14);
  }
  const fromUtc = zonedToUtc(`${toDateInput(from)}T00:00`)!;
  const toUtc = zonedToUtc(`${toDateInput(to)}T00:00`)!;
  const [events, deadlines] = await Promise.all([
    listEvents(fromUtc, toUtc, user.id, !team),
    listDeadlines(from, to, user.id, !team),
  ]);

  const items: Item[] = [];
  for (const e of events) {
    // Un événement sur plusieurs jours apparaît chaque jour concerné.
    for (
      let d = new Date(Math.max(e.startsAt.getTime(), fromUtc.getTime()));
      d < e.endsAt && d < toUtc;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const day = localDay(d);
      if (items.some((i) => i.key === `${e.id}-${day}`)) continue;
      items.push({
        key: `${e.id}-${day}`,
        day,
        time: e.allDay
          ? null
          : day === localDay(e.startsAt)
            ? `${time(e.startsAt)}–${time(e.endsAt)}`
            : "suite",
        title: e.title,
        href: e.busyOnly ? null : `/calendrier/${e.id}`,
        kind: e.busyOnly ? "busy" : "event",
        sub: e.busyOnly
          ? e.owner.name
          : [e.location, e.project?.name].filter(Boolean).join(" · ") || undefined,
      });
    }
  }
  for (const t of deadlines.tasks)
    items.push({
      key: `t-${t.id}`,
      day: toDateInput(t.dueDate),
      time: null,
      title: t.title,
      href: `/taches/${t.id}`,
      kind: "task",
      sub: t.project.name,
    });
  for (const m of deadlines.milestones)
    items.push({
      key: `m-${m.id}`,
      day: toDateInput(m.date),
      time: null,
      title: m.name,
      href: `/projets/${m.projectId}/roadmap`,
      kind: "milestone",
      sub: m.project.name,
    });
  items.sort((a, b) => (a.day + (a.time ?? "00")).localeCompare(b.day + (b.time ?? "00")));

  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(toDateInput(d));
  const step = view === "semaine" ? 7 : view === "mois" ? 0 : 14;
  const prev =
    view === "mois"
      ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1))
      : addDays(anchor, -step);
  const next =
    view === "mois"
      ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
      : addDays(anchor, step);
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return p.toString() ? `/calendrier?${p}` : "/calendrier";
  };
  const today = toDateInput(todayDate());

  const ItemRow = ({ i, compact }: { i: Item; compact?: boolean }) => {
    const label = (
      <>
        {i.kind === "busy" ? (
          <Lock aria-hidden="true" className="inline size-3" />
        ) : i.kind === "milestone" ? (
          <Diamond aria-hidden="true" className="inline size-3" />
        ) : null}{" "}
        {i.time ? <span className="tabular-nums">{i.time} </span> : null}
        <b>{i.kind === "task" ? `Échéance : ${i.title}` : i.title}</b>
        {!compact && i.sub ? <span className="text-muted-foreground"> · {i.sub}</span> : null}
      </>
    );
    const cls = cn(
      "block truncate rounded-md border-l-4 px-2 py-1 text-xs",
      i.kind === "event" && "border-ink bg-highlight/50",
      i.kind === "busy" && "border-muted-foreground bg-muted text-muted-foreground",
      i.kind === "task" && "border-pen bg-card",
      i.kind === "milestone" && "border-success bg-success-soft",
    );
    return i.href ? (
      <Link href={i.href} className={cn(cls, "hover:underline")}>
        {label}
      </Link>
    ) : (
      <span className={cls}>{label}</span>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(["agenda", "semaine", "mois"] as const).map((v) => (
          <Chip key={v} href={href({ vue: v === "agenda" ? undefined : v })} active={view === v}>
            {v === "agenda" ? "Agenda" : v === "semaine" ? "Semaine" : "Mois"}
          </Chip>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
        <Chip href={href({ equipe: undefined })} active={!team}>
          Mon agenda
        </Chip>
        <Chip href={href({ equipe: "1" })} active={team}>
          Équipe
        </Chip>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Période précédente">
          <Link href={href({ date: toDateInput(prev) })}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <Link href={href({ date: undefined })} className="text-sm font-bold underline">
          Aujourd&apos;hui
        </Link>
        <Button asChild variant="ghost" size="icon" aria-label="Période suivante">
          <Link href={href({ date: toDateInput(next) })}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          {view === "mois"
            ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
                anchor,
              )
            : `${formatWeekday(from)} → ${formatWeekday(addDays(to, -1))}`}
        </span>
      </div>

      {view === "mois" ? (
        <div
          className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card text-xs"
          role="grid"
          aria-label="Mois"
        >
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} role="columnheader" className="border-b bg-muted/60 p-1 text-center font-bold">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const list = items.filter((i) => i.day === day);
            const out = parseDateInput(day)!.getUTCMonth() !== anchor.getUTCMonth();
            return (
              <div
                key={day}
                role="gridcell"
                aria-label={formatWeekday(parseDateInput(day)!)}
                className={cn(
                  "min-h-20 border-r border-b p-1 last:border-r-0",
                  out && "bg-muted/30 text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-block rounded-full px-1.5 font-bold",
                    day === today && "bg-ink text-paper",
                  )}
                >
                  {parseDateInput(day)!.getUTCDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {list.slice(0, 3).map((i) => (
                    <ItemRow key={i.key} i={i} compact />
                  ))}
                  {list.length > 3 ? (
                    <Link href={href({ vue: undefined, date: day })} className="text-[11px] underline">
                      +{list.length - 3}
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "semaine" ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((day) => (
            <section
              key={day}
              aria-label={formatWeekday(parseDateInput(day)!)}
              className={cn(
                "flex min-h-24 flex-col gap-1 rounded-xl border bg-card p-2",
                day === today && "border-2 border-ink",
              )}
            >
              <h2 className="text-xs font-bold">{formatWeekday(parseDateInput(day)!)}</h2>
              {items
                .filter((i) => i.day === day)
                .map((i) => (
                  <ItemRow key={i.key} i={i} compact />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {days
            .filter((day) => items.some((i) => i.day === day))
            .map((day) => (
              <section key={day} aria-label={formatWeekday(parseDateInput(day)!)}>
                <h2 className={cn("mb-1 text-sm font-bold", day === today && "text-pen-strong")}>
                  {formatWeekday(parseDateInput(day)!)}
                  {day === today ? " · aujourd'hui" : ""}
                </h2>
                <Card className="gap-1 py-2">
                  {items
                    .filter((i) => i.day === day)
                    .map((i) => (
                      <ItemRow key={i.key} i={i} />
                    ))}
                </Card>
              </section>
            ))}
          {!items.length ? (
            <p className="text-sm text-muted-foreground">Rien de prévu sur les 14 prochains jours.</p>
          ) : null}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Les événements privés des autres associés apparaissent comme « Occupé ». Heures affichées en
        Europe/Paris.
      </p>
    </>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Calendrier" description="Réunions, échéances et jalons." />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/calendrier/abonnement">
              <Rss aria-hidden="true" /> Google / Apple
            </Link>
          </Button>
          <Button asChild>
            <Link href="/calendrier/nouveau">
              <Plus aria-hidden="true" /> Événement
            </Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<PageLoading />}>
        <CalendarView searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
