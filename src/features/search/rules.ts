/**
 * Règles pures de la recherche globale : normalisation de la saisie, échappement LIKE,
 * repli des accents et de la casse, surlignage et extraits. Aucune dépendance serveur.
 */

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
/** Nombre maximal de résultats affichés par groupe (le total reste compté). */
export const SEARCH_GROUP_LIMIT = 8;

export type SearchGroupKey =
  | "projets"
  | "entreprises"
  | "contacts"
  | "opportunites"
  | "taches"
  | "documents"
  | "evenements"
  | "comptes-rendus";

/** Ordre d'affichage et libellés des groupes. */
export const SEARCH_GROUPS: readonly { key: SearchGroupKey; label: string }[] = [
  { key: "projets", label: "Projets" },
  { key: "entreprises", label: "Entreprises" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunites", label: "Opportunités" },
  { key: "taches", label: "Tâches" },
  { key: "documents", label: "Documents" },
  { key: "evenements", label: "Événements" },
  { key: "comptes-rendus", label: "Comptes rendus" },
];

export type NormalizedQuery =
  { status: "empty"; term: "" } | { status: "too-short"; term: string } | { status: "ok"; term: string };

/**
 * Nettoie la saisie (`?q=`) : caractères de contrôle retirés, espaces regroupés,
 * 100 caractères au plus ; moins de 2 caractères → pas de recherche.
 */
export function normalizeQuery(raw: unknown): NormalizedQuery {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return { status: "empty", term: "" };
  const cleaned = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const term = Array.from(cleaned).slice(0, SEARCH_MAX_LENGTH).join("").trim();
  if (!term) return { status: "empty", term: "" };
  if (Array.from(term).length < SEARCH_MIN_LENGTH) return { status: "too-short", term };
  return { status: "ok", term };
}

/** Échappe les jokers LIKE (`%`, `_`) et le caractère d'échappement `\` (clause `ESCAPE '\'`). */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Motif « contient » pour `LIKE … ESCAPE '\'`. */
export const containsPattern = (term: string) => `%${escapeLike(term)}%`;
/** Motif « commence par » (sert à classer les correspondances en tête). */
export const prefixPattern = (term: string) => `${escapeLike(term)}%`;

// Ligatures et lettres sans décomposition Unicode, repliées comme le fait `unaccent`.
const EXTRA_FOLDS: Record<string, string> = { œ: "oe", æ: "ae", ß: "ss", ø: "o", đ: "d", ł: "l" };

/** Replie un caractère (ou une lettre suivie de ses accents) : minuscules, sans accents (é → e, Œ → oe). */
function foldChar(ch: string): string {
  let out = "";
  for (const c of ch.toLowerCase().normalize("NFD")) {
    if (/\p{M}/u.test(c)) continue;
    out += EXTRA_FOLDS[c] ?? c;
  }
  return out;
}

/** Texte replié (minuscules, sans accents) : « Éclat Été » → « eclat ete ». */
export function foldText(text: string): string {
  return Array.from(text, foldChar).join("");
}

/**
 * Texte replié + correspondance de chaque position repliée vers le texte d'origine.
 * Une lettre et ses accents combinants (NFD) forment un seul bloc : le surlignage les garde ensemble.
 */
function foldWithMap(text: string) {
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const [ch] of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k += 1) {
      starts.push(index);
      ends.push(index + ch.length);
    }
    folded += f;
    index += ch.length;
  }
  return { folded, starts, ends };
}

export type TextPart = { text: string; match: boolean };

/**
 * Découpe `text` en morceaux, ceux qui correspondent au terme (comparaison sans accents ni casse)
 * étant marqués `match` ; les morceaux gardent l'orthographe d'origine.
 */
export function highlightParts(text: string, term: string): TextPart[] {
  if (!text) return [];
  const needle = foldText(term.trim());
  if (!needle) return [{ text, match: false }];
  const { folded, starts, ends } = foldWithMap(text);
  const parts: TextPart[] = [];
  let cursor = 0;
  let from = 0;
  for (;;) {
    const at = folded.indexOf(needle, from);
    if (at < 0) break;
    const start = starts[at];
    const end = ends[at + needle.length - 1];
    from = at + needle.length;
    if (start < cursor) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Coupe sans séparer une paire de substitution (émoji). */
function safeSlice(text: string, from: number, to: number) {
  let a = from;
  let b = to;
  if (a > 0 && a < text.length && isLowSurrogate(text.charCodeAt(a))) a += 1;
  if (b > 0 && b < text.length && isLowSurrogate(text.charCodeAt(b))) b -= 1;
  return text.slice(a, b);
}

/**
 * Extrait court autour de la première correspondance (sur des limites de mots, « … » aux coupures).
 * Sans correspondance dans le texte : son début.
 */
export function snippetAround(text: string, term: string, radius = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const needle = foldText(term.trim());
  const { folded, starts, ends } = foldWithMap(clean);
  const at = needle ? folded.indexOf(needle) : -1;
  if (at < 0) {
    if (clean.length <= radius * 2) return clean;
    let cut = clean.lastIndexOf(" ", radius * 2);
    if (cut <= 0) cut = radius * 2;
    return `${safeSlice(clean, 0, cut).trimEnd()}…`;
  }
  const start = starts[at];
  const end = ends[at + needle.length - 1];
  let from = Math.max(0, start - radius);
  let to = Math.min(clean.length, end + radius);
  if (from > 0) {
    const space = clean.indexOf(" ", from);
    if (space >= 0 && space < start) from = space + 1;
  }
  if (to < clean.length) {
    const space = clean.lastIndexOf(" ", to);
    if (space >= end) to = space;
  }
  const body = safeSlice(clean, from, to).trim();
  return `${from > 0 ? "…" : ""}${body}${to < clean.length ? "…" : ""}`;
}

/**
 * Page qui liste un document : sa tâche, sinon l'onglet Docs du projet, sinon l'entreprise,
 * sinon la bibliothèque filtrée sur son titre.
 */
export function documentHref(doc: {
  title: string;
  projectId: string | null;
  taskId: string | null;
  clientId: string | null;
}): string {
  if (doc.taskId) return `/taches/${doc.taskId}`;
  if (doc.projectId) return `/projets/${doc.projectId}?onglet=docs`;
  if (doc.clientId) return `/crm/clients/${doc.clientId}`;
  return `/documents?q=${encodeURIComponent(doc.title)}`;
}

/** « 1 résultat », « 12 résultats ». */
export const resultCountLabel = (n: number) => `${n} résultat${n > 1 ? "s" : ""}`;
