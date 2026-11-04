/**
 * Présence (pure). Le statut est choisi par l'associé, jamais déduit de son activité ;
 * un statut daté (« jusqu'à 11 h 30 ») redevient « Disponible » une fois l'heure passée.
 */
export type PresenceValue = "DISPO" | "FOCUS" | "REUNION" | "ABSENT";

export const presenceLabels: Record<PresenceValue, string> = {
  DISPO: "Disponible",
  FOCUS: "En focus",
  REUNION: "En réunion",
  ABSENT: "Absent",
};

/** Couleur de la pastille de présence (classe Tailwind). */
export const presenceDot: Record<PresenceValue, string> = {
  DISPO: "bg-success",
  FOCUS: "bg-pen",
  REUNION: "bg-info",
  ABSENT: "bg-muted-foreground",
};

export type PresenceInfo = {
  state: PresenceValue;
  until: Date | null;
  note: string | null;
  shared: boolean;
};

/** Statut affiché aux autres : « Disponible » si non partagé ou si l'échéance est passée. */
export function effectivePresence(p: PresenceInfo, now: Date, viewerIsSelf = false): PresenceInfo {
  const expired = p.until && p.until <= now;
  const state: PresenceValue = expired ? "DISPO" : p.state;
  if (!viewerIsSelf && !p.shared) return { state: "DISPO", until: null, note: null, shared: false };
  return { state, until: expired ? null : p.until, note: p.note, shared: p.shared };
}

/** Notifications hors app (push, WhatsApp) mises en pause pendant un focus ou une absence. */
export function isQuiet(p: PresenceInfo, now: Date): boolean {
  const s = effectivePresence(p, now, true).state;
  return s === "FOCUS" || s === "ABSENT";
}

/** Choix proposés par le menu de présence (barre du haut). */
export const PRESENCE_CHOICES = [
  { key: "DISPO", state: "DISPO", minutes: 0, label: "Disponible" },
  { key: "FOCUS_25", state: "FOCUS", minutes: 25, label: "En focus 25 min" },
  { key: "FOCUS_50", state: "FOCUS", minutes: 50, label: "En focus 50 min" },
  { key: "FOCUS_90", state: "FOCUS", minutes: 90, label: "En focus 90 min" },
  { key: "REUNION_60", state: "REUNION", minutes: 60, label: "En réunion 1 h" },
  { key: "ABSENT_JOUR", state: "ABSENT", minutes: 0, label: "Absent aujourd'hui" },
] as const satisfies readonly { key: string; state: PresenceValue; minutes: number; label: string }[];

export type PresenceChoice = (typeof PRESENCE_CHOICES)[number]["key"];
export const PRESENCE_NOTE_MAX = 80;

/** Fin de la journée à Paris (minuit suivant), pour « Absent aujourd'hui ». */
export function endOfParisDay(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const nextMidnightUtc = Date.UTC(y, m - 1, d + 1);
  // Décalage de Paris à ce moment-là (heure d'hiver : +1 h, d'été : +2 h).
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(new Date(nextMidnightUtc))
    .find((p) => p.type === "timeZoneName")?.value;
  const hours = Number(/GMT([+-]\d{1,2})/.exec(offset ?? "")?.[1] ?? 1);
  return new Date(nextMidnightUtc - hours * 3_600_000);
}

/** Statut et échéance correspondant à un choix du menu. */
export function presenceFromChoice(
  choice: PresenceChoice,
  now: Date,
): { state: PresenceValue; until: Date | null } {
  const c = PRESENCE_CHOICES.find((x) => x.key === choice)!;
  if (c.state === "DISPO") return { state: "DISPO", until: null };
  if (c.state === "ABSENT") return { state: "ABSENT", until: endOfParisDay(now) };
  return { state: c.state, until: new Date(now.getTime() + c.minutes * 60_000) };
}

/** Choix du menu le plus proche du statut actuel (pour pré-cocher le menu). */
export function choiceFor(p: { state: PresenceValue; until: Date | null }, now: Date): PresenceChoice {
  if (p.state === "DISPO") return "DISPO";
  if (p.state === "ABSENT") return "ABSENT_JOUR";
  if (p.state === "REUNION") return "REUNION_60";
  const left = p.until ? (p.until.getTime() - now.getTime()) / 60_000 : 90;
  return left <= 25 ? "FOCUS_25" : left <= 50 ? "FOCUS_50" : "FOCUS_90";
}

/** Libellé court du statut : « En focus · jusqu'à 11:30 ». */
export function presenceText(p: { state: PresenceValue; until: Date | null }): string {
  if (p.state === "DISPO" || !p.until) return presenceLabels[p.state];
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(p.until);
  return p.state === "ABSENT"
    ? `${presenceLabels.ABSENT} aujourd'hui`
    : `${presenceLabels[p.state]} · jusqu'à ${time}`;
}
