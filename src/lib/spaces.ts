/**
 * Nomenclature (lot G8) : chaque espace porte d'abord un nom fonctionnel, compris sans
 * explication, puis son nom d'univers, affiché en second (sous-titre, fil d'Ariane).
 * Une seule source pour le menu, les titres de page et la maison.
 */
export type SpaceKey =
  "profil" | "equipe" | "clients" | "production" | "methodes" | "hebdo" | "briefing" | "notifications";

export const SPACES: Record<SpaceKey, { label: string; universe: string; href: string }> = {
  profil: { label: "Mon profil", universe: "Mon appartement", href: "/appartement" },
  equipe: { label: "Équipe", universe: "Le bureau commun", href: "/bureau" },
  clients: { label: "Clients", universe: "La Salle", href: "/crm/salle" },
  production: { label: "Production", universe: "La Cuisine", href: "/cuisine" },
  methodes: { label: "Méthodes & modèles", universe: "Le carnet de recettes", href: "/recettes" },
  hebdo: { label: "Point hebdo", universe: "Le service de la semaine", href: "/service" },
  briefing: { label: "Briefing du jour", universe: "La mise en place", href: "/mise-en-place" },
  notifications: { label: "Notifications", universe: "Le courrier", href: "/notifications" },
};
