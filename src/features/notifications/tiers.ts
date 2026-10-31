/**
 * Le courrier en trois niveaux (pur, testé). Seuls « Prioritaire » et « À suivre » comptent dans
 * le compteur : une information (badge, félicitations) ne réclame jamais d'action.
 */
export type Tier = "PRIORITAIRE" | "A_SUIVRE" | "INFO";

const TIER_OF: Record<string, Tier> = {
  assignation: "PRIORITAIRE",
  mention: "PRIORITAIRE",
  blocage: "PRIORITAIRE",
  escalade: "PRIORITAIRE",
  retard: "PRIORITAIRE",
  aide: "PRIORITAIRE",
  action: "PRIORITAIRE",
  menu: "PRIORITAIRE",
  commentaire: "A_SUIVRE",
  echeance: "A_SUIVRE",
  planning: "A_SUIVRE",
  relance: "A_SUIVRE",
  import: "A_SUIVRE",
  badge: "INFO",
  felicitations: "INFO",
};

/** Un type inconnu est « à suivre » : jamais perdu, jamais alarmant. */
export const tierOf = (kind: string): Tier => TIER_OF[kind] ?? "A_SUIVRE";

export const kindsOf = (tier: Tier) => Object.keys(TIER_OF).filter((k) => TIER_OF[k] === tier);

/** Types qui comptent dans le compteur du courrier. */
export const ACTIONABLE_KINDS_EXCLUDED = kindsOf("INFO");

export const tierLabels: Record<Tier, string> = {
  PRIORITAIRE: "Prioritaire",
  A_SUIVRE: "À suivre",
  INFO: "Information",
};

/** « @Prénom » dans un texte : prénoms repliés (sans accents, minuscules), sans doublon. */
export function mentionedNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s(])@([\p{L}][\p{L}-]*)/gu)) names.add(fold(m[1]));
  return [...names];
}

export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
