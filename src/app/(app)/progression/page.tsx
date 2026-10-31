import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { DAILY_TASK_XP_CAP, RANKS, TASK_XP, xpForLevel } from "@/features/progression/config";
import { complexityLabels } from "@/features/projects/labels";
import { ReverseXpForm } from "@/features/progression/components/reverse-form";
import { getProgress, listXpTransactions } from "@/features/progression/service";
import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { BADGES } from "@/features/badges/catalog";
import { BadgeCollection } from "@/features/badges/components/collection";
import { listUserBadges, sharedBadgeKeys, userStreak } from "@/features/badges/service";
import { weekOf } from "@/features/briefing/service";
import { skillProfile, targetSkill } from "@/features/skills/service";
import { toggleStreakPauseAction } from "@/app/(app)/plus/preferences/actions";
import { toDateInput, todayDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ma progression" };

async function ProgressionView() {
  const user = await requireUser();
  const [progress, ledger, badges, streak, target, profile] = await Promise.all([
    getProgress(user.id),
    listXpTransactions(user.id),
    listUserBadges(user.id, user.id),
    userStreak(user.id),
    targetSkill(user.id),
    skillProfile(user.id),
  ]);
  const shared = await sharedBadgeKeys(user.id);
  const week = weekOf(todayDate());
  const advanced = profile.filter((p) => p.level >= 3).length;
  return (
    <>
      <section
        aria-labelledby="rang"
        className="flex flex-col gap-4 rounded-lg bg-ink p-6 text-paper md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-1">
          <p className="font-annotation text-sm text-highlight">niveau {progress.level}</p>
          <h2 id="rang" className="text-4xl leading-none font-bold tracking-tight md:text-5xl">
            {progress.rank.title}
          </h2>
          <p className="text-sm text-paper/75">{progress.rank.description}</p>
        </div>
        <div className="flex w-full flex-col gap-1.5 md:w-80">
          <div
            role="progressbar"
            aria-label={`Niveau ${progress.level + 1}`}
            aria-valuemin={0}
            aria-valuemax={progress.levelSpan}
            aria-valuenow={progress.intoLevel}
            className="h-2.5 overflow-hidden rounded-full bg-paper/20"
          >
            <div className="h-full bg-highlight" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-sm">
            <b>{progress.xp} XP</b> · encore {progress.toNext} XP avant le niveau {progress.level + 1}
          </p>
          {progress.nextRank ? (
            <p className="text-xs text-paper/70">
              Prochain rang : {progress.nextRank.title} au niveau {progress.nextRank.fromLevel}
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-2">
          <CardTitle>Série de régularité</CardTitle>
          {streak ? (
            <>
              <p className="text-3xl font-bold tabular-nums">
                {streak.weeks} semaine{streak.weeks > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {streak.currentPaused
                  ? "Cette semaine est en pause : elle ne compte pas et ne casse rien."
                  : streak.currentDone
                    ? "Cette semaine compte déjà. Rien à forcer."
                    : `${streak.currentDays} jour${streak.currentDays > 1 ? "s" : ""} actif${streak.currentDays > 1 ? "s" : ""} sur ${streak.required} cette semaine. Un jour actif = une mise en place ou une tâche terminée.`}
              </p>
              <form action={toggleStreakPauseAction}>
                <input type="hidden" name="weekStart" value={toDateInput(week)} />
                <button
                  type="submit"
                  className="inline-flex min-h-tap items-center rounded-full border px-3 text-sm font-bold hover:bg-muted"
                >
                  {streak.currentPaused ? "Reprendre cette semaine" : "Mettre cette semaine en pause"}
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Désactivée dans vos{" "}
              <Link href="/plus/preferences" className="font-bold underline">
                préférences
              </Link>
              .
            </p>
          )}
        </Card>
        <Card className="gap-2">
          <CardTitle>Compétences</CardTitle>
          <p className="text-3xl font-bold tabular-nums">{advanced}</p>
          <p className="text-sm text-muted-foreground">
            compétence{advanced > 1 ? "s" : ""} au niveau Autonomie ou plus
          </p>
          <p className="text-sm">
            {target ? (
              <>
                Cible : <b>{target.name}</b>
              </>
            ) : (
              "Aucune compétence cible ce mois-ci."
            )}
          </p>
          <Link href="/competences" className="text-sm font-bold text-pen-strong hover:underline">
            Mon arbre de compétences
          </Link>
        </Card>
        <Card className="gap-2">
          <CardTitle>Badges</CardTitle>
          <p className="text-3xl font-bold tabular-nums">
            {badges.length}
            <span className="text-base font-normal text-muted-foreground"> / {BADGES.length}</span>
          </p>
          <p className="text-sm text-muted-foreground">Une collection, pas une course.</p>
        </Card>
      </div>

      <Card className="gap-3">
        <CardTitle>Ma collection</CardTitle>
        {badges.length ? (
          <BadgeCollection badges={badges} editable shared={shared} />
        ) : (
          <EmptyState title="Pas encore de badge.">
            Terminez une première tâche : « La première commande » vous attend.
          </EmptyState>
        )}
        <details>
          <summary className="min-h-tap cursor-pointer py-2 text-sm font-bold">
            Tous les badges et comment les obtenir
          </summary>
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {BADGES.map((b) => (
              <li key={b.key}>
                <b>{b.name}</b> — {b.description}
                {b.earned ? "" : " (décerné par un associé)"}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_20rem]">
        <Card className="gap-2">
          <CardTitle>Journal des XP</CardTitle>
          <p className="text-sm text-muted-foreground">
            Chaque gain est une ligne. Une erreur se corrige par une ligne inverse, jamais en effaçant.
          </p>
          {ledger.length ? (
            <ul className="flex flex-col">
              {ledger.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 last:border-b-0"
                >
                  <span
                    className={cn(
                      "w-16 shrink-0 font-bold tabular-nums",
                      t.amount > 0 ? "text-success" : t.amount < 0 ? "text-danger" : "text-muted-foreground",
                      t.reversedBy && "line-through",
                    )}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount} XP
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm">{t.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                      {t.reversedBy ? " · corrigée" : ""}
                    </span>
                  </span>
                  {!t.reversedBy && !t.reversesId && t.amount !== 0 ? <ReverseXpForm id={t.id} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Pas encore d'XP.">Terminez une tâche : sa complexité fixe le gain.</EmptyState>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="gap-2">
            <CardTitle>Les rangs</CardTitle>
            <ol className="flex flex-col">
              {RANKS.map((r) => (
                <li
                  key={r.key}
                  aria-current={r.key === progress.rank.key ? "step" : undefined}
                  className={cn(
                    "flex items-baseline justify-between gap-2 border-b py-2 text-sm last:border-b-0",
                    r.key === progress.rank.key ? "font-bold" : "text-muted-foreground",
                  )}
                >
                  <span className={r.key === progress.rank.key ? "highlight" : undefined}>{r.title}</span>
                  <span className="text-xs">
                    niv. {r.fromLevel} · {xpForLevel(r.fromLevel)} XP
                  </span>
                </li>
              ))}
            </ol>
            <p className="font-annotation text-xs text-pen-strong">
              un rang est un titre de parcours : aucun droit, aucune hiérarchie, aucun lien avec la
              rémunération.
            </p>
          </Card>
          <Card className="gap-2">
            <CardTitle>Les règles du jeu</CardTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {(["SIMPLE", "MOYENNE", "COMPLEXE"] as const).map((c) => (
                <li key={c} className="flex justify-between">
                  <span>Tâche {complexityLabels[c].toLowerCase()} terminée</span>
                  <b>{TASK_XP[c]} XP</b>
                </li>
              ))}
            </ul>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>La complexité se choisit à la création de la tâche, jamais d&apos;après le temps passé.</li>
              <li>Une tâche ne rapporte qu&apos;une fois, même rouverte puis refermée.</li>
              <li>
                Au-delà de {DAILY_TASK_XP_CAP} XP de tâches par jour, découper davantage ne rapporte plus.
              </li>
              <li>Rien pour les clics, la présence connectée ou la vitesse.</li>
              <li>Pas de classement entre associés.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function ProgressionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="la brigade avance" title="Ma progression" />
      <Suspense fallback={<PageLoading />}>
        <ProgressionView />
      </Suspense>
    </div>
  );
}
