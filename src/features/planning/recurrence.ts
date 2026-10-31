/** Tâches récurrentes (pure) : dates de l'occurrence suivante. */
import { addDays, addMonths } from "@/lib/dates";

export type RecurrenceKind = "AUCUNE" | "HEBDOMADAIRE" | "MENSUELLE";

export const recurrenceLabels: Record<RecurrenceKind, string> = {
  AUCUNE: "Aucune",
  HEBDOMADAIRE: "Chaque semaine",
  MENSUELLE: "Chaque mois",
};

const shift = (d: Date, kind: RecurrenceKind, n = 1) =>
  kind === "HEBDOMADAIRE" ? addDays(d, 7 * n) : addMonths(d, n);

/**
 * null si pas de récurrence, pas d'échéance, ou si la suivante dépasse la date de fin.
 * Avec `today` : une tâche terminée en retard saute les périodes manquées, pour que la suivante
 * ne naisse pas déjà en retard (les périodes se comptent depuis l'échéance, sans dérive).
 */
export function nextOccurrence(t: {
  recurrence: RecurrenceKind;
  startDate: Date | null;
  dueDate: Date | null;
  recurrenceUntil: Date | null;
  today?: Date;
}) {
  if (t.recurrence === "AUCUNE" || !t.dueDate) return null;
  let n = 1;
  while (t.today && n < 1000 && shift(t.dueDate, t.recurrence, n) < t.today) n++;
  const due = shift(t.dueDate, t.recurrence, n);
  if (t.recurrenceUntil && due > t.recurrenceUntil) return null;
  return { startDate: t.startDate ? shift(t.startDate, t.recurrence, n) : null, dueDate: due };
}
