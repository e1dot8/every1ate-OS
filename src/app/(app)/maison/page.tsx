import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { listFeed } from "@/features/brigade/service";
import { buildingPhoto } from "@/features/maison/assets";
import { brigadeToday, weekGoals } from "@/features/maison/brigade-today";
import { BuildingMap } from "@/features/maison/components/building-map";
import {
  BrigadeToday,
  LatestActivity,
  PanelTitle,
  WeekGoals,
} from "@/features/maison/components/house-panels";
import { ROOM_ICONS } from "@/features/maison/room-icons";
import { ROOMS } from "@/features/maison/rooms";
import { roomPreviews } from "@/features/maison/service";
import { requireUser } from "@/lib/auth/session";
import { todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "La maison" };

async function House() {
  const user = await requireUser();
  const today = todayDate();
  const [previews, rows, goals, feed] = await Promise.all([
    roomPreviews(user.id),
    brigadeToday(user.id, today),
    weekGoals(today),
    listFeed(user.id, 4),
  ]);
  const firstName = rows.find((r) => r.id === user.id)?.name ?? user.name;
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-paper to-[#f2f1ec] px-5 pt-7 pb-4 md:px-9">
        <header className="relative z-10 flex flex-col gap-1">
          <p className="text-[11px] font-bold tracking-[0.28em] text-ink/70 uppercase">
            Bienvenue à la maison,
          </p>
          <h1 className="text-6xl leading-[0.95] font-bold tracking-[-0.05em] md:text-8xl">{firstName}.</h1>
          <p className="mt-3 max-w-[19rem] text-[17px] leading-snug text-ink/70">
            Créer. Produire. Partager. Grandir ensemble.
          </p>
        </header>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute top-24 right-8 hidden -rotate-[8deg] font-hand text-2xl leading-tight text-ink lg:block"
        >
          SAME RECIPE
          <br />
          BIGGER PLANS.
          <svg
            viewBox="0 0 120 16"
            className="mt-1 ml-10 h-3 w-28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 12 Q60 2 118 6 M20 14 Q70 8 110 11" strokeLinecap="round" />
          </svg>
        </p>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-36 left-8 z-10 hidden -rotate-[10deg] font-hand text-xl leading-[1.15] text-ink lg:block"
        >
          CREATE
          <br />
          PRODUCE
          <br />
          SHARE
          <br />
          GROW
          <br />
          TOGETHER.
        </p>
        <div className="relative -mt-2 md:-mt-8">
          <BuildingMap previews={previews} photo={buildingPhoto()} />
        </div>
        <nav aria-label="Pièces de la maison" className="mt-2 border-t border-ink/10 pt-2">
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROOMS.map((r) => {
              const Icon = ROOM_ICONS[r.key];
              return (
                <li key={r.key}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="flex min-h-12 items-center gap-2.5 py-1.5 text-sm hover:underline"
                    >
                      <Icon aria-hidden="true" strokeWidth={1.6} className="size-4 shrink-0" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <b>{r.name}</b>
                        <span className="truncate text-xs text-muted-foreground">{previews[r.key]}</span>
                      </span>
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex min-h-12 items-center gap-2.5 py-1.5 text-sm text-muted-foreground"
                    >
                      <Lock aria-hidden="true" strokeWidth={1.6} className="size-4 shrink-0" />
                      <span className="flex flex-col leading-tight">
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
      </section>

      <aside className="flex flex-col gap-6 rounded-2xl bg-paper p-5">
        <section className="flex flex-col gap-2">
          <PanelTitle title="La brigade aujourd'hui" href="/bureau" />
          <BrigadeToday rows={rows} />
        </section>
        <WeekGoals goals={goals} />
        <section className="flex flex-col gap-1">
          <PanelTitle title="Dernières activités" href="/bureau" />
          <LatestActivity items={feed} now={new Date()} />
        </section>
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
