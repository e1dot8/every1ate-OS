/**
 * Avatars, objets décoratifs et décor collectif (pur, testé). Tout est cosmétique : aucun objet
 * ne donne de droit ni d'avantage. Les déblocages se lisent dans la progression existante
 * (niveau, rang, badges, paliers de la maison) : aucune monnaie, aucune boutique, aucun stock.
 */

export type Unlock =
  | { kind: "default" }
  | { kind: "level"; level: number }
  | { kind: "rank"; key: string; title: string }
  | { kind: "badge"; key: string; name: string };

export type Progress = { level: number; rankKey: string; rankLevel: number; badges: Set<string> };

const RANK_ORDER = ["apprenti", "commis", "chef-de-partie", "sous-chef", "chef-executif"];

export function isUnlocked(u: Unlock, p: Progress): boolean {
  if (u.kind === "default") return true;
  if (u.kind === "level") return p.level >= u.level;
  if (u.kind === "rank") return RANK_ORDER.indexOf(p.rankKey) >= RANK_ORDER.indexOf(u.key);
  return p.badges.has(u.key);
}

export function unlockLabel(u: Unlock): string {
  if (u.kind === "default") return "Disponible";
  if (u.kind === "level") return `Niveau ${u.level}`;
  if (u.kind === "rank") return `Rang ${u.title}`;
  return `Badge « ${u.name} »`;
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

export type AvatarPart = "skin" | "hat" | "apron" | "accessory" | "backdrop";
export type AvatarOption = { value: string; label: string; unlock: Unlock };

const d: Unlock = { kind: "default" };

export const AVATAR_OPTIONS: Record<AvatarPart, AvatarOption[]> = {
  skin: [
    { value: "s1", label: "Très claire", unlock: d },
    { value: "s2", label: "Claire", unlock: d },
    { value: "s3", label: "Médiane", unlock: d },
    { value: "s4", label: "Mate", unlock: d },
    { value: "s5", label: "Foncée", unlock: d },
    { value: "s6", label: "Très foncée", unlock: d },
  ],
  hat: [
    { value: "aucun", label: "Tête nue", unlock: d },
    { value: "toque", label: "Toque", unlock: d },
    { value: "bonnet", label: "Bonnet", unlock: d },
    { value: "casquette", label: "Casquette", unlock: d },
    { value: "bandana", label: "Bandana", unlock: { kind: "level", level: 3 } },
    { value: "toque-haute", label: "Grande toque", unlock: { kind: "rank", key: "commis", title: "Commis" } },
  ],
  apron: [
    { value: "noir", label: "Tablier noir", unlock: d },
    { value: "blanc", label: "Tablier blanc", unlock: d },
    { value: "jaune", label: "Tablier surligneur", unlock: { kind: "level", level: 2 } },
    {
      value: "rouge",
      label: "Tablier stylo rouge",
      unlock: { kind: "badge", key: "service-complet", name: "Service complet" },
    },
  ],
  accessory: [
    { value: "aucun", label: "Aucun", unlock: d },
    { value: "lunettes", label: "Lunettes", unlock: d },
    { value: "moustache", label: "Moustache", unlock: d },
    {
      value: "casque",
      label: "Casque audio",
      unlock: { kind: "badge", key: "couteau-suisse", name: "Couteau suisse" },
    },
  ],
  backdrop: [
    { value: "creme", label: "Crème", unlock: d },
    { value: "blanc", label: "Blanc", unlock: d },
    {
      value: "jaune",
      label: "Jaune",
      unlock: { kind: "badge", key: "premiere-commande", name: "La première commande" },
    },
    { value: "noir", label: "Noir", unlock: { kind: "level", level: 5 } },
  ],
};

export type AvatarLook = Record<AvatarPart, string>;
export const DEFAULT_AVATAR: AvatarLook = {
  skin: "s3",
  hat: "toque",
  apron: "noir",
  accessory: "aucun",
  backdrop: "creme",
};

/** Une apparence demandée n'est acceptée que si chaque option existe et est débloquée. */
export function validLook(look: AvatarLook, p: Progress): string | null {
  for (const part of Object.keys(AVATAR_OPTIONS) as AvatarPart[]) {
    const opt = AVATAR_OPTIONS[part].find((o) => o.value === look[part]);
    if (!opt) return "Option d'avatar inconnue.";
    if (!isUnlocked(opt.unlock, p))
      return `« ${opt.label} » n'est pas encore débloqué (${unlockLabel(opt.unlock)}).`;
  }
  return null;
}

// ─── Appartement ────────────────────────────────────────────────────────────

export type Slot = "mur" | "etagere" | "bureau" | "sol" | "lampe" | "vitrine";
export type Item = { key: string; name: string; slot: Slot; unlock: Unlock };

export const SLOTS: { key: Slot; name: string }[] = [
  { key: "mur", name: "Le mur" },
  { key: "etagere", name: "L'étagère" },
  { key: "bureau", name: "Le bureau" },
  { key: "sol", name: "Le sol" },
  { key: "lampe", name: "La lumière" },
  { key: "vitrine", name: "La vitrine" },
];

export const ITEMS: Item[] = [
  { key: "affiche-cuisine", name: "Affiche « On cuisine des expériences »", slot: "mur", unlock: d },
  {
    key: "affiche-methode",
    name: "Affiche « Notre méthode »",
    slot: "mur",
    unlock: { kind: "level", level: 2 },
  },
  {
    key: "affiche-sonnez",
    name: "Affiche « Une idée ? Sonnez »",
    slot: "mur",
    unlock: { kind: "badge", key: "premier-service", name: "Premier service" },
  },
  {
    key: "cadre-souvenir",
    name: "Cadre souvenir de projet",
    slot: "mur",
    unlock: { kind: "badge", key: "envoi-impeccable", name: "Envoi impeccable" },
  },
  { key: "livres", name: "Livres de recettes", slot: "etagere", unlock: d },
  { key: "carnets", name: "Pile de carnets", slot: "etagere", unlock: { kind: "level", level: 3 } },
  {
    key: "bocaux",
    name: "Bocaux d'épices",
    slot: "etagere",
    unlock: { kind: "badge", key: "couteau-suisse", name: "Couteau suisse" },
  },
  { key: "ordinateur", name: "Ordinateur portable", slot: "bureau", unlock: d },
  { key: "double-ecran", name: "Double écran", slot: "bureau", unlock: { kind: "level", level: 5 } },
  {
    key: "clap",
    name: "Clap de tournage",
    slot: "bureau",
    unlock: { kind: "badge", key: "sauvetage-en-cuisine", name: "Sauvetage en cuisine" },
  },
  { key: "plante", name: "Plante verte", slot: "sol", unlock: d },
  { key: "tapis", name: "Tapis rayé", slot: "sol", unlock: { kind: "level", level: 4 } },
  {
    key: "monstera",
    name: "Grand monstera",
    slot: "sol",
    unlock: { kind: "badge", key: "bonne-mise-en-place", name: "Bonne mise en place" },
  },
  { key: "lampe-bureau", name: "Lampe de bureau", slot: "lampe", unlock: d },
  { key: "lampe-arc", name: "Lampe arc", slot: "lampe", unlock: { kind: "level", level: 6 } },
  {
    key: "guirlande",
    name: "Guirlande lumineuse",
    slot: "lampe",
    unlock: { kind: "badge", key: "main-tendue", name: "Main tendue" },
  },
  {
    key: "medaille",
    name: "Médaille de la première commande",
    slot: "vitrine",
    unlock: { kind: "badge", key: "premiere-commande", name: "La première commande" },
  },
  {
    key: "toque-or",
    name: "Toque d'or",
    slot: "vitrine",
    unlock: { kind: "rank", key: "chef-de-partie", title: "Chef de partie" },
  },
  {
    key: "wok-dore",
    name: "Wok doré",
    slot: "vitrine",
    unlock: { kind: "badge", key: "service-complet", name: "Service complet" },
  },
];

export const itemByKey = (key: string) => ITEMS.find((i) => i.key === key) ?? null;

/** Disposition par défaut : le premier objet disponible de chaque emplacement (vitrine vide). */
export function defaultLayout(): Partial<Record<Slot, string>> {
  const out: Partial<Record<Slot, string>> = {};
  for (const s of SLOTS) {
    const first = ITEMS.find((i) => i.slot === s.key && i.unlock.kind === "default");
    if (first) out[s.key] = first.key;
  }
  return out;
}

/** Disposition affichée : les choix enregistrés encore valides, sinon le défaut. */
export function resolveLayout(
  saved: { slot: string; itemKey: string }[],
  p: Progress,
): Partial<Record<Slot, string>> {
  const layout = defaultLayout();
  for (const s of saved) {
    const item = itemByKey(s.itemKey);
    if (s.itemKey === "vide") delete layout[s.slot as Slot];
    else if (item && item.slot === s.slot && isUnlocked(item.unlock, p)) layout[item.slot] = item.key;
  }
  return layout;
}

// ─── Décor collectif du bureau commun ──────────────────────────────────────

export type HouseDecor = { key: string; name: string; points: number };

/** Débloqué par les paliers de la maison (projets livrés + objectifs atteints). */
export const HOUSE_DECOR: HouseDecor[] = [
  { key: "plante-commune", name: "La plante commune", points: 1 },
  { key: "tableau-projets", name: "Le tableau des projets livrés", points: 5 },
  { key: "machine-cafe", name: "La machine à café", points: 10 },
  { key: "neon", name: "Le néon Every1.ate", points: 25 },
  { key: "trophee-maison", name: "Le trophée de la maison", points: 50 },
  { key: "fresque", name: "La fresque de la brigade", points: 100 },
];

export const houseDecorFor = (points: number) =>
  HOUSE_DECOR.map((h) => ({ ...h, unlocked: points >= h.points }));
