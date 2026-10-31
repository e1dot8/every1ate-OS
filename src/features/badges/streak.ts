/**
 * Série de régularité, par semaine (pure, testée). Une semaine compte quand l'associé a au moins
 * N jours actifs (mise en place faite ou tâche terminée). Les semaines en pause (congés, maladie,
 * période creuse) ne comptent pas et ne cassent rien ; la semaine en cours ne casse jamais la série.
 * Jamais de pression quotidienne, jamais de rupture le week-end.
 */
import { addDays } from "@/lib/dates";

export type Streak = {
  /** Semaines validées d'affilée (la semaine en cours incluse si déjà validée). */
  weeks: number;
  currentDays: number;
  required: number;
  currentDone: boolean;
  currentPaused: boolean;
};

const key = (d: Date) => d.toISOString().slice(0, 10);

export function weeklyStreak(input: {
  /** Jours actifs (dates calendrier). */
  activeDays: Date[];
  pausedWeeks: Date[];
  currentWeek: Date;
  required: number;
  /** Profondeur maximale examinée. */
  maxWeeks?: number;
}): Streak {
  const perWeek = new Map<string, Set<string>>();
  for (const d of input.activeDays) {
    const day = (d.getUTCDay() + 6) % 7;
    const monday = key(addDays(d, -day));
    const set = perWeek.get(monday) ?? new Set<string>();
    set.add(key(d));
    perWeek.set(monday, set);
  }
  const paused = new Set(input.pausedWeeks.map(key));
  const count = (w: Date) => perWeek.get(key(w))?.size ?? 0;
  const currentDays = count(input.currentWeek);
  const currentDone = currentDays >= input.required;
  const currentPaused = paused.has(key(input.currentWeek));
  let weeks = currentDone && !currentPaused ? 1 : 0;
  for (let i = 1; i <= (input.maxWeeks ?? 104); i++) {
    const w = addDays(input.currentWeek, -7 * i);
    if (paused.has(key(w))) continue;
    if (count(w) >= input.required) weeks++;
    else break;
  }
  return { weeks, currentDays, required: input.required, currentDone, currentPaused };
}
