/**
 * Charge à venir (pure) : le temps restant de chaque tâche (estimation − temps passé) est
 * réparti sur les jours ouvrés entre aujourd'hui (ou son début) et son échéance.
 * Une tâche en retard pèse entièrement sur la semaine en cours.
 */
import { addDays, isWorkingDay, startOfWeek } from "@/lib/dates";

export type LoadTask = {
  ownerId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  loggedMinutes: number;
};

export function weeklyLoad(tasks: LoadTask[], today: Date, weeks = 6) {
  const first = startOfWeek(today);
  const perOwner = new Map<string, number[]>();
  let unplanned = 0;
  const bucketOf = (d: Date) => Math.floor((d.getTime() - first.getTime()) / (7 * 86_400_000));
  for (const t of tasks) {
    if (!t.ownerId) continue;
    const remaining = Math.max(0, (t.estimatedMinutes ?? 0) - t.loggedMinutes);
    if (!remaining) continue;
    if (!t.dueDate) {
      unplanned += remaining;
      continue;
    }
    const row = perOwner.get(t.ownerId) ?? Array(weeks).fill(0);
    perOwner.set(t.ownerId, row);
    if (t.dueDate < today) {
      row[0] += remaining;
      continue;
    }
    const from = t.startDate && t.startDate > today ? t.startDate : today;
    const days: Date[] = [];
    for (let d = from; d <= t.dueDate; d = addDays(d, 1)) if (isWorkingDay(d)) days.push(d);
    if (!days.length) days.push(t.dueDate);
    const share = remaining / days.length;
    for (const d of days) {
      const i = bucketOf(d);
      if (i >= 0 && i < weeks) row[i] += share;
    }
  }
  return {
    weekStarts: Array.from({ length: weeks }, (_, i) => addDays(first, i * 7)),
    perOwner: new Map([...perOwner].map(([k, v]) => [k, v.map(Math.round)])),
    unplannedMinutes: unplanned,
  };
}

/** Taux de charge en % d'une capacité hebdomadaire en heures. */
export const loadPercent = (minutes: number, weeklyHours: number) =>
  weeklyHours > 0 ? Math.round((minutes / (weeklyHours * 60)) * 100) : 0;
