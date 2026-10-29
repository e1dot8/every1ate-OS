import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Flag } from "lucide-react";
import { Panel, SpaceTitle } from "@/components/app/space-panel";
import { PageLoading } from "@/components/layout/page-header";
import { PanelTitle } from "@/features/maison/components/house-panels";
import { MAX_ACTIVE_QUESTS } from "@/features/quests/catalog";
import { QuestButton } from "@/features/quests/components/quest-button";
import { weekQuests, type WeekQuest } from "@/features/quests/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, addDays } from "@/lib/dates";
import { SPACES } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: SPACES.quetes.label };

function ActiveQuest({ q }: { q: WeekQuest }) {
  const done = !!q.completedAt;
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border p-4", done ? "bg-highlight-soft" : "bg-paper")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <b className="text-[15px] leading-tight">{q.title}</b>
          <span className="text-[13px] text-muted-foreground">{q.description}</span>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">+{q.xp} XP</span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`Progression : ${q.progress.value} sur ${q.target}`}
          aria-valuemin={0}
          aria-valuemax={q.target}
          aria-valuenow={Math.min(q.progress.value, q.target)}
        >
          <span
            className={cn("block h-full rounded-full", q.progress.reached ? "bg-highlight" : "bg-ink")}
            style={{ width: `${q.progress.percent}%` }}
          />
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {q.progress.value} / {q.target} {q.unit(q.target)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {done || q.progress.reached ? (
          <QuestButton questKey={q.key} intent="valider" label="Valider la quête" done={done} />
        ) : (
          <>
            <Link
              href={q.href}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-full border px-4 text-sm font-bold hover:bg-muted"
            >
              Y aller <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <QuestButton questKey={q.key} intent="abandonner" label="Abandonner" />
          </>
        )}
      </div>
    </li>
  );
}

async function Quests() {
  const user = await requireUser();
  const w = await weekQuests(user.id);
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <Panel className="gap-5">
        <SpaceTitle title={SPACES.quetes.label} universe={SPACES.quetes.universe} />
        <p className="text-[15px] text-ink/65">
          Jusqu&apos;à {MAX_ACTIVE_QUESTS} quêtes par semaine, mesurées sur votre vrai travail. Semaine du{" "}
          {formatDay(w.weekStart)} au {formatDay(addDays(w.weekStart, 6))}.
        </p>
        <section aria-labelledby="en-cours" className="flex flex-col gap-3">
          <h2 id="en-cours" className="text-[17px] font-bold">
            Mes quêtes ({w.active.length} / {MAX_ACTIVE_QUESTS})
          </h2>
          {w.active.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {w.active.map((q) => (
                <ActiveQuest key={q.key} q={q} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Aucune quête cette semaine. Choisissez-en une ci-dessous : elle avancera toute seule avec votre
              travail.
            </p>
          )}
        </section>
      </Panel>

      <aside className="flex flex-col gap-3">
        <Panel className="gap-3">
          <PanelTitle title="À choisir" />
          {w.slotsLeft === 0 ? (
            <p className="text-xs text-muted-foreground">
              {MAX_ACTIVE_QUESTS} quêtes acceptées : revenez la semaine prochaine, ou abandonnez-en une.
            </p>
          ) : null}
          <ul className="flex flex-col">
            {w.available.map((q) => (
              <li key={q.key} className="flex flex-col gap-2 border-b py-3 last:border-b-0">
                <div className="flex items-start gap-2.5">
                  <Flag aria-hidden="true" strokeWidth={1.6} className="mt-0.5 size-4 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[14px] leading-tight">{q.title}</b>
                    <span className="text-[12.5px] text-muted-foreground">{q.description}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold">+{q.xp} XP</span>
                </div>
                <div className="pl-6">
                  <QuestButton
                    questKey={q.key}
                    intent="accepter"
                    label={`Accepter « ${q.title} »`}
                    disabled={w.slotsLeft === 0}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="px-2 text-xs text-muted-foreground">
          Une quête ne compte que pour vous : pas de classement entre associés. Les XP ne sont inscrits
          qu&apos;une fois par quête et par semaine.
        </p>
      </aside>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Quests />
    </Suspense>
  );
}
