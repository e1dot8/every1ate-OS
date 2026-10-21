import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Award, HeartHandshake, House, PartyPopper, Target, TrendingUp } from "lucide-react";
import { Avatar, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { PEER_BADGES } from "@/features/badges/catalog";
import { moodLabels } from "@/features/briefing/rules";
import { getWeek, weekContext, weekOf } from "@/features/briefing/service";
import { CheerForm, PeerBadgeForm } from "@/features/brigade/components/forms";
import { houseProgress } from "@/features/brigade/house";
import { listFeed } from "@/features/brigade/service";
import { formatMinutes } from "@/features/planning/rules";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Le bureau commun" };

const EVENT_ICONS = {
  badge: Award,
  rang: TrendingUp,
  projet: PartyPopper,
  objectif: Target,
  aide: HeartHandshake,
};

async function Office() {
  const user = await requireUser();
  const db = getDb();
  const today = todayDate();
  const week = weekOf(today);
  const [menu, ctx, feed, associates, delivered, goalsReached, help, moods] = await Promise.all([
    getWeek(week),
    weekContext(week),
    listFeed(user.id),
    listAssociates(),
    db.project.count({ where: { internal: false, closedAt: { not: null } } }),
    db.weeklyItem.count({ where: { kind: "OBJECTIF", status: "ATTEINT" } }),
    db.dailyBriefing.findMany({
      where: { day: today, helpWanted: true },
      select: { id: true, blocker: true, user: { select: { id: true, name: true } } },
    }),
    db.dailyBriefing.findMany({
      where: { day: today, moodShared: true, mood: { not: null } },
      select: { mood: true, user: { select: { name: true } } },
    }),
  ]);
  const house = houseProgress(delivered, goalsReached);
  const goals = menu?.items.filter((i) => i.kind === "OBJECTIF") ?? [];
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gap-3 md:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle>Les objectifs de la semaine</CardTitle>
            <Link href="/menu-semaine" className="text-sm font-bold text-pen-strong hover:underline">
              Le menu
            </Link>
          </div>
          {goals.length ? (
            <ul className="flex flex-col">
              {goals.map((g) => (
                <li key={g.id} className="flex items-center gap-3 border-t py-2 first:border-t-0">
                  <Target
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0",
                      g.status === "ATTEINT" ? "text-success" : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <b className={cn(g.status !== "OUVERT" && "text-muted-foreground")}>{g.title}</b>
                    {g.detail ? (
                      <span className="block text-[13px] text-muted-foreground">{g.detail}</span>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted-foreground">{g.owner?.name ?? "Brigade"}</span>
                  <span className="text-xs font-bold">
                    {g.status === "ATTEINT"
                      ? "Atteint"
                      : g.status === "NON_ATTEINT"
                        ? "Non atteint"
                        : "En cours"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Pas encore d'objectifs cette semaine.">
              <Link href="/menu-semaine" className="font-bold underline">
                Ouvrir le menu de la semaine
              </Link>
            </EmptyState>
          )}
        </Card>

        <section aria-labelledby="maison" className="flex flex-col gap-3 rounded-xl bg-ink p-5 text-paper">
          <div className="flex items-center gap-2">
            <House aria-hidden="true" className="size-5 text-highlight" />
            <h2 id="maison" className="text-lg font-bold">
              La maison
            </h2>
          </div>
          <p className="text-4xl leading-none font-bold tabular-nums">{house.points}</p>
          <p className="text-sm text-paper/75">
            {delivered} projet{delivered > 1 ? "s" : ""} livré{delivered > 1 ? "s" : ""} · {goalsReached}{" "}
            objectif
            {goalsReached > 1 ? "s" : ""} atteint{goalsReached > 1 ? "s" : ""}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-paper/20" aria-hidden="true">
            <div className="h-full bg-highlight" style={{ width: `${house.percent}%` }} />
          </div>
          <p className="font-annotation text-xs text-highlight">
            {house.next ? `prochain palier : ${house.next}` : "tous les paliers sont atteints"}
          </p>
          <p className="text-xs text-paper/60">Progression collective, séparée des niveaux de chacun.</p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>Coups de main demandés</CardTitle>
          {help.length || ctx.blocked.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {help.map((h) => (
                <li key={h.id} className="flex items-start gap-2 rounded-lg bg-highlight/40 p-2">
                  <HeartHandshake aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <b>{h.user.name}</b> : {h.blocker}
                  </span>
                </li>
              ))}
              {ctx.blocked.map((b) => (
                <li key={b.id} className="flex items-start gap-2">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                  <span>
                    <Link href={`/taches/${b.id}`} className="font-bold hover:underline">
                      {b.title}
                    </Link>
                    {b.blockedReason ? (
                      <span className="text-muted-foreground"> — {b.blockedReason}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Personne n&apos;est bloqué. Belle cuisine.</p>
          )}
          {moods.length ? (
            <p className="border-t pt-2 text-sm text-muted-foreground">
              Météo partagée :{" "}
              {moods.map((m, i) => (
                <span key={i}>
                  {i ? " · " : ""}
                  {m.user.name} {moodLabels[m.mood!].toLowerCase()}
                </span>
              ))}
            </p>
          ) : null}
        </Card>

        <Card className="gap-3">
          <CardTitle>La charge de la semaine</CardTitle>
          <ul className="flex flex-col gap-2.5">
            {ctx.load.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <b>{p.name}</b>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMinutes(p.minutes)} / {p.capacityHours} h
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn(
                      "h-full",
                      p.tone === "danger" ? "bg-danger" : p.tone === "warning" ? "bg-warning" : "bg-ink",
                    )}
                    style={{ width: `${Math.min(100, p.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            D&apos;après les estimations déclarées : pour se répartir le travail, pas pour se comparer.
          </p>
        </Card>
      </div>

      <Card className="gap-3">
        <CardTitle>Les livrables à venir</CardTitle>
        {ctx.upcoming.length ? (
          <ul className="grid gap-x-6 md:grid-cols-2">
            {ctx.upcoming.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b py-2 text-sm">
                <span className="w-14 shrink-0 text-muted-foreground">{formatDay(t.dueDate)}</span>
                <Link href={`/taches/${t.id}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                  {t.title}
                </Link>
                <Avatar name={t.owner?.name ?? null} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Rien d'attendu dans les deux semaines." />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_22rem]">
        <Card className="gap-3">
          <CardTitle>Le fil de la brigade</CardTitle>
          <p className="text-sm text-muted-foreground">
            Les réussites à célébrer. Pas de classement, jamais.
          </p>
          {feed.length ? (
            <ul className="flex flex-col">
              {feed.map((e) => {
                const Icon = EVENT_ICONS[e.kind as keyof typeof EVENT_ICONS] ?? Award;
                return (
                  <li key={e.id} className="flex flex-col gap-2 border-t py-3 first:border-t-0">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold">{e.title}</span>
                        {e.detail ? <span className="text-sm text-muted-foreground">{e.detail}</span> : null}
                        <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                      </div>
                    </div>
                    {e.cheers.length ? (
                      <ul className="ml-12 flex flex-col gap-0.5 text-sm">
                        {e.cheers.map((c) => (
                          <li key={c.id}>
                            <b>{c.user.name}</b> : {c.message ?? "bravo !"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {e.userId && e.userId !== user.id && !e.cheeredByMe ? (
                      <div className="ml-12">
                        <CheerForm eventId={e.id} title={e.title} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Le fil est encore vide.">
              Un projet livré, un badge, un objectif atteint : tout s&apos;affichera ici.
            </EmptyState>
          )}
        </Card>
        <Card className="gap-3 self-start">
          <CardTitle>Reconnaître un associé</CardTitle>
          <p className="text-sm text-muted-foreground">
            Une aide, une méthode partagée, une finition remarquable : dites-le avec un badge.
          </p>
          <PeerBadgeForm
            associates={associates
              .filter((a) => a.id !== user.id)
              .map((a) => ({ value: a.id, label: a.name }))}
            badges={PEER_BADGES.map((b) => ({
              value: b.key,
              label: `${b.name}${b.xp ? ` (+${b.xp} XP)` : ""}`,
            }))}
          />
        </Card>
      </div>
    </>
  );
}

export default function OfficePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="la brigade, ensemble"
        title="Le bureau commun"
        description="L'état de la maison, ce qui coince, et ce qu'on célèbre."
      />
      <Suspense fallback={<PageLoading />}>
        <Office />
      </Suspense>
    </div>
  );
}
