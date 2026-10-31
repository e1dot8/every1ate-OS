/**
 * Catalogue des quêtes hebdomadaires (lot G9). Comme le barème d'XP, c'est le seul endroit
 * où vivent les objectifs et les récompenses : des hypothèses de départ, à calibrer à l'usage.
 * Chaque quête mesure une donnée réelle de la semaine ; rien ne se coche à la main.
 */
export type QuestMetric =
  | "tasksDone"
  | "clientNotes"
  | "recipesWritten"
  | "briefingDays"
  | "minutesTracked"
  | "helpGiven"
  | "cheersGiven";

export type Quest = {
  key: string;
  /** Nom explicite, compris sans explication. */
  title: string;
  /** Ce qu'il faut faire, en une phrase. */
  description: string;
  metric: QuestMetric;
  target: number;
  /** Unité affichée avec la progression (« 3 / 5 tâches »). */
  unit: (n: number) => string;
  xp: number;
  /** Où agir pour faire avancer la quête. */
  href: string;
};

const plural = (one: string, many: string) => (n: number) => (n > 1 ? many : one);

export const QUESTS: Quest[] = [
  {
    key: "cinq-taches",
    title: "Terminer 5 tâches",
    description: "Cinq tâches menées jusqu'au bout cette semaine, quelle que soit leur taille.",
    metric: "tasksDone",
    target: 5,
    unit: plural("tâche", "tâches"),
    xp: 40,
    href: "/taches",
  },
  {
    key: "trois-echanges",
    title: "Noter 3 échanges clients",
    description: "Un appel, un rendez-vous ou un message consigné sur une opportunité.",
    metric: "clientNotes",
    target: 3,
    unit: plural("échange", "échanges"),
    xp: 40,
    href: "/crm",
  },
  {
    key: "une-methode",
    title: "Écrire une méthode",
    description: "Partager une façon de faire qui a marché, pour que l'équipe la réutilise.",
    metric: "recipesWritten",
    target: 1,
    unit: plural("méthode", "méthodes"),
    xp: 30,
    href: "/recettes/nouvelle",
  },
  {
    key: "quatre-briefings",
    title: "Faire le briefing 4 jours",
    description: "Lancer la journée avec le briefing du jour, quatre jours dans la semaine.",
    metric: "briefingDays",
    target: 4,
    unit: plural("jour", "jours"),
    xp: 30,
    href: "/mise-en-place",
  },
  {
    key: "dix-heures",
    title: "Suivre 10 h de temps",
    description: "Dix heures de travail suivies au chronomètre ou saisies, sur vos tâches.",
    metric: "minutesTracked",
    target: 600,
    unit: () => "min",
    xp: 30,
    href: "/temps",
  },
  {
    key: "un-coup-de-main",
    title: "Régler un coup de main",
    description: "Prendre en charge la demande d'aide d'un associé et la régler.",
    metric: "helpGiven",
    target: 1,
    unit: plural("demande", "demandes"),
    xp: 40,
    href: "/bureau",
  },
  {
    key: "deux-felicitations",
    title: "Féliciter 2 réussites",
    description: "Saluer deux réussites de l'équipe dans le fil.",
    metric: "cheersGiven",
    target: 2,
    unit: plural("réussite", "réussites"),
    xp: 20,
    href: "/bureau",
  },
];

/** Quêtes acceptées en même temps, par associé et par semaine. */
export const MAX_ACTIVE_QUESTS = 3;

export const questByKey = (key: string) => QUESTS.find((q) => q.key === key) ?? null;
