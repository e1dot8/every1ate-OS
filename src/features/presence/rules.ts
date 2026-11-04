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
