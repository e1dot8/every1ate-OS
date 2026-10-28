import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarRange, Timer } from "lucide-react";
import { Avatar, EmptyState, Progress, ProjectStatusBadge } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/features/planning/rules";
import { listProjects } from "@/features/projects/service";
import { taskStatusLabels } from "@/features/projects/labels";
import { getActiveTimer, userTotals } from "@/features/time/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { addDays, formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "L'atelier" };

const OPEN = ["A_FAIRE", "EN_COURS", "EN_REVUE", "EN_ATTENTE", "BLOQUE"] as const;

/** L'atelier : la production en un coup d'œil, chaque ligne mène à la vraie page. */
async function Workshop() {
  const user = await requireUser();
  const db = getDb();
  const today = todayDate();
  const [projects, mine, upcoming, totals, active] = await Promise.all([
    listProjects({ scope: "en-cours" }),
    db.task.groupBy({
      by: ["status"],
      where: { archivedAt: null, ownerId: user.id, status: { in: [...OPEN] }, project: { archivedAt: null } },
      _count: { _all: true },
    }),
    db.task.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { gte: today, lte: addDays(today, 14) },
        project: { archivedAt: null, internal: false },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        dueDate: true,
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    userTotals(user.id),
    getActiveTimer(user.id),
  ]);
  const count = (s: (typeof OPEN)[number]) => mine.find((m) => m.status === s)?._count._all ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {OPEN.map((s) => (
          <Link
            key={s}
            href="/taches"
            className={cn(
              "rounded-xl border bg-card p-3 hover:border-ink",
              s === "BLOQUE" && count(s) && "border-danger",
            )}
          >
            <p className="text-xs text-muted-foreground">{taskStatusLabels[s]}</p>
            <p className="text-2xl font-bold tabular-nums">{count(s)}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_20rem]">
        <Card className="gap-2">
          <div className="flex items-baseline justify-between">
            <CardTitle>Les projets en fabrication</CardTitle>
            <Link href="/projets" className="text-sm font-bold text-pen-strong hover:underline">
              Tous
            </Link>
          </div>
          {projects.length ? (
            <ul className="flex flex-col">
              {projects.slice(0, 8).map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 border-t py-3 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/projets/${p.id}`}
                      className="min-w-0 flex-1 truncate font-bold hover:underline"
                    >
                      {p.name}
                    </Link>
                    <ProjectStatusBadge status={p.status} />
                    <Link
                      href={`/projets/${p.id}/roadmap`}
                      aria-label={`Roadmap de ${p.name}`}
                      className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
                    >
                      <CalendarRange aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                  <Progress
                    value={p.taskTotal ? (p.taskDone / p.taskTotal) * 100 : 0}
                    label={`Avancement de ${p.name}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.taskDone}/{p.taskTotal} tâches · {p.client?.name ?? "sans client"}
                    {p.taskBlocked ? ` · ${p.taskBlocked} bloquée${p.taskBlocked > 1 ? "s" : ""}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun projet en cours." />
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="gap-2">
            <CardTitle>Mon temps</CardTitle>
            {active ? (
              <Link href={`/taches/${active.taskId}`} className="flex items-center gap-2 text-sm font-bold">
                <Timer aria-hidden="true" className="size-4" /> {active.task.title}
              </Link>
            ) : null}
            <p className="text-2xl font-bold tabular-nums">{formatMinutes(totals.week)}</p>
            <p className="text-sm text-muted-foreground">suivies cette semaine</p>
            <div className="flex gap-3 text-sm font-bold">
              <Link href="/temps" className="text-pen-strong hover:underline">
                Saisies
              </Link>
              <Link href="/temps/rapport" className="text-pen-strong hover:underline">
                Prévu vs réel
              </Link>
            </div>
          </Card>
          <Card className="gap-2">
            <CardTitle>Livrables sous 14 jours</CardTitle>
            {upcoming.length ? (
              <ul className="flex flex-col">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 border-t py-2 text-sm first:border-t-0">
                    <span className="w-12 shrink-0 text-muted-foreground">{formatDay(t.dueDate)}</span>
                    <Link
                      href={`/taches/${t.id}`}
                      className="min-w-0 flex-1 truncate font-bold hover:underline"
                    >
                      {t.title}
                    </Link>
                    <Avatar name={t.owner?.name ?? null} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Rien d&apos;attendu sous 14 jours.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function WorkshopPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="la fabrication"
        title="L'atelier"
        description="Projets, tâches, livrables et temps : la production en un coup d'œil."
      />
      <Suspense fallback={<PageLoading />}>
        <Workshop />
      </Suspense>
    </div>
  );
}
