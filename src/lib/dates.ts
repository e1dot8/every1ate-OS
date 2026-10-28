/**
 * Dates « calendrier » (sans heure) : stockées à minuit UTC (@db.Date), affichées sans conversion de fuseau.
 * Horodatages : stockés en UTC, affichés en Europe/Paris.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Refuse les dates impossibles (ex. 30 février) au lieu de les décaler.
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.trim() ? null : date;
}

export function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Aujourd'hui (date calendrier à Paris), à minuit UTC. */
export function todayDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseDateInput(parts)!;
}

/** « 3 nov. » ou « 3 nov. 2027 » si l'année diffère. */
export function formatDay(date: Date | null | undefined, now = new Date()): string {
  if (!date) return "—";
  const sameYear = date.getUTCFullYear() === todayDate(now).getUTCFullYear();
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », « il y a 2 j », puis la date. */
export function formatRelative(date: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return formatDay(date, now);
}

/** Lundi de la semaine d'une date calendrier. */
export function startOfWeek(date: Date): Date {
  const day = (date.getUTCDay() + 6) % 7;
  return addDays(date, -day);
}

export function formatTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** « lundi 12 oct. » pour une date calendrier. */
export function formatWeekday(date: Date): string {
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ajoute des mois en restant dans le mois cible (31 janv. + 1 mois → 28/29 févr.). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), last)));
}

/** Lundi à vendredi. */
export function isWorkingDay(date: Date): boolean {
  const d = date.getUTCDay();
  return d !== 0 && d !== 6;
}
