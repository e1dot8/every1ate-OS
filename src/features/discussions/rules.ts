/**
 * Règles pures des discussions (V1.2) : salons et accès, commandes du compositeur, mentions,
 * mise en forme légère, jours, rappels et envois programmés. Aucune dépendance serveur :
 * partagées par le serveur, les composants et les tests unitaires.
 */
import type { ChannelKind } from "@/generated/prisma/enums";
import { localDay, utcToLocalInput, zonedToUtc } from "@/features/calendar/rules";
import { foldText } from "@/features/search/rules";
import { addDays, formatWeekday, parseDateInput, todayDate } from "@/lib/dates";
import type { FormState } from "@/lib/forms";

// ─── Limites et constantes ──────────────────────────────────────────────────

export const MESSAGE_MAX_LENGTH = 4000;
export const CHANNEL_NAME_MAX = 80;
export const TOPIC_MAX = 250;
export const ATTACHMENT_TITLE_MAX = 120;
/** Messages affichés par page dans un salon. */
export const PAGE_SIZE = 50;

/** Palette fixe des réactions. */
export const REACTIONS = ["👍", "✅", "👀", "🙏", "🎉", "❤️", "😂"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (value: string): value is Reaction =>
  (REACTIONS as readonly string[]).includes(value);

/** Salons publics créés à la demande pour tous les associés. */
export const DEFAULT_CHANNELS = [
  { slug: "general", name: "Salle commune", topic: "Tout ce qui concerne l'équipe." },
  { slug: "clients", name: "Hall clients", topic: "Clients, prospects et relances." },
] as const;
export const GENERAL_SLUG = "general";
export const isDefaultChannel = (slug: string) => DEFAULT_CHANNELS.some((c) => c.slug === slug);

/** Segments déjà pris par les pages de /discussions : jamais attribués à un salon créé. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "activite",
  "plus-tard",
  "programmes",
  "recherche",
  "nouveau",
  "direct",
  "salons",
  "general",
  "clients",
]);

// ─── Identifiants de salon ──────────────────────────────────────────────────

/** « Campagne Été 2027 ! » → « campagne-ete-2027 » (48 caractères au plus). */
export function slugify(name: string): string {
  const base = foldText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base || "salon";
}

/**
 * Identifiants à essayer, dans l'ordre, pour un salon nommé `name` : le nom seul, puis suivi
 * d'un suffixe court et enfin du suffixe complet (unicité garantie par la base).
 */
export function channelSlugCandidates(name: string, suffix: string): string[] {
  const base = slugify(name);
  const safe =
    RESERVED_SLUGS.has(base) || base.startsWith("dm-") || base.startsWith("perso-") ? `salon-${base}` : base;
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [safe, `${safe}-${tail.slice(-6)}`, `${safe}-${tail}`];
}

/** Message direct entre deux associés : un seul salon, quel que soit celui qui l'ouvre. */
export function dmSlug(a: string, b: string): string {
  return `dm-${[a, b].sort().join("-")}`;
}

/** Salon « notes pour soi » d'un associé. */
export const persoSlug = (userId: string) => `perso-${userId}`;

/**
 * Nom affiché d'un salon : nom du projet (suit ses renommages), l'autre associé pour un
 * message direct, « Moi (notes perso) » pour les notes perso.
 */
export function channelTitle(channel: {
  kind: ChannelKind;
  name: string;
  projectName?: string | null;
  partnerName?: string | null;
}): string {
  if (channel.kind === "PERSO") return "Moi (notes perso)";
  if (channel.kind === "DIRECT") return channel.partnerName ?? "Message direct";
  return channel.projectName ?? channel.name;
}

/** Icône d'un salon (texte, décorative). */
export function channelIcon(channel: { kind: ChannelKind; projectId?: string | null }): string {
  if (channel.kind === "PERSO") return "📝";
  if (channel.kind === "DIRECT") return "💬";
  if (channel.kind === "PRIVE") return "🔒";
  return channel.projectId ? "📁" : "#";
}

/** Lien vers un message : dans le salon, ou dans son fil pour une réponse. */
export function messageHref(slug: string, message: { id: string; parentId: string | null }): string {
  return message.parentId
    ? `/discussions/${slug}/fil/${message.parentId}#m-${message.id}`
    : `/discussions/${slug}#m-${message.id}`;
}

/** Lien permanent d'un message (sa page de fil, quel que soit son âge). */
export function permalink(slug: string, message: { id: string; parentId: string | null }): string {
  return `/discussions/${slug}/fil/${message.parentId ?? message.id}#m-${message.id}`;
}

/** Lien d'un message du QG : chemin interne (« /taches/… ») ou adresse https, sinon rien. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const value = href.trim();
  if (/^\/(?![/\\])[^\s]*$/.test(value)) return value;
  return isHttpsUrl(value) ? value : null;
}

// ─── Accès ──────────────────────────────────────────────────────────────────

/**
 * Règle unique d'accès : un salon public est ouvert à tous les associés ;
 * un salon privé, un message direct ou des notes perso aux seuls membres.
 */
export function canAccessChannel(channel: { kind: ChannelKind }, isMember: boolean): boolean {
  return channel.kind === "PUBLIC" || isMember;
}

/** Écrire suppose l'accès et un salon non archivé (un salon archivé reste lisible). */
export function canPostInChannel(
  channel: { kind: ChannelKind; archivedAt: Date | null },
  isMember: boolean,
): boolean {
  return !channel.archivedAt && canAccessChannel(channel, isMember);
}

/** Les salons par défaut, les messages directs et les notes perso ne s'archivent pas. */
export function canArchiveChannel(channel: { kind: ChannelKind; slug: string }): boolean {
  return (channel.kind === "PUBLIC" || channel.kind === "PRIVE") && !isDefaultChannel(channel.slug);
}

// ─── Mentions ───────────────────────────────────────────────────────────────

/** Mention collective : tous les membres du salon. */
export const HERE_TOKEN = "ici";

const isWordChar = (ch: string) => !!ch && /[\p{L}\p{N}]/u.test(ch);
/** Avant un « @ » : début, espace ou ponctuation, jamais une adresse e-mail (a@b) ni une URL. */
const mentionBoundary = (prev: string) => !prev || !/[\p{L}\p{N}_.@/]/u.test(prev);
const MENTION_AT = /^@([\p{L}][\p{L}\p{N}_-]*)/u;

function readMention(input: string, at: number): string | null {
  if (!mentionBoundary(at > 0 ? input[at - 1] : "")) return null;
  const match = MENTION_AT.exec(input.slice(at));
  if (!match) return null;
  return match[1].replace(/[-_]+$/, "") || null;
}

/** Mots mentionnés (« @Pierre », « @ici »), sans doublon, hors blocs de code. */
export function extractMentionTokens(body: string): string[] {
  const text = body.replace(/`[^`\n]*`/g, " ");
  const seen = new Map<string, string>();
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "@") continue;
    const token = readMention(text, i);
    if (token && !seen.has(foldText(token))) seen.set(foldText(token), token);
  }
  return [...seen.values()];
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export type MentionResolution = { ids: string[]; here: boolean; ambiguous: string[] };

/**
 * Associe chaque mot mentionné à un associé : prénom (ou nom complet sans espace),
 * sans tenir compte des accents ni de la casse. Un prénom partagé par plusieurs personnes
 * n'est attribué à personne (signalé dans `ambiguous`). L'auteur ne se mentionne jamais lui-même.
 */
export function resolveMentions(
  tokens: string[],
  people: { id: string; name: string }[],
  authorId: string | null,
): MentionResolution {
  const ids = new Set<string>();
  const ambiguous: string[] = [];
  let here = false;
  for (const token of tokens) {
    const folded = foldText(token);
    if (folded === HERE_TOKEN) {
      here = true;
      continue;
    }
    const matches = people.filter(
      (p) => foldText(firstName(p.name)) === folded || foldText(p.name.replace(/\s+/g, "")) === folded,
    );
    if (matches.length === 1) ids.add(matches[0].id);
    else if (matches.length > 1) ambiguous.push(token);
  }
  if (authorId) ids.delete(authorId);
  return { ids: [...ids], here, ambiguous };
}

/**
 * Avertissement éphémère (visible par l'auteur seul) quand un prénom mentionné est porté par
 * plusieurs associés : le message part, mais personne n'est mentionné pour ce prénom.
 */
export function ambiguousMentionWarning(ambiguous: string[]): string | null {
  if (!ambiguous.length) return null;
  if (ambiguous.length === 1)
    return `Plusieurs associés s'appellent ${ambiguous[0]} : personne n'a été mentionné. Écris le nom complet.`;
  return `Prénoms portés par plusieurs associés (${ambiguous.join(", ")}) : personne n'a été mentionné pour ces prénoms. Écris le nom complet.`;
}

/**
 * Publier marque-t-il le salon comme lu pour l'auteur ? Oui pour un message du salon ; non pour une
 * réponse dans un fil (sauf « aussi dans le salon ») ni quand l'appelant le refuse (message
 * programmé, publié sans que l'auteur soit là) : les messages des autres restent non lus.
 */
export function marksChannelRead(input: {
  parentId?: string | null;
  alsoInChannel?: boolean;
  markRead?: boolean;
}): boolean {
  if (input.markRead === false) return false;
  return !input.parentId || !!input.alsoInChannel;
}

// ─── Mise en forme légère ───────────────────────────────────────────────────

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "code"; text: string }
  | { type: "link"; href: string; text: string }
  | { type: "mention"; text: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] };

/** Lien https bien formé (seul protocole rendu cliquable). */
export function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\/\S+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Ponctuation finale qui n'appartient pas au lien (« voir https://x.fr. »). */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.at(-1) ?? "";
    if (/[.,;:!?'"»*_]/.test(last)) url = url.slice(0, -1);
    else if (last === ")" && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))
      url = url.slice(0, -1);
    else return url;
  }
}

function findClosing(input: string, marker: string, start: number): number {
  if (start >= input.length || /\s/.test(input[start])) return -1;
  const newline = input.indexOf("\n", start);
  let from = start;
  for (;;) {
    const at = input.indexOf(marker, from);
    if (at === -1 || (newline !== -1 && newline < at)) return -1;
    const doubled = marker === "*" && input[at + 1] === "*";
    if (at > start && !/\s/.test(input[at - 1]) && !doubled && !isWordChar(input[at + marker.length] ?? ""))
      return at;
    from = at + (doubled ? 2 : 1);
  }
}

/**
 * Découpe un message en nœuds : **gras** (ou *gras*), _italique_, `code`, liens https
 * automatiques, @mentions et retours à la ligne. Le rendu construit des éléments React à partir
 * de ces nœuds : aucun HTML n'est jamais injecté.
 */
export function parseInline(input: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let text = "";
  const flush = () => {
    if (text) nodes.push({ type: "text", text });
    text = "";
  };
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : "";
    if (ch === "\n") {
      flush();
      nodes.push({ type: "break" });
      i += 1;
      continue;
    }
    if (ch === "`") {
      const end = input.indexOf("`", i + 1);
      const newline = input.indexOf("\n", i + 1);
      if (end > i + 1 && (newline === -1 || end < newline)) {
        flush();
        nodes.push({ type: "code", text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 2 && (ch === "*" || ch === "_") && !isWordChar(prev)) {
      const marker = ch === "*" && input[i + 1] === "*" ? "**" : ch;
      const start = i + marker.length;
      const close = findClosing(input, marker, start);
      if (close > start) {
        flush();
        const children = parseInline(input.slice(start, close), depth + 1);
        nodes.push(marker === "_" ? { type: "italic", children } : { type: "bold", children });
        i = close + marker.length;
        continue;
      }
    }
    if (ch === "h" && !isWordChar(prev) && input.startsWith("https://", i)) {
      const raw = /^https:\/\/[^\s<>"`]+/.exec(input.slice(i))?.[0] ?? "";
      const url = trimUrl(raw);
      if (url.length > "https://".length && isHttpsUrl(url)) {
        flush();
        nodes.push({ type: "link", href: url, text: url });
        i += url.length;
        continue;
      }
    }
    if (ch === "@") {
      const token = readMention(input, i);
      if (token) {
        flush();
        nodes.push({ type: "mention", text: `@${token}` });
        i += token.length + 1;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  flush();
  return nodes;
}

function flatten(nodes: InlineNode[]): string {
  return nodes
    .map((n) =>
      n.type === "break"
        ? " "
        : n.type === "bold" || n.type === "italic"
          ? flatten(n.children)
          : n.type === "link" || n.type === "code" || n.type === "mention" || n.type === "text"
            ? n.text
            : "",
    )
    .join("");
}

/** Texte brut court d'un message (notifications, titres de tâche, extraits). */
export function plainExcerpt(body: string, max = 140): string {
  const plain = flatten(parseInline(body)).replace(/\s+/g, " ").trim();
  const chars = Array.from(plain);
  if (chars.length <= max) return plain;
  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Titre de tâche proposé à partir d'un message (début du texte, sans mise en forme). */
export const taskTitleFromMessage = (body: string) => plainExcerpt(body, 120) || "Tâche issue d'un message";

// ─── Dates : jours, heures, rappels ─────────────────────────────────────────

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Instant UTC d'une heure de Paris un jour donné (jour calendrier à minuit UTC). */
export function parisAt(day: Date, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return zonedToUtc(`${isoDay(day)}T${hh}:${mm}`)!;
}

/** Demain 9 h, heure de Paris. */
export const tomorrowAt9 = (now: Date) => parisAt(addDays(todayDate(now), 1), 9);

/** Lundi prochain 9 h, heure de Paris (le lundi suivant si l'on est lundi). */
export function nextMondayAt9(now: Date): Date {
  const today = todayDate(now);
  const diff = (8 - today.getUTCDay()) % 7 || 7;
  return parisAt(addDays(today, diff), 9);
}

/** « 15 h » ou « 15 h 30 », heure de Paris. */
export function formatHourFr(date: Date): string {
  const [h, m] = utcToLocalInput(date).slice(11, 16).split(":");
  return `${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
}

/** « 15 h » le jour même, sinon « jeudi 5 nov. à 9 h ». */
export function formatMomentFr(date: Date, now: Date): string {
  if (localDay(date) === localDay(now)) return formatHourFr(date);
  const day = parseDateInput(localDay(date))!;
  const label =
    isoDay(day) === isoDay(addDays(todayDate(now), 1)) ? "demain" : formatWeekday(day).toLowerCase();
  return `${label} à ${formatHourFr(date)}`;
}

/** Choix proposés par « Me rappeler » sur un message. */
export const REMINDER_CHOICES = [
  { value: "20m", label: "Dans 20 min" },
  { value: "1h", label: "Dans 1 h" },
  { value: "3h", label: "Dans 3 h" },
  { value: "demain", label: "Demain 9 h" },
] as const;
export type ReminderChoice = (typeof REMINDER_CHOICES)[number]["value"];
export const isReminderChoice = (v: string): v is ReminderChoice =>
  REMINDER_CHOICES.some((c) => c.value === v);

/** Heure d'un rappel : dans 20 min, 1 h, 3 h ou demain 9 h (heure de Paris). */
export function reminderAt(choice: ReminderChoice, now: Date): Date {
  if (choice === "demain") return tomorrowAt9(now);
  const minutes = choice === "20m" ? 20 : choice === "1h" ? 60 : 180;
  return new Date(now.getTime() + minutes * 60_000);
}

const MAX_DELAY_MINUTES = 7 * 24 * 60;
/** « Nh » à partir de cette heure (et jusqu'à 23) : une heure de la journée, pas un délai. */
const FIRST_CLOCK_HOUR = 7;

/** Prochaine occurrence d'une heure de Paris : aujourd'hui si elle est encore à venir, sinon demain. */
function nextParisTime(hour: number, minute: number, now: Date): Date {
  const today = parisAt(todayDate(now), hour, minute);
  return today > now ? today : parisAt(addDays(todayDate(now), 1), hour, minute);
}

/**
 * Délai d'un « /rappel » : « 20m », « 45min », « 2h » (délai de 1 à 6 h, ou de 24 h et plus),
 * « 17h » (heure de la journée de 7 à 23 h), « 15h30 » (aujourd'hui, ou demain si l'heure est
 * passée) ou « demain » (9 h), heure de Paris. Null si illisible ou au-delà d'une semaine.
 */
export function parseDelay(token: string, now: Date): Date | null {
  const t = foldText(token.trim());
  if (t === "demain") return tomorrowAt9(now);
  let m = /^(\d{1,5})\s*(m|mn|min|mins|minute|minutes)$/.exec(t);
  if (m) {
    const minutes = Number(m[1]);
    return minutes >= 1 && minutes <= MAX_DELAY_MINUTES ? new Date(now.getTime() + minutes * 60_000) : null;
  }
  m = /^(\d{1,3})\s*(h|heure|heures)$/.exec(t);
  if (m) {
    const hours = Number(m[1]);
    // « /rappel 17h Appeler X » : à 17 h, pas dans 17 heures.
    if (hours >= FIRST_CLOCK_HOUR && hours <= 23) return nextParisTime(hours, 0, now);
    return hours >= 1 && hours * 60 <= MAX_DELAY_MINUTES ? new Date(now.getTime() + hours * 3_600_000) : null;
  }
  m = /^(\d{1,2})h(\d{2})$/.exec(t);
  if (m) {
    const [hour, minute] = [Number(m[1]), Number(m[2])];
    if (hour > 23 || minute > 59) return null;
    return nextParisTime(hour, minute, now);
  }
  return null;
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Échéance d'un « /tache » : aujourd'hui, demain, après-demain, un jour de la semaine
 * (le prochain, jamais aujourd'hui) ou jj/mm[/aaaa] (l'an prochain si la date est passée).
 */
export function parseDueToken(token: string, today: Date): Date | null {
  const t = foldText(token.trim())
    .replace(/[’]/g, "'")
    .replace(/[.,;!?]+$/, "");
  if (t === "aujourd'hui" || t === "auj") return today;
  if (t === "demain") return addDays(today, 1);
  if (t === "apres-demain") return addDays(today, 2);
  const weekday = WEEKDAYS.indexOf(t);
  if (weekday >= 0) return addDays(today, (weekday - today.getUTCDay() + 7) % 7 || 7);
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const explicitYear = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
  const build = (year: number) =>
    parseDateInput(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  if (explicitYear) return build(explicitYear);
  const year = today.getUTCFullYear();
  const date = build(year);
  if (date && date < today) return build(year + 1);
  return date ?? build(year + 1);
}

/** Jour (Paris) d'un message, pour le regroupement. */
export const messageDay = (date: Date) => localDay(date);

/** « Aujourd'hui », « Hier » ou « Lundi 2 nov. ». */
export function dayLabel(day: string, now: Date): string {
  const today = todayDate(now);
  if (day === isoDay(today)) return "Aujourd'hui";
  if (day === isoDay(addDays(today, -1))) return "Hier";
  const date = parseDateInput(day);
  if (!date) return day;
  const label = formatWeekday(date);
  return date.getUTCFullYear() === today.getUTCFullYear() ? label : `${label} ${date.getUTCFullYear()}`;
}

export type GroupedMessage<T> = { message: T; compact: boolean };
export type DayGroup<T> = { day: string; label: string; items: GroupedMessage<T>[] };

/**
 * Regroupe des messages (ordre chronologique) par jour de Paris. Un message suit le précédent
 * sans répéter l'auteur (`compact`) s'il vient de la même personne moins de 5 minutes après.
 */
export function groupByDay<T extends { createdAt: Date; authorId: string | null }>(
  messages: T[],
  now: Date,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  let previous: T | null = null;
  for (const message of messages) {
    const day = messageDay(message.createdAt);
    let group = groups.at(-1);
    if (!group || group.day !== day) {
      group = { day, label: dayLabel(day, now), items: [] };
      groups.push(group);
      previous = null;
    }
    const compact =
      !!previous &&
      !!message.authorId &&
      previous.authorId === message.authorId &&
      message.createdAt.getTime() - previous.createdAt.getTime() < 5 * 60_000;
    group.items.push({ message, compact });
    previous = message;
  }
  return groups;
}

/** Premier message non lu (écrit par quelqu'un d'autre après la dernière lecture), sinon -1. */
export function firstUnreadIndex<T extends { createdAt: Date; authorId: string | null }>(
  messages: T[],
  lastReadAt: Date | null,
  viewerId: string,
): number {
  if (!lastReadAt) return -1;
  return messages.findIndex((m) => m.createdAt > lastReadAt && m.authorId !== viewerId);
}

// ─── Présence dans un message direct ────────────────────────────────────────

/**
 * Encadré d'un message direct quand l'autre associé a choisi un statut de concentration.
 * Jamais d'heure de connexion ni de « vu à » : seulement le statut qu'il a choisi.
 */
export function presenceNotice(
  name: string,
  presence: { state: "DISPO" | "FOCUS" | "REUNION" | "ABSENT"; until: Date | null },
  now: Date,
): string | null {
  const who = firstName(name);
  const until = presence.until ? ` jusqu'à ${formatMomentFr(presence.until, now)}` : "";
  // En focus, aucune alerte n'arrive sur son téléphone (sauf urgence) : il lira en sortant du focus.
  if (presence.state === "FOCUS")
    return `${who} est en focus${until} : il verra ton message en sortant du focus (pas d'alerte sur son téléphone d'ici là).`;
  if (presence.state === "ABSENT") return `${who} est absent${until} : il verra ton message à son retour.`;
  if (presence.state === "REUNION") return `${who} est en réunion${until}.`;
  return null;
}

// ─── Visio ──────────────────────────────────────────────────────────────────

/** Salle Jitsi propre au salon : https://meet.jit.si/every1ate-<salon>-<aléatoire>. */
export function jitsiUrl(slug: string, random: string): string {
  const room = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  const tail = random.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://meet.jit.si/every1ate-${room}-${tail}`;
}

// ─── Commandes ──────────────────────────────────────────────────────────────

export const COMMANDS = [
  { name: "aide", usage: "/aide", help: "Liste des commandes." },
  {
    name: "tache",
    usage: "/tache Titre @Prénom demain",
    help: "Crée une tâche dans le projet du salon (échéance : demain, lundi… ou jj/mm).",
  },
  { name: "relance", usage: "/relance [client]", help: "Relances commerciales en retard." },
  { name: "focus", usage: "/focus 50", help: "Passe en focus (minutes, 50 par défaut)." },
  { name: "dispo", usage: "/dispo", help: "Redevient disponible." },
  {
    name: "standup",
    usage: "/standup Ce que je fais | Ce qui me bloque",
    help: "Stand-up du jour (la partie après | est le blocage).",
  },
  {
    name: "rappel",
    usage: "/rappel 17h Texte",
    help: "Rappel à une heure (17h, 15h30), dans un délai (20m, 2h : de 1 à 6 h) ou demain (9 h).",
  },
  { name: "huddle", usage: "/huddle", help: "Partage le lien visio du salon." },
] as const;

export type ParsedCommand =
  | { ok: true; command: "aide" }
  | { ok: true; command: "tache"; title: string; owner: string | null; due: Date | null }
  | { ok: true; command: "relance"; filter: string | null }
  | { ok: true; command: "focus"; minutes: number }
  | { ok: true; command: "dispo" }
  | { ok: true; command: "standup"; today: string | null; blocked: string | null }
  | { ok: true; command: "rappel"; remindAt: Date; text: string }
  | { ok: true; command: "huddle" }
  | { ok: false; error: string };

/** Le texte saisi est-il une commande (« /mot … ») ? */
export const isCommand = (body: string) => /^\/\p{L}/u.test(body.trim());

/** Analyse une commande du compositeur. Null si le texte n'est pas une commande. */
export function parseCommand(body: string, now: Date): ParsedCommand | null {
  const trimmed = body.trim();
  if (!isCommand(trimmed)) return null;
  const match = /^\/(\S+)\s*([\s\S]*)$/u.exec(trimmed)!;
  const name = foldText(match[1]);
  const rest = match[2].trim();
  switch (name) {
    case "aide":
    case "help":
      return { ok: true, command: "aide" };
    case "tache": {
      const usage = "Indique un titre : /tache Titre @Prénom demain.";
      const tokens = rest.split(/\s+/).filter(Boolean);
      const ownerIndex = tokens.findIndex((t) => /^@\p{L}/u.test(t));
      const owner = ownerIndex >= 0 ? tokens[ownerIndex].slice(1).replace(/[.,;:!?]+$/, "") : null;
      if (ownerIndex >= 0) tokens.splice(ownerIndex, 1);
      const due = tokens.length > 1 ? parseDueToken(tokens.at(-1)!, todayDate(now)) : null;
      if (due) tokens.pop();
      const title = tokens.join(" ").trim();
      if (!title) return { ok: false, error: usage };
      if (title.length > 300) return { ok: false, error: "Titre trop long (300 caractères)." };
      return { ok: true, command: "tache", title, owner, due };
    }
    case "relance":
    case "relances":
      return { ok: true, command: "relance", filter: rest || null };
    case "focus": {
      if (!rest) return { ok: true, command: "focus", minutes: 50 };
      const minutes = /^(\d{1,3})\s*(m|min|mn|minutes)?$/i.exec(rest);
      if (!minutes || Number(minutes[1]) < 5 || Number(minutes[1]) > 480)
        return { ok: false, error: "Durée du focus : entre 5 et 480 minutes (ex. /focus 50)." };
      return { ok: true, command: "focus", minutes: Number(minutes[1]) };
    }
    case "dispo":
      return { ok: true, command: "dispo" };
    case "standup": {
      const [today = "", ...blocked] = rest.split("|");
      const t = today.trim() || null;
      const b = blocked.join("|").trim() || null;
      if (!t && !b) return { ok: false, error: "Écris : /standup Ce que je fais | Ce qui me bloque." };
      return { ok: true, command: "standup", today: t, blocked: b };
    }
    case "rappel": {
      const usage = "Écris : /rappel 17h Texte (ou 15h30, 20m, 2h, demain).";
      const [delay = "", ...words] = rest.split(/\s+/);
      const text = words.join(" ").trim();
      const remindAt = delay ? parseDelay(delay, now) : null;
      if (!remindAt || !text) return { ok: false, error: usage };
      if (text.length > 500) return { ok: false, error: "Rappel trop long (500 caractères)." };
      return { ok: true, command: "rappel", remindAt, text };
    }
    case "huddle":
    case "visio":
      return { ok: true, command: "huddle" };
    default:
      return { ok: false, error: `Commande inconnue : /${match[1]}. Tape /aide pour la liste.` };
  }
}

// ─── Réponses du compositeur ────────────────────────────────────────────────

/** Ligne d'une réponse éphémère (visible par toi seul, jamais stockée). */
export type EphemeralLine = { text: string; href?: string };
/** État du compositeur : celui d'un formulaire, plus d'éventuelles lignes éphémères. */
export type ComposerState = FormState & { lines?: EphemeralLine[] };

/** Réponse de « /aide ». */
export const helpLines = (): EphemeralLine[] => COMMANDS.map((c) => ({ text: `${c.usage} — ${c.help}` }));
