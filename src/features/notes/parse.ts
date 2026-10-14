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

const MARKER = /^\s*(?:[-*•]\s*)?(?:\[\s?\]|todo\s*:?|à faire\s*:|a faire\s*:|action\s*:|→|->)\s*/i;
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

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function iso(y: number, m: number, d: number) {
  return parseDateInput(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

/** Date relative ou absolue trouvée dans le texte ; une date sans année passée bascule l'an prochain. */
export function findDate(text: string, today: Date): { date: Date; match: string } | null {
  const t = fold(text);
  let m = /(?:pour |avant |d'ici |le )?(?:le )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t);
  if (m) {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getUTCFullYear();
    let d = iso(y, Number(m[2]), Number(m[1]));
    if (d && !m[3] && d < today) d = iso(y + 1, Number(m[2]), Number(m[1]));
    if (d) return { date: d, match: m[0] };
  }
  m = new RegExp(`(?:pour |avant |d'ici |le )?(?:le )?(\\d{1,2}) (${MONTHS.join("|")})(?: (\\d{4}))?`).exec(
    t,
  );
  if (m) {
    const month = MONTHS.indexOf(m[2]) + 1;
    const y = m[3] ? Number(m[3]) : today.getUTCFullYear();
    let d = iso(y, month, Number(m[1]));
    if (d && !m[3] && d < today) d = iso(y + 1, month, Number(m[1]));
    if (d) return { date: d, match: m[0] };
  }
  m = /(?:pour |d'ici )?(aujourd'hui|demain|apres-demain)/.exec(t);
  if (m) return { date: addDays(today, m[1] === "aujourd'hui" ? 0 : m[1] === "demain" ? 1 : 2), match: m[0] };
  m = new RegExp(`(?:pour |avant |d'ici )?(${DAYS.join("|")})(?: prochain)?`).exec(t);
  if (m) {
    const target = DAYS.indexOf(m[1]);
    const diff = (target - today.getUTCDay() + 7) % 7 || 7;
    return { date: addDays(today, diff), match: m[0] };
  }
  return null;
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
    if (found) {
      // Retire la date du titre en conservant le reste de la phrase.
      const idx = fold(text).indexOf(found.match);
      if (idx >= 0) text = (text.slice(0, idx) + text.slice(idx + found.match.length)).trim();
    }
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
