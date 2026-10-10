import type { Priority, ProjectPhase, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import type { StatusTone } from "@/components/ui/status-badge";

export const PHASES: { value: ProjectPhase; label: string }[] = [
  { value: "RECETTE", label: "La recette" },
  { value: "PREPARATION", label: "La préparation" },
  { value: "CUISSON", label: "La cuisson" },
  { value: "DRESSAGE", label: "Le dressage" },
  { value: "SERVICE", label: "Le service" },
];
export const phaseLabel = (phase: ProjectPhase) => PHASES.find((p) => p.value === phase)!.label;

export const projectStatusLabels: Record<ProjectStatus, string> = {
  A_PREPARER: "À préparer",
  ACTIF: "Actif",
  EN_ATTENTE: "En attente",
  BLOQUE: "Bloqué",
  TERMINE: "Terminé",
  ARCHIVE: "Archivé",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  EN_REVUE: "En revue",
  TERMINE: "Terminé",
  EN_ATTENTE: "En attente",
  BLOQUE: "Bloqué",
  ANNULE: "Annulé",
};

export const priorityLabels: Record<Priority, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

export type BadgeTone = StatusTone | "neutral";

export const projectStatusTone: Record<ProjectStatus, BadgeTone> = {
  A_PREPARER: "neutral",
  ACTIF: "info",
  EN_ATTENTE: "warning",
  BLOQUE: "danger",
  TERMINE: "success",
  ARCHIVE: "neutral",
};

export const taskStatusTone: Record<TaskStatus, BadgeTone> = {
  A_FAIRE: "neutral",
  EN_COURS: "info",
  EN_REVUE: "info",
  TERMINE: "success",
  EN_ATTENTE: "warning",
  BLOQUE: "danger",
  ANNULE: "neutral",
};

export const impactLabels: Record<"FAIBLE" | "MOYEN" | "FORT", string> = {
  FAIBLE: "Faible",
  MOYEN: "Moyen",
  FORT: "Fort",
};
