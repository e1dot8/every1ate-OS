/** Règles pures des briefings (testées). Rien d'obligatoire, rien de punitif. */
import type { DayMood, WeeklyItemKind } from "@/generated/prisma/enums";

/** Limites du menu de la semaine : au-delà, ce n'est plus une priorité. */
export const WEEKLY_LIMITS: Partial<Record<WeeklyItemKind, number>> = { OBJECTIF: 3, BLOCAGE: 3 };

export function itemLimitError(kind: WeeklyItemKind, existing: number): string | null {
  const max = WEEKLY_LIMITS[kind];
  if (max === undefined || existing < max) return null;
  return kind === "OBJECTIF"
    ? `Trois objectifs au plus par semaine : terminez ou retirez-en un d'abord.`
    : `Trois blocages au plus : traitez ou assignez d'abord ceux qui sont listés.`;
}

/** Capacité d'une journée : la capacité hebdomadaire répartie sur 5 jours ouvrés. */
export const dayCapacityMinutes = (weeklyHours: number) => Math.round((weeklyHours * 60) / 5);

export type DayLoad = { label: string; tone: "normal" | "warning" | "danger"; pct: number };

/** Lecture de la charge prévue face à la capacité du jour (hypothèse affichée, jamais un jugement). */
export function dayLoad(plannedMinutes: number, capacityMinutes: number): DayLoad {
  const pct = capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0;
  if (pct > 100) return { label: "Plus que la journée : alléger ou décaler ?", tone: "danger", pct };
  if (pct > 80) return { label: "Journée pleine", tone: "warning", pct };
  if (pct >= 40) return { label: "Journée équilibrée", tone: "normal", pct };
  return { label: "Journée légère : de la place pour le reste", tone: "normal", pct };
}

export const moodLabels: Record<DayMood, string> = {
  EN_FORME: "En forme",
  NORMAL: "Normal",
  CHARGE_ELEVEE: "Charge élevée",
  BESOIN_ALLEGER: "Besoin d'alléger",
};

export const weeklyKindLabels: Record<WeeklyItemKind, string> = {
  OBJECTIF: "Objectif",
  BLOCAGE: "Blocage",
  DECISION: "Décision",
  ACTION: "Action",
};
