import {
  CheckSquare,
  Clapperboard,
  FolderKanban,
  Handshake,
  Home,
  MessagesSquare,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Lot qui livrera réellement la section. Tant qu'il est défini, l'entrée est désactivée. */
  comingInLot?: number;
  /** false : absente de la barre basse mobile (accessible ailleurs, ex. barre du haut). */
  mobile?: boolean;
};

/**
 * Navigation principale (cahier des charges §4.1, V1.2 : Livrables et Discussions).
 * Une entrée sans écran réel reste désactivée. Sur mobile, Discussions est dans la barre du haut.
 */
export const primaryNav: NavItem[] = [
  { label: "Accueil", href: "/", icon: Home },
  { label: "Tâches", href: "/taches", icon: CheckSquare },
  { label: "Livrables", href: "/livrables", icon: Clapperboard },
  { label: "Projets", href: "/projets", icon: FolderKanban },
  { label: "CRM", href: "/crm", icon: Handshake },
  { label: "Discussions", href: "/discussions", icon: MessagesSquare, mobile: false },
  { label: "Plus", href: "/plus", icon: MoreHorizontal },
];
