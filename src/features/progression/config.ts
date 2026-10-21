/**
 * Barème de progression — SEUL endroit où vivent les valeurs d'XP, de niveaux et de rangs.
 * Ce sont des hypothèses de départ à calibrer après usage (ADR-0017), pas des règles
 * professionnelles. Un rang est un titre ludique : il ne donne aucun droit dans l'application.
 */
import type { TaskComplexity } from "@/generated/prisma/enums";

/** XP gagnés à la clôture d'une tâche, selon la complexité choisie à sa création. */
export const TASK_XP: Record<TaskComplexity, number> = {
  SIMPLE: 10,
  MOYENNE: 25,
  COMPLEXE: 50,
};

/** Tâche sans complexité renseignée (tâches antérieures au barème) : comptée comme simple. */
export const TASK_XP_UNRATED = TASK_XP.SIMPLE;

/**
 * Plafond quotidien des XP de tâches : découper une tâche en dix ne rapporte pas plus.
 * Au-delà, la clôture est quand même inscrite au registre, à 0 XP, avec la raison.
 */
export const DAILY_TASK_XP_CAP = 150;

/** Bonus indicatifs (lots suivants : recettes, entraide). */
export const BONUS_XP = {
  recipe: 10,
  help: 10,
} as const;

/**
 * Seuil cumulé pour atteindre le niveau n (n ≥ 1) :
 * 100 XP pour le niveau 2, puis chaque palier coûte 50 XP de plus que le précédent.
 * Niveau 2 = 100, 3 = 250, 4 = 450, 5 = 700, 10 = 2 700, 15 = 5 950, 20 = 10 450.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 100 * n + 25 * n * (n - 1);
}

export type Rank = { key: string; title: string; fromLevel: number; description: string };

/** Rangs culinaires : des titres de parcours, sans autorité ni lien avec la rémunération. */
export const RANKS: Rank[] = [
  { key: "apprenti", title: "Apprenti", fromLevel: 1, description: "On découvre la cuisine et ses gestes." },
  { key: "commis", title: "Commis", fromLevel: 5, description: "Les gestes de base deviennent sûrs." },
  {
    key: "chef-de-partie",
    title: "Chef de partie",
    fromLevel: 10,
    description: "On tient un poste entier, du début à la fin.",
  },
  {
    key: "sous-chef",
    title: "Sous-chef",
    fromLevel: 15,
    description: "On fait tourner le service et on aide les autres postes.",
  },
  {
    key: "chef-executif",
    title: "Chef exécutif",
    fromLevel: 20,
    description: "On transmet sa cuisine et on améliore la maison.",
  },
];
