import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Handshake,
  Home,
  Inbox,
  MoreHorizontal,
  Sparkles,
  Timer,
  Users,
  GraduationCap,
  Building,
  DoorOpen,
  Hammer,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Lot qui livrera réellement la section. Tant qu'il est défini, l'entrée est désactivée. */
  comingInLot?: number;
};

/** Navigation principale (cahier des charges §4.1). Une entrée sans écran réel reste désactivée. */
export const primaryNav: NavItem[] = [
  { label: "Accueil", href: "/", icon: Home },
  { label: "Tâches", href: "/taches", icon: CheckSquare },
  { label: "Projets", href: "/projets", icon: FolderKanban },
  { label: "CRM", href: "/crm", icon: Handshake },
  { label: "Plus", href: "/plus", icon: MoreHorizontal },
];

/** Raccourcis du rail ordinateur (sur mobile, ils sont dans « Plus »). */
export const secondaryNav: NavItem[] = [
  { label: "La maison", href: "/maison", icon: Building },
  { label: "Le courrier", href: "/notifications", icon: Inbox },
  { label: "Temps", href: "/temps", icon: Timer },
  { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
  { label: "Mon appartement", href: "/appartement", icon: DoorOpen },
  { label: "Bureau commun", href: "/bureau", icon: Users },
  { label: "L'atelier", href: "/atelier", icon: Hammer },
  { label: "Recettes", href: "/recettes", icon: BookOpen },
  { label: "Ma progression", href: "/progression", icon: Sparkles },
  { label: "Compétences", href: "/competences", icon: GraduationCap },
];
