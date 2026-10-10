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
