import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Check, Circle, Lock } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { getWeek, weekOf } from "@/features/briefing/service";
import { listFeed } from "@/features/brigade/service";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { BuildingMap } from "@/features/maison/components/building-map";
import { ROOM_ICONS } from "@/features/maison/room-icons";
import { ROOMS } from "@/features/maison/rooms";
import { availabilities, availabilityLabels, avatarsOf, roomPreviews } from "@/features/maison/service";
import { upcomingLoad } from "@/features/planning/load-service";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDateTime, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "La maison" };

function Panel({
  title,
  href,
  children,
  tone,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
  tone?: "highlight";
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border-t pt-4",
        tone === "highlight" && "rounded-md border border-ink bg-highlight/70 p-4",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {href ? (
          <Link
            href={href}
            aria-label={`Ouvrir : ${title}`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-ink/20 hover:bg-paper"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

async function House() {
  const user = await requireUser();
  const today = todayDate();
  const [previews, associates, week, feed, avail, load] = await Promise.all([
    roomPreviews(user.id),
    listAssociates(),
    getWeek(weekOf(today)),
    listFeed(user.id, 4),
    availabilities(today),
    upcomingLoad(1),
  ]);
  const [looks, openCounts] = await Promise.all([
    avatarsOf(associates.map((a) => a.id)),
    getDb().task.groupBy({
      by: ["ownerId"],
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        ownerId: { in: associates.map((a) => a.id) },
      },
      _count: { _all: true },
    }),
  ]);
  const goals = week?.items.filter((i) => i.kind === "OBJECTIF") ?? [];
  const reached = goals.filter((g) => g.status === "ATTEINT").length;
  const me = associates.find((a) => a.id === user.id);
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
            Bienvenue à la maison,
          </p>
          <h1 className="text-5xl leading-none font-bold tracking-[-0.04em] md:text-7xl">
            {me?.name ?? user.name}.
          </h1>
          <p className="mt-2 max-w-md text-muted-foreground">Créer. Produire. Partager. Grandir ensemble.</p>
        </header>
        <div className="relative">
          <p
            aria-hidden="true"
            className="absolute top-2 right-0 hidden -rotate-6 font-annotation text-sm text-pen-strong lg:block"
          >
            same recipe,
            <br />
            bigger plans.
          </p>
          <BuildingMap previews={previews} />
        </div>
        <nav aria-label="Pièces de la maison" className="border-t pt-3">
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROOMS.map((r) => {
              const Icon = ROOM_ICONS[r.key];
              return (
                <li key={r.key} className="border-b">
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="flex min-h-12 items-center gap-2 py-1.5 text-sm hover:underline"
                    >
                      <span className="w-4 font-bold">{r.number}</span>
                      <Icon aria-hidden="true" className="size-4" />
                      <span className="flex min-w-0 flex-col">
                        <b>{r.name}</b>
                        <span className="truncate text-xs text-muted-foreground">{previews[r.key]}</span>
                      </span>
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex min-h-12 items-center gap-2 py-1.5 text-sm text-muted-foreground"
                    >
                      <span className="w-4 font-bold">{r.number}</span>
                      <Lock aria-hidden="true" className="size-4" />
                      <span className="flex flex-col">
                        <b>{r.name}</b>
                        <span className="text-xs">{r.comingSoon}</span>
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <aside className="flex flex-col gap-6">
        <Panel title="La brigade aujourd'hui" href="/bureau">
          <ul className="flex flex-col">
            {associates.map((a) => {
              const n = openCounts.find((c) => c.ownerId === a.id)?._count._all ?? 0;
              const pct = load.rows.find((r) => r.id === a.id)?.cells[0]?.pct ?? 0;
              const status = avail.get(a.id);
              return (
                <li key={a.id} className="border-b last:border-b-0">
                  <Link
                    href={a.id === user.id ? "/appartement" : `/appartement?associe=${a.id}`}
                    className="flex min-h-14 items-center gap-3 py-2 hover:bg-muted/50"
                  >
                    <BrigadeAvatar look={looks.get(a.id)!} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <b className="text-sm">{a.name}</b>
                      <span className="text-xs text-muted-foreground">
                        {n} tâche{n > 1 ? "s" : ""}
                        {status ? ` · ${availabilityLabels[status]}` : ""}
                      </span>
                    </span>
                    <span
                      className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
                      title={`Charge de la semaine : ${pct} %`}
                    >
                      <span
                        className={cn("block h-full", pct > 100 ? "bg-danger" : "bg-ink")}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title={`Objectifs de la semaine ${goals.length ? `${reached}/${goals.length}` : ""}`.trim()}
          href="/service"
          tone="highlight"
        >
          {goals.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {goals.map((g) => (
                <li key={g.id} className="flex items-start gap-2">
                  {g.status === "ATTEINT" ? (
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-ink text-highlight">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                  ) : (
                    <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span className={cn(g.status === "ATTEINT" && "line-through decoration-1")}>{g.title}</span>
                  <span className="sr-only">{g.status === "ATTEINT" ? " (atteint)" : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">Le service de la semaine n&apos;a pas encore d&apos;objectifs.</p>
          )}
        </Panel>

        <Panel title="Dernières activités" href="/bureau">
          {feed.length ? (
            <ul className="flex flex-col gap-2.5 text-sm">
              {feed.map((e) => (
                <li key={e.id} className="flex flex-col">
                  {e.href ? (
                    <Link href={e.href} className="hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    <span>{e.title}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Rien encore : la première réussite s&apos;affichera ici.
            </p>
          )}
        </Panel>
      </aside>
    </div>
  );
}

export default function HousePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <House />
    </Suspense>
  );
}
