import {
  BookOpen,
  Building,
  CalendarDays,
  CheckSquare,
  ChefHat,
  ConciergeBell,
  DoorOpen,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Timer,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Préfixes d'URL qui rendent l'entrée active (par défaut : href). */
  match?: string[];
  /** Lot qui livrera réellement la section. Tant qu'il est défini, l'entrée est désactivée. */
  comingInLot?: number;
};

/**
 * Barre basse (mobile) : le travail d'abord, la maison à un tap (lot G7).
 * Le reste est dans « Plus ».
 */
export const primaryNav: NavItem[] = [
  { label: "Cockpit", href: "/", icon: LayoutDashboard },
  { label: "Tâches", href: "/taches", icon: CheckSquare },
  { label: "Projets", href: "/projets", icon: FolderKanban },
  { label: "La maison", href: "/maison", icon: Building },
  { label: "Plus", href: "/plus", icon: MoreHorizontal },
];

/**
 * Rail (ordinateur) en trois niveaux : 1. le cockpit et le travail du jour ; 2. la maison et
 * ses espaces ; 3. les outils spécialisés. Chaque espace reste atteignable sans la carte.
 */
export const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Mon travail",
    items: [
      { label: "Cockpit", href: "/", icon: LayoutDashboard },
      { label: "Mes tâches", href: "/taches", icon: CheckSquare },
      { label: "Projets", href: "/projets", icon: FolderKanban },
      { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
      { label: "Temps", href: "/temps", icon: Timer },
    ],
  },
  {
    title: "Espaces",
    items: [
      { label: "La maison", href: "/maison", icon: Building },
      { label: "Mon profil", href: "/appartement", icon: DoorOpen },
      { label: "Équipe", href: "/bureau", icon: Users },
      { label: "Clients", href: "/crm/salle", icon: ConciergeBell, match: ["/crm"] },
      { label: "Production", href: "/cuisine", icon: ChefHat },
      { label: "Méthodes & modèles", href: "/recettes", icon: BookOpen },
    ],
  },
  {
    title: "Outils",
    items: [
      { label: "Point hebdo", href: "/service", icon: UtensilsCrossed },
      { label: "Compétences", href: "/competences", icon: GraduationCap },
      { label: "Finance", href: "/finance", icon: Wallet },
    ],
  },
];

/**
 * Pied du rail (ordinateur) : les réglages. Notifications et recherche sont dans la barre du
 * haut, une seule fois par écran (lot G8).
 */
export const utilityNav: NavItem[] = [{ label: "Plus et réglages", href: "/plus", icon: Settings }];
