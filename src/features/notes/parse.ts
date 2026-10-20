/**
 * Compte rendu → actions (pur, sans IA). Une ligne devient une tâche proposée si elle commence par :
 *   « [ ] », « - [ ] », « TODO », « À faire : », « Action : » ou « → ».
 * Dans la ligne : « @Prénom » désigne le responsable ; une date (« pour le 15/11 », « le 3 décembre »,
 * « demain », « vendredi ») devient l'échéance. Rien n'est créé sans confirmation.
 */
import { addDays, parseDateInput } from "@/lib/dates";

export type Person = { id: string; name: string };
export type ParsedAction = {
  line: number;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: Date | null;
  raw: string;
};

// Groupe 1 : indentation et puce éventuelle (conservées quand la ligne est marquée « [x] »).
// « [x] » ne correspond pas : une ligne déjà transformée en tâche n'est plus proposée.
// « todo » doit être un mot entier (« Todolist à revoir » n'est pas une action).
const MARKER = /^(\s*(?:[-*•]\s*)?)(?:\[\s?\]|todo\b\s*:?|à faire\s*:|a faire\s*:|action\s*:|→|->)\s*/i;
/** Marque d'une action déjà transformée en tâche. */
export const DONE_MARK = "[x]";
const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Minuscules, sans accents, apostrophes typographiques remplacées par « ' » — caractère par
 * caractère, pour que les positions restent celles du texte d'origine.
 */
const fold = (s: string) =>
  s.replace(/[\s\S]/gu, (c) => {
    if (c === "’" || c === "ʼ") return "'";
    const f = c
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return f.length === c.length ? f : c;
  });

function iso(y: number, m: number, d: number) {
  return parseDateInput(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

/**
 * Date relative ou absolue trouvée dans le texte ; une date sans année passée bascule l'an prochain.
 * Les mots-clés ne comptent qu'en mots entiers (« lendemain », « mails » ne sont pas des dates).
 * `index` / `match` : position et texte exacts à retirer du titre.
 */
export function findDate(text: string, today: Date): { date: Date; match: string; index: number } | null {
  const t = fold(text);
  const found = (date: Date, m: RegExpExecArray) => ({ date, match: m[0], index: m.index });
  let m = /(?:pour |avant |d'ici |le )?(?:le )?(?<!\d)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/u.exec(t);
  if (m) {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getUTCFullYear();
    let d = iso(y, Number(m[2]), Number(m[1]));
    if (d && !m[3] && d < today) d = iso(y + 1, Number(m[2]), Number(m[1]));
    if (d) return found(d, m);
  }
  m = new RegExp(
    `(?:pour |avant |d'ici |le )?(?:le )?(?<!\\d)(\\d{1,2}) (${MONTHS.join("|")})(?!\\p{L})(?: (\\d{4}))?`,
    "u",
  ).exec(t);
  if (m) {
    const month = MONTHS.indexOf(m[2]) + 1;
    const y = m[3] ? Number(m[3]) : today.getUTCFullYear();
    let d = iso(y, month, Number(m[1]));
    if (d && !m[3] && d < today) d = iso(y + 1, month, Number(m[1]));
    if (d) return found(d, m);
  }
  m = /(?:pour |d'ici )?(?<!\p{L})(aujourd'hui|apres-demain|demain)(?!\p{L})/u.exec(t);
  if (m) return found(addDays(today, m[1] === "aujourd'hui" ? 0 : m[1] === "demain" ? 1 : 2), m);
  m = new RegExp(`(?:pour |avant |d'ici )?(?<!\\p{L})(${DAYS.join("|")})(?!\\p{L})(?: prochain)?`, "u").exec(
    t,
  );
  if (m) {
    const target = DAYS.indexOf(m[1]);
    const diff = (target - today.getUTCDay() + 7) % 7 || 7;
    return found(addDays(today, diff), m);
  }
  return null;
}

/**
 * Texte d'un compte rendu tel qu'il est enregistré : caractères composés (NFC, sinon « À » saisi en
 * deux caractères ne serait pas reconnu), fins de ligne « \n » et sans blancs autour. Les numéros de
 * ligne lus par `parseActions` portent sur ce texte.
 */
export function normalizeNoteBody(body: string): string {
  return body.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

export function parseActions(body: string, people: Person[], today: Date): ParsedAction[] {
  const byName = new Map(people.map((p) => [fold(p.name.split(/\s+/)[0]), p]));
  const out: ParsedAction[] = [];
  body.split(/\r?\n/).forEach((rawLine, i) => {
    if (!MARKER.test(rawLine)) return;
    let text = rawLine.replace(MARKER, "").trim();
    if (!text) return;
    let owner: Person | null = null;
    const mention = /@([\p{L}][\p{L}-]*)/u.exec(text);
    if (mention) {
      owner = byName.get(fold(mention[1])) ?? null;
      if (owner) text = text.replace(mention[0], "").trim();
    }
    const found = findDate(text, today);
    if (found)
      // Retire exactement la date trouvée du titre, en conservant le reste de la phrase.
      text = (text.slice(0, found.index) + text.slice(found.index + found.match.length)).trim();
    const title = text
      .replace(/\s{2,}/g, " ")
      .replace(/[\s,;:–-]+$/, "")
      .trim();
    if (!title) return;
    out.push({
      line: i + 1,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      dueDate: found?.date ?? null,
      raw: rawLine.trim(),
    });
  });
  return out;
}

/**
 * Remplace le marqueur des lignes données (numérotées à partir de 1) par « [x] » : elles ne sont plus
 * détectées par `parseActions`. La puce, l'indentation, le reste du texte et les fins de ligne
 * (\n ou \r\n) sont conservés ; les autres lignes ne changent pas.
 */
export function markLinesDone(body: string, lineNumbers: Iterable<number>): string {
  const targets = new Set(lineNumbers);
  if (!targets.size) return body;
  // Les séparateurs capturés occupent les indices impairs.
  return body
    .split(/(\r?\n)/)
    .map((part, i) => {
      if (i % 2 || !targets.has(i / 2 + 1) || !MARKER.test(part)) return part;
      return part.replace(MARKER, (_match, prefix: string) => `${prefix}${DONE_MARK} `);
    })
    .join("");
}

/**
 * Rapproche les actions envoyées par le formulaire de celles encore détectées dans le compte rendu
 * (relu côté serveur) : c'est ce qui rend la création de tâches idempotente.
 * - ligne déjà marquée « [x] » (ou disparue) : ignorée (déjà traitée) ;
 * - ligne détectée mais dont le texte a changé, ou action encore en attente mais déplacée (ligne
 *   ajoutée au-dessus) : `stale` (le compte rendu a été modifié entre-temps) ;
 * - une même ligne envoyée deux fois n'est retenue qu'une fois.
 */
export function reconcileActions<T extends { line: number; raw: string }>(
  detected: Pick<ParsedAction, "line" | "raw">[],
  submitted: T[],
): { accepted: T[]; skipped: number; stale: boolean } {
  const byLine = new Map(detected.map((d) => [d.line, d.raw]));
  const pendingRaws = new Set(detected.map((d) => d.raw));
  const seen = new Set<number>();
  const accepted: T[] = [];
  let skipped = 0;
  let stale = false;
  for (const action of submitted) {
    if (seen.has(action.line)) continue;
    seen.add(action.line);
    const raw = byLine.get(action.line);
    // Ligne disparue de sa place mais encore en attente ailleurs : le texte a été décalé, pas traité.
    if (raw === undefined && pendingRaws.has(action.raw.trim())) stale = true;
    else if (raw === undefined) skipped++;
    else if (raw !== action.raw.trim()) stale = true;
    else accepted.push(action);
  }
  return { accepted, skipped, stale };
}
