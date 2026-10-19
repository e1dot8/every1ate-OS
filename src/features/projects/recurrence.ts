/**
 * Tâches récurrentes (pur) : validation de la saisie, libellés et données de l'occurrence suivante.
 * Les dates sont calculées par `nextOccurrence` (src/features/planning/recurrence.ts).
 */
import type { Impact, Priority, Recurrence, TaskStatus } from "@/generated/prisma/enums";
import { formatDay } from "@/lib/dates";
import { suggestPriority } from "@/features/planning/rules";
import { nextOccurrence, recurrenceLabels } from "@/features/planning/recurrence";

export const RECURRENCES = ["AUCUNE", "HEBDOMADAIRE", "MENSUELLE"] as const satisfies readonly Recurrence[];

export const recurrenceOptions = RECURRENCES.map((value) => ({ value, label: recurrenceLabels[value] }));

type RecurrenceInput = { recurrence: Recurrence; dueDate: Date | null; recurrenceUntil: Date | null };

/** Erreur de saisie rattachée au champ à corriger, ou null. */
export function recurrenceIssue(
  t: RecurrenceInput,
): { field: "dueDate" | "recurrenceUntil"; message: string } | null {
  if (t.recurrence === "AUCUNE") return null;
  if (!t.dueDate) return { field: "dueDate", message: "Une tâche répétée a besoin d'une échéance." };
  if (t.recurrenceUntil && t.recurrenceUntil < t.dueDate)
    return { field: "recurrenceUntil", message: "« Jusqu'au » ne peut pas précéder l'échéance." };
  return null;
}

/** Sans répétition, une date de fin n'a pas de sens : elle est effacée. */
export function normalizeRecurrence<T extends { recurrence: Recurrence; recurrenceUntil: Date | null }>(
  t: T,
): T {
  return t.recurrence === "AUCUNE" ? { ...t, recurrenceUntil: null } : t;
}

const RHYTHM: Record<Exclude<Recurrence, "AUCUNE">, string> = {
  HEBDOMADAIRE: "chaque semaine",
  MENSUELLE: "chaque mois",
};

/** « Répète chaque semaine jusqu'au 3 déc. », ou null sans répétition. */
export function recurrenceSummary(recurrence: Recurrence, until: Date | null, now = new Date()) {
  if (recurrence === "AUCUNE") return null;
  return `Répète ${RHYTHM[recurrence]}${until ? ` jusqu'au ${formatDay(until, now)}` : ""}`;
}

/** « … pour le 23 oct. » : pas de second point quand le mois abrégé en porte déjà un. */
export function occurrenceCreatedMessage(dueDate: Date, now = new Date()) {
  const day = formatDay(dueDate, now);
  return `Prochaine occurrence créée pour le ${day}${day.endsWith(".") ? "" : "."}`;
}

export type CompletedTask = {
  projectId: string;
  workPackageId: string | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  contributorIds: string[];
  priority: Priority;
  priorityLocked: boolean;
  impact: Impact;
  recurrence: Recurrence;
  recurrenceUntil: Date | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  nextOccurrenceId: string | null;
};

export type NextOccurrenceData = Omit<CompletedTask, "nextOccurrenceId" | "dueDate"> & {
  status: TaskStatus;
  dueDate: Date;
};

/**
 * Données de la tâche suivante d'une tâche répétée qui vient d'être terminée, ou null :
 * pas de répétition, occurrence déjà créée (réouverture puis nouvelle clôture), fin de
 * répétition dépassée ou projet fermé. Seuls les champs saisis sont recopiés : ni dépendances,
 * ni commentaires, ni temps passé. Une priorité automatique est recalculée pour la nouvelle échéance.
 */
export function buildNextOccurrence(
  task: CompletedTask,
  context: { today: Date; projectOpen: boolean },
): NextOccurrenceData | null {
  if (task.nextOccurrenceId || !context.projectOpen) return null;
  const dates = nextOccurrence(task);
  if (!dates) return null;
  return {
    projectId: task.projectId,
    workPackageId: task.workPackageId,
    title: task.title,
    description: task.description,
    ownerId: task.ownerId,
    impact: task.impact,
    priorityLocked: task.priorityLocked,
    recurrence: task.recurrence,
    recurrenceUntil: task.recurrenceUntil,
    estimatedMinutes: task.estimatedMinutes,
    status: "A_FAIRE",
    startDate: dates.startDate,
    dueDate: dates.dueDate,
    contributorIds: [...new Set(task.contributorIds)].filter((id) => id !== task.ownerId),
    priority: task.priorityLocked
      ? task.priority
      : suggestPriority({
          impact: task.impact,
          dueDate: dates.dueDate,
          today: context.today,
          blockingCount: 0,
          done: false,
        }).priority,
  };
}
