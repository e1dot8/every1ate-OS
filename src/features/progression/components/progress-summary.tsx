import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LevelInfo } from "@/features/progression/rules";

/** Progression en une ligne : rang, niveau, XP vers le niveau suivant. Rien de plus sur le cockpit. */
export function ProgressSummary({
  progress,
  streakWeeks = null,
}: {
  progress: LevelInfo & { last: { amount: number; label: string } | null };
  /** Série de régularité (null si désactivée). */
  streakWeeks?: number | null;
}) {
  return (
    <Link
      href="/progression"
      className="group flex flex-col gap-3 rounded-xl border bg-card p-5 hover:border-ink"
      aria-label={`Ma progression : ${progress.rank.title}, niveau ${progress.level}, ${progress.xp} XP`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-annotation text-xs text-pen-strong">ma progression</span>
          <span className="text-lg leading-tight font-bold">{progress.rank.title}</span>
          <span className="text-sm text-muted-foreground">
            Niveau {progress.level} · {progress.xp} XP
          </span>
          {streakWeeks ? (
            <span className="text-xs font-bold">
              Série : {streakWeeks} semaine{streakWeeks > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <ChevronRight aria-hidden="true" className="mt-1 size-4 text-muted-foreground group-hover:text-ink" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full bg-highlight shadow-[inset_0_0_0_1px_var(--ink)]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {progress.toNext} XP avant le niveau {progress.level + 1}
        </span>
      </div>
      {progress.last ? (
        <p className="truncate text-xs">
          <b className={progress.last.amount > 0 ? "text-success" : "text-muted-foreground"}>
            {progress.last.amount > 0 ? "+" : ""}
            {progress.last.amount} XP
          </b>{" "}
          <span className="text-muted-foreground">{progress.last.label}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Terminez une tâche pour gagner vos premiers XP.</p>
      )}
    </Link>
  );
}
