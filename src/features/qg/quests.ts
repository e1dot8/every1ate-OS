/**
 * Quêtes de la semaine et badges d'équipe (pur). Toujours collectifs : aucune donnée par associé,
 * uniquement ce qui est fini ou l'état des objets (relances, blocages, passations).
 */
import { addDays, startOfWeek, todayDate } from "@/lib/dates";

export type QuestKey = "huit-taches" | "zero-relance" | "rien-bloque" | "passations-traitees";

export const DONE_TARGET = 8;
export const BLOCKED_HOURS = 48;
export const HANDOFF_HOURS = 24;

export const questLabels: Record<QuestKey, string> = {
  "huit-taches": "Finir 8 tâches ensemble",
  "zero-relance": "Zéro relance commerciale en retard",
  "rien-bloque": "Rien de bloqué depuis plus de 48 h",
  "passations-traitees": "Passations traitées en moins de 24 h",
};

export const badgeLabels: Record<QuestKey, string> = {
  "huit-taches": "Huit tâches finies",
  "zero-relance": "Zéro relance oubliée",
  "rien-bloque": "Rien de bloqué",
  "passations-traitees": "Passations express",
};

/** Faits collectés sur la semaine en cours (agence entière). */
export type QuestFacts = {
  /** Tâches passées à « Terminé » depuis lundi. */
  doneThisWeek: number;
  /** Opportunités ouvertes dont la prochaine action est datée d'avant aujourd'hui. */
  lateFollowUps: number;
  /** Tâches bloquées depuis plus de 48 h. */
  blockedOver48h: number;
  /** Passations répondues cette semaine, dont celles en moins de 24 h. */
  handoffsAnswered: number;
  handoffsAnsweredFast: number;
  /** Passations en attente depuis plus de 24 h. */
  handoffsOverdue: number;
};

export type QuestView = {
  key: QuestKey;
  label: string;
  /** Quête « d'état » : évaluée pour le badge à partir du vendredi 17 h (heure de Paris). */
  state: boolean;
  value: number;
  target: number;
  /** Avancement en % (0–100), pour la barre. */
  percent: number;
  achieved: boolean;
  detail: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function computeQuests(f: QuestFacts): QuestView[] {
  const done = Math.min(f.doneThisWeek, DONE_TARGET);
  const handoffsOk =
    f.handoffsAnswered > 0 && f.handoffsAnsweredFast === f.handoffsAnswered && f.handoffsOverdue === 0;
  const views: Omit<QuestView, "label" | "percent">[] = [
    {
      key: "huit-taches",
      state: false,
      value: done,
      target: DONE_TARGET,
      achieved: f.doneThisWeek >= DONE_TARGET,
      detail: `${f.doneThisWeek}/${DONE_TARGET} tâches terminées cette semaine`,
    },
    {
      key: "zero-relance",
      state: true,
      value: f.lateFollowUps === 0 ? 1 : 0,
      target: 1,
      achieved: f.lateFollowUps === 0,
      detail:
        f.lateFollowUps === 0
          ? "Aucune relance en retard"
          : `${plural(f.lateFollowUps, "relance en retard", "relances en retard")} à traiter`,
    },
    {
      key: "rien-bloque",
      state: true,
      value: f.blockedOver48h === 0 ? 1 : 0,
      target: 1,
      achieved: f.blockedOver48h === 0,
      detail:
        f.blockedOver48h === 0
          ? "Aucune tâche bloquée depuis plus de 48 h"
          : `${plural(f.blockedOver48h, "tâche bloquée", "tâches bloquées")} depuis plus de 48 h`,
    },
    {
      key: "passations-traitees",
      state: true,
      value: f.handoffsAnsweredFast,
      target: Math.max(f.handoffsAnswered, 1),
      achieved: handoffsOk,
      detail:
        f.handoffsAnswered === 0 && f.handoffsOverdue === 0
          ? "Aucune passation traitée cette semaine"
          : `${f.handoffsAnsweredFast}/${f.handoffsAnswered} traitées en moins de 24 h${
              f.handoffsOverdue ? ` · ${f.handoffsOverdue} en attente depuis plus de 24 h` : ""
            }`,
    },
  ];
  return views.map((v) => ({
    ...v,
    label: questLabels[v.key],
    percent: v.achieved ? 100 : Math.round((Math.min(v.value, v.target) / v.target) * 100),
  }));
}

/** Semaine ISO d'une date calendrier (minuit UTC), ex. « 2026-W45 ». */
export function isoWeekPeriod(day: Date): string {
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // jeudi de la même semaine
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Décalage de Paris par rapport à UTC (minutes) à un instant donné. */
export function parisOffsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/** Instant de minuit à Paris pour une date calendrier (minuit UTC). */
export function parisMidnight(day: Date): Date {
  // Le décalage est lu quelques heures après minuit UTC : même jour à Paris, changement d'heure compris.
  const offset = parisOffsetMinutes(new Date(day.getTime() + 3 * 3_600_000));
  return new Date(day.getTime() - offset * 60_000);
}

/** Bornes de la semaine ISO en cours à Paris : lundi 0 h (inclus) → lundi suivant 0 h (exclu). */
export function currentWeek(now: Date) {
  const monday = startOfWeek(todayDate(now));
  return {
    period: isoWeekPeriod(todayDate(now)),
    monday,
    start: parisMidnight(monday),
    end: parisMidnight(addDays(monday, 7)),
  };
}

/** Vendredi 17 h (heure de Paris) ou le week-end : moment où les badges « d'état » sont évalués. */
export function isStateEvaluationTime(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  if (weekday === "Sat" || weekday === "Sun") return true;
  return weekday === "Fri" && hour >= 17;
}

/** Badges mérités à l'instant `now` : le cumul dès qu'il est atteint, les états à partir du vendredi 17 h. */
export function earnedBadges(f: QuestFacts, now: Date): QuestKey[] {
  const stateTime = isStateEvaluationTime(now);
  return computeQuests(f)
    .filter((q) => q.achieved && (!q.state || stateTime))
    .map((q) => q.key);
}
