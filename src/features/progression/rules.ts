/** Règles pures de progression (testées) : niveaux, rangs, XP d'une tâche terminée. */
import type { TaskComplexity } from "@/generated/prisma/enums";
import { DAILY_TASK_XP_CAP, RANKS, TASK_XP, TASK_XP_UNRATED, xpForLevel, type Rank } from "./config";

export type LevelInfo = {
  xp: number;
  level: number;
  rank: Rank;
  /** XP acquis depuis le début du niveau courant. */
  intoLevel: number;
  /** XP nécessaires pour passer du niveau courant au suivant. */
  levelSpan: number;
  toNext: number;
  percent: number;
  nextRank: Rank | null;
};

export function levelFor(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function rankFor(level: number): Rank {
  return [...RANKS].reverse().find((r) => level >= r.fromLevel) ?? RANKS[0];
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, totalXp);
  const level = levelFor(xp);
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const intoLevel = xp - start;
  const rank = rankFor(level);
  return {
    xp,
    level,
    rank,
    intoLevel,
    levelSpan: span,
    toNext: span - intoLevel,
    percent: Math.round((intoLevel / span) * 100),
    nextRank: RANKS.find((r) => r.fromLevel > level) ?? null,
  };
}

export type TaskXp = { amount: number; base: number; capped: boolean; label: string };

const complexityWord: Record<TaskComplexity, string> = {
  SIMPLE: "simple",
  MOYENNE: "intermédiaire",
  COMPLEXE: "complexe",
};

/**
 * XP d'une tâche terminée. `earnedToday` = XP de tâches déjà gagnés ce jour-là :
 * au-delà du plafond, la clôture rapporte 0 (ou le reste disponible).
 */
export function taskCompletionXp(complexity: TaskComplexity | null, earnedToday: number): TaskXp {
  const base = complexity ? TASK_XP[complexity] : TASK_XP_UNRATED;
  const room = Math.max(0, DAILY_TASK_XP_CAP - Math.max(0, earnedToday));
  const amount = Math.min(base, room);
  const what = complexity
    ? `Tâche ${complexityWord[complexity]} terminée`
    : "Tâche terminée (complexité non précisée)";
  return {
    amount,
    base,
    capped: amount < base,
    label: amount < base ? `${what} — plafond du jour atteint` : what,
  };
}

/** Passage de niveau entre deux totaux (célébration ponctuelle). */
export function levelUp(before: number, after: number): { level: number; newRank: Rank | null } | null {
  const a = levelFor(before);
  const b = levelFor(after);
  if (b <= a) return null;
  const rankBefore = rankFor(a);
  const rankAfter = rankFor(b);
  return { level: b, newRank: rankAfter.key !== rankBefore.key ? rankAfter : null };
}
