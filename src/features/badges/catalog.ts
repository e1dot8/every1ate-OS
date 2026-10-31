/**
 * Catalogue des badges (pur, testé). Automatiques : calculés depuis le travail réel, jamais depuis
 * les clics, la présence ou la vitesse. « Reconnaissance » : décernés par un associé.
 */
import { BONUS_XP } from "@/features/progression/config";

export type BadgeFamily = "premieres-fois" | "progression" | "moments" | "brigade" | "maison" | "visibilite";

export type BadgeStats = {
  tasksDone: number;
  categoriesDone: number;
  agencyTasksDone: number;
  brandingTasksDone: number;
  projectsDelivered: number;
  fiveStarProjects: number;
  rescuedTasks: number;
  /** Tâches estimées terminées d'affilée (les plus récentes) à ±15 % de l'estimation. */
  accurateStreak: number;
  briefings: number;
  /** Recettes de l'associé réutilisées par d'autres associés. */
  recipesReused: number;
};

export type Badge = {
  key: string;
  name: string;
  family: BadgeFamily;
  description: string;
  /** XP versés à l'obtention (bonus indicatif du barème). */
  xp: number;
  /** Badge automatique : condition sur les statistiques. Absent : décerné par un associé. */
  earned?: (s: BadgeStats) => boolean;
  /** Raison affichée à l'obtention automatique. */
  because?: string;
};

export const BADGES: Badge[] = [
  {
    key: "premiere-commande",
    name: "La première commande",
    family: "premieres-fois",
    description: "Première tâche terminée dans l'OS.",
    xp: 0,
    earned: (s) => s.tasksDone >= 1,
    because: "Première tâche terminée.",
  },
  {
    key: "premier-service",
    name: "Premier service",
    family: "premieres-fois",
    description: "Premier projet livré en tant que responsable.",
    xp: 0,
    earned: (s) => s.projectsDelivered >= 1,
    because: "Premier projet livré.",
  },
  {
    key: "oeil-du-chef",
    name: "L'œil du chef",
    family: "progression",
    description: "Cinq tâches estimées d'affilée terminées à ±15 % de l'estimation.",
    xp: 0,
    earned: (s) => s.accurateStreak >= 5,
    because: "Cinq estimations justes d'affilée.",
  },
  {
    key: "couteau-suisse",
    name: "Couteau suisse",
    family: "progression",
    description: "Des tâches terminées dans au moins quatre types d'activité.",
    xp: 0,
    earned: (s) => s.categoriesDone >= 4,
    because: "Contributions dans quatre types d'activité.",
  },
  {
    key: "bonne-mise-en-place",
    name: "Bonne mise en place",
    family: "progression",
    description: "Dix mises en place faites (pas forcément d'affilée).",
    xp: 0,
    earned: (s) => s.briefings >= 10,
    because: "Dix mises en place.",
  },
  {
    key: "sauvetage-en-cuisine",
    name: "Sauvetage en cuisine",
    family: "moments",
    description: "Une tâche bloquée menée jusqu'au bout.",
    xp: 0,
    earned: (s) => s.rescuedTasks >= 1,
    because: "Une tâche bloquée débloquée et terminée.",
  },
  {
    key: "envoi-impeccable",
    name: "Envoi impeccable",
    family: "moments",
    description: "Un projet livré avec une satisfaction client de 5/5.",
    xp: 0,
    earned: (s) => s.fiveStarProjects >= 1,
    because: "Projet livré, client ravi (5/5).",
  },
  {
    key: "service-complet",
    name: "Service complet",
    family: "maison",
    description: "Trois projets pilotés de bout en bout.",
    xp: 0,
    earned: (s) => s.projectsDelivered >= 3,
    because: "Trois projets livrés en tant que responsable.",
  },
  {
    key: "batisseur",
    name: "Bâtisseur de la maison",
    family: "maison",
    description: "Cinq tâches de développement de l'agence terminées.",
    xp: 0,
    earned: (s) => s.agencyTasksDone >= 5,
    because: "Cinq tâches pour développer la maison.",
  },
  {
    key: "pignon-sur-rue",
    name: "Pignon sur rue",
    family: "visibilite",
    description: "Cinq tâches de personal branding terminées.",
    xp: 0,
    earned: (s) => s.brandingTasksDone >= 5,
    because: "Cinq actions de visibilité.",
  },
  {
    key: "main-tendue",
    name: "Main tendue",
    family: "brigade",
    description: "Une aide apportée, reconnue par un associé.",
    xp: BONUS_XP.help,
  },
  {
    key: "transmission-du-savoir",
    name: "Transmission du savoir",
    family: "brigade",
    description: "Une recette du carnet réutilisée par un autre associé.",
    xp: BONUS_XP.recipe,
    earned: (s) => s.recipesReused >= 1,
    because: "Une de vos recettes a été réutilisée par la brigade.",
  },
  {
    key: "sens-du-dressage",
    name: "Sens du dressage",
    family: "moments",
    description: "Une attention particulière à la finition, remarquée par un associé.",
    xp: 0,
  },
  {
    key: "idee-determinante",
    name: "Idée déterminante",
    family: "moments",
    description: "Une idée qui a fait gagner ou réussir un projet.",
    xp: 0,
  },
];

export const badgeByKey = (key: string) => BADGES.find((b) => b.key === key) ?? null;
export const PEER_BADGES = BADGES.filter((b) => !b.earned);

export const familyLabels: Record<BadgeFamily, string> = {
  "premieres-fois": "Premières fois",
  progression: "Progression",
  moments: "Moments marquants",
  brigade: "Esprit de brigade",
  maison: "Développement de la maison",
  visibilite: "Personal branding",
};

/** Badges automatiques mérités par ces statistiques et pas encore obtenus. */
export function newlyEarned(stats: BadgeStats, owned: Set<string>): Badge[] {
  return BADGES.filter((b) => b.earned && !owned.has(b.key) && b.earned(stats));
}

/** Estimation juste : réel à ±15 % de l'estimé. */
export const accurate = (estimated: number, actual: number) =>
  estimated > 0 && Math.abs(actual - estimated) <= estimated * 0.15;

/** Longueur de la série d'estimations justes, en partant de la plus récente. */
export function accurateStreak(results: { estimated: number; actual: number }[]): number {
  let n = 0;
  for (const r of results) {
    if (!accurate(r.estimated, r.actual)) break;
    n++;
  }
  return n;
}
