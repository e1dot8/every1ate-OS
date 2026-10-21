/**
 * Estimation et écarts (purs, testés). Une estimation est une suggestion modifiable,
 * jamais une vérité ni une sanction (ADR-0017).
 */
import type { OverrunReason, TaskCategory, TaskComplexity } from "@/generated/prisma/enums";

/** Durées rapides proposées dans le formulaire (minutes). */
export const QUICK_DURATIONS = [30, 60, 120, 240, 420] as const;

/** Plages indicatives selon la complexité, tant qu'il n'y a pas d'historique comparable. */
export const COMPLEXITY_RANGES: Record<TaskComplexity, { min: number; max: number }> = {
  SIMPLE: { min: 15, max: 60 },
  MOYENNE: { min: 120, max: 240 },
  COMPLEXE: { min: 420, max: 1260 },
};

/** Nombre minimal de tâches comparables avant de proposer une durée observée. */
export const MIN_HISTORY_SAMPLES = 3;

/** Un dépassement mérite un mini-bilan au-delà de +25 % ET d'au moins 30 minutes. */
export const OVERRUN_RATIO = 1.25;
export const OVERRUN_MIN_MINUTES = 30;

export type Variance = {
  estimated: number;
  actual: number;
  /** Réel − estimé (minutes) ; négatif = plus rapide que prévu. */
  absolute: number;
  /** Écart relatif (0,5 = +50 %), null sans estimation. */
  relative: number | null;
  overrun: boolean;
};

export function variance(estimated: number | null, actual: number): Variance | null {
  if (!estimated || estimated <= 0) return null;
  const absolute = actual - estimated;
  return {
    estimated,
    actual,
    absolute,
    relative: absolute / estimated,
    overrun: actual > estimated * OVERRUN_RATIO && absolute >= OVERRUN_MIN_MINUTES,
  };
}

/** Restant : la valeur saisie si elle existe, sinon estimation − temps suivi (jamais négatif). */
export function remaining(task: {
  remainingMinutes: number | null;
  estimatedMinutes: number | null;
  trackedMinutes: number;
}): number | null {
  if (task.remainingMinutes != null) return Math.max(0, task.remainingMinutes);
  if (task.estimatedMinutes == null) return null;
  return Math.max(0, task.estimatedMinutes - task.trackedMinutes);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export type EstimateHint =
  { kind: "history"; median: number; samples: number } | { kind: "range"; min: number; max: number };

/**
 * Suggestion d'estimation : la durée observée sur des tâches comparables (même catégorie et
 * complexité) dès qu'il y en a assez, sinon la plage indicative de la complexité.
 */
export function estimateHint(complexity: TaskComplexity, samples: number[]): EstimateHint {
  const valid = samples.filter((m) => m > 0);
  if (valid.length >= MIN_HISTORY_SAMPLES)
    return { kind: "history", median: median(valid)!, samples: valid.length };
  return { kind: "range", ...COMPLEXITY_RANGES[complexity] };
}

export const hintKey = (category: TaskCategory, complexity: TaskComplexity) => `${category}:${complexity}`;

export const overrunReasonLabels: Record<OverrunReason, string> = {
  ESTIMATION_COURTE: "Estimation trop courte",
  BRIEF_INCOMPLET: "Brief incomplet",
  RETOURS_SUPPLEMENTAIRES: "Retours supplémentaires",
  BLOCAGE_EXTERNE: "Blocage externe",
  PERIMETRE_MODIFIE: "Périmètre modifié",
  QUALITE: "Perfectionnement / qualité",
  AUTRE: "Autre",
};

export const categoryLabels: Record<TaskCategory, string> = {
  CLIENT: "Client / projet",
  AGENCE: "Développement agence",
  GESTION: "Administration / gestion",
  BRANDING: "Personal branding",
  APPRENTISSAGE: "Apprentissage",
  ENTRAIDE: "Entraide",
  RITUEL: "Rituel",
};

/** Temps « client » vs « interne » : seule la catégorie client compte comme temps client. */
export const isClientTime = (category: TaskCategory) => category === "CLIENT";
