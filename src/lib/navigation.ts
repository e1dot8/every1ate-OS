import { CheckSquare, FolderKanban, Handshake, Home, MoreHorizontal, type LucideIcon } from "lucide-react";

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
  { label: "CRM", href: "/crm", icon: Handshake, comingInLot: 4 },
  { label: "Plus", href: "/plus", icon: MoreHorizontal },
];
