/** Tâches récurrentes (pure) : dates de l'occurrence suivante. */
import { addDays, addMonths } from "@/lib/dates";

export type RecurrenceKind = "AUCUNE" | "HEBDOMADAIRE" | "MENSUELLE";

export const recurrenceLabels: Record<RecurrenceKind, string> = {
  AUCUNE: "Aucune",
  HEBDOMADAIRE: "Chaque semaine",
  MENSUELLE: "Chaque mois",
};

const shift = (d: Date, kind: RecurrenceKind) => (kind === "HEBDOMADAIRE" ? addDays(d, 7) : addMonths(d, 1));

/** null si pas de récurrence, pas d'échéance, ou si la suivante dépasse la date de fin. */
export function nextOccurrence(t: {
  recurrence: RecurrenceKind;
  startDate: Date | null;
  dueDate: Date | null;
  recurrenceUntil: Date | null;
}) {
  if (t.recurrence === "AUCUNE" || !t.dueDate) return null;
  const due = shift(t.dueDate, t.recurrence);
  if (t.recurrenceUntil && due > t.recurrenceUntil) return null;
  return { startDate: t.startDate ? shift(t.startDate, t.recurrence) : null, dueDate: due };
}
