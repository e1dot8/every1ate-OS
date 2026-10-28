/**
 * Les espaces de la maison Every1.ate (lot G7). Chaque pièce mène à une vraie page ;
 * une pièce non livrée est affichée, étiquetée et non ouvrable (AGENTS.md, règle 8).
 *
 * Le parcours : une opportunité arrive dans la Salle, le projet est préparé et réalisé
 * dans la Cuisine, les apprentissages rejoignent le Carnet de recettes ; le Bureau commun
 * relie l'ensemble.
 */
export type RoomKey = "appartement" | "bureau" | "recettes" | "salle" | "cuisine" | "client";

/** Emplacement dans le bâtiment : étage et colonne du volume principal, ou l'annexe. */
export type Cell = { floor: 0 | 1 | 2; column: 0 | 1 } | { annex: true };

export type Room = {
  key: RoomKey;
  number: number;
  name: string;
  /** Sous-titre court de l'étiquette flottante. */
  subtitle: string;
  /** Utilité réelle, en une phrase. */
  purpose: string;
  href: string | null;
  comingSoon?: string;
  cell: Cell;
};

export const ROOMS: Room[] = [
  {
    key: "appartement",
    number: 1,
    name: "Mon profil",
    subtitle: "Mon appartement",
    purpose: "Votre espace : avatar, progression, compétences, badges et décoration.",
    href: "/appartement",
    cell: { floor: 2, column: 0 },
  },
  {
    key: "bureau",
    number: 2,
    name: "Équipe",
    subtitle: "Le bureau commun",
    purpose: "Coordination de la brigade : objectifs collectifs, blocages, réussites.",
    href: "/bureau",
    cell: { floor: 1, column: 0 },
  },
  {
    key: "recettes",
    number: 3,
    name: "Méthodes & modèles",
    subtitle: "Le carnet de recettes",
    purpose: "Bibliothèque : méthodes, modèles, procédures et enseignements des projets.",
    href: "/recettes",
    cell: { floor: 1, column: 1 },
  },
  {
    key: "salle",
    number: 4,
    name: "Clients",
    subtitle: "La Salle de restaurant",
    purpose: "Ce qui se passe dehors : CRM, prospects, clients, devis, factures et fidélisation.",
    href: "/crm/salle",
    cell: { floor: 0, column: 0 },
  },
  {
    key: "cuisine",
    number: 5,
    name: "Production",
    subtitle: "La Cuisine",
    purpose: "Ce qui se passe dedans : projets, tâches, planning, livrables et temps passé.",
    href: "/cuisine",
    cell: { floor: 0, column: 1 },
  },
  {
    key: "client",
    number: 6,
    name: "Portails clients",
    subtitle: "Les espaces clients",
    purpose: "Un portail par client : avancement, planning, livrables et validations.",
    href: null,
    comingSoon: "Lot à venir (portail client)",
    cell: { annex: true },
  },
];

export const roomByKey = (key: string) => ROOMS.find((r) => r.key === key) ?? null;
