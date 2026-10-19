/** Règles pures des comptes rendus (sans accès base, utilisables côté client et en test). */
import type { ProjectStatus } from "@/generated/prisma/enums";
import type { FormState } from "@/lib/forms";

/** Statuts de projet qui ne reçoivent plus de nouvelles tâches. */
export const CLOSED_PROJECT_STATUSES: ProjectStatus[] = ["TERMINE", "ARCHIVE"];

/** Seuls les projets en cours (ni archivés, ni terminés) reçoivent des tâches issues d'un compte rendu. */
export function canReceiveTasks(project: { status: ProjectStatus; archivedAt: Date | null }): boolean {
  return !project.archivedAt && !CLOSED_PROJECT_STATUSES.includes(project.status);
}

/** « 1 tâche créée », « 3 tâches créées », « Aucune tâche créée ». */
export function tasksCreatedLabel(n: number): string {
  if (n <= 0) return "Aucune tâche créée";
  return n === 1 ? "1 tâche créée" : `${n} tâches créées`;
}

/** « 1 action à traiter », « 2 actions à traiter ». */
export function pendingActionsLabel(n: number): string {
  return n === 1 ? "1 action à traiter" : `${n} actions à traiter`;
}

/** Résultat du formulaire « Actions détectées » : message + liens vers les tâches créées. */
export type ActionsFormState = FormState & { created?: { id: string; title: string }[] };
