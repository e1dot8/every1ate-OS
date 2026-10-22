/**
 * Les pièces de la maison Every1.ate. Chaque pièce mène à une vraie page fonctionnelle ;
 * une pièce non livrée est affichée, étiquetée et non cliquable (AGENTS.md, règle 8).
 */
export type RoomKey = "appartement" | "bureau" | "recettes" | "cuisine" | "atelier" | "client";

export type Room = {
  key: RoomKey;
  name: string;
  /** Utilité réelle, en une phrase. */
  purpose: string;
  href: string | null;
  /** Pas encore livrée : affichée, jamais ouvrable. */
  comingSoon?: string;
  /** Position dans la vue éclatée : étage (0 rez-de-chaussée, 1 étage) et colonne. */
  floor: 0 | 1;
  column: 0 | 1 | 2;
};

export const ROOMS: Room[] = [
  {
    key: "appartement",
    name: "Mon appartement",
    purpose: "Profil, avatar, objectifs, compétences, badges et décoration.",
    href: "/appartement",
    floor: 1,
    column: 0,
  },
  {
    key: "bureau",
    name: "Le bureau commun",
    purpose: "Objectifs de la brigade, blocages, charge et réussites.",
    href: "/bureau",
    floor: 1,
    column: 1,
  },
  {
    key: "recettes",
    name: "Le carnet de recettes",
    purpose: "Méthodes, modèles et procédures réutilisables.",
    href: "/recettes",
    floor: 1,
    column: 2,
  },
  {
    key: "cuisine",
    name: "La Cuisine",
    purpose: "CRM : situations à traiter, clients, opportunités et encaissements.",
    href: "/crm/cuisine",
    floor: 0,
    column: 0,
  },
  {
    key: "atelier",
    name: "L'atelier",
    purpose: "Production : projets, tâches, livrables, planning et temps passé.",
    href: "/atelier",
    floor: 0,
    column: 1,
  },
  {
    key: "client",
    name: "L'espace client",
    purpose: "Portail sobre pour chaque client : avancement, livrables et validations.",
    href: null,
    comingSoon: "Lot à venir (portail client)",
    floor: 0,
    column: 2,
  },
];

export const roomByKey = (key: string) => ROOMS.find((r) => r.key === key) ?? null;
