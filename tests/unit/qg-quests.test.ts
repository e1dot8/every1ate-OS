import { describe, expect, it } from "vitest";
import {
  computeQuests,
  currentWeek,
  earnedBadges,
  isStateEvaluationTime,
  isoWeekPeriod,
  parisMidnight,
  type QuestFacts,
} from "@/features/qg/quests";
import { parseDateInput } from "@/lib/dates";

const day = (s: string) => parseDateInput(s)!;

const calm: QuestFacts = {
  doneThisWeek: 8,
  lateFollowUps: 0,
  blockedOver48h: 0,
  handoffsAnswered: 2,
  handoffsAnsweredFast: 2,
  handoffsOverdue: 0,
};

describe("période ISO", () => {
  it("numérote les semaines ISO", () => {
    expect(isoWeekPeriod(day("2026-11-04"))).toBe("2026-W45");
    expect(isoWeekPeriod(day("2026-11-02"))).toBe("2026-W45"); // lundi
    expect(isoWeekPeriod(day("2026-11-08"))).toBe("2026-W45"); // dimanche
    expect(isoWeekPeriod(day("2026-11-09"))).toBe("2026-W46");
  });

  it("gère les semaines à cheval sur deux années", () => {
    expect(isoWeekPeriod(day("2026-01-01"))).toBe("2026-W01"); // jeudi
    expect(isoWeekPeriod(day("2027-01-01"))).toBe("2026-W53"); // vendredi
    expect(isoWeekPeriod(day("2025-12-29"))).toBe("2026-W01"); // lundi
    expect(isoWeekPeriod(day("2021-01-03"))).toBe("2020-W53");
  });

  it("calcule la semaine en heure de Paris", () => {
    // Dimanche 8 nov. 23 h 30 à Paris = 22 h 30 UTC : encore la semaine 45.
    expect(currentWeek(new Date("2026-11-08T22:30:00Z")).period).toBe("2026-W45");
    // Lundi 9 nov. 0 h 30 à Paris = dimanche 23 h 30 UTC : semaine 46.
    expect(currentWeek(new Date("2026-11-08T23:30:00Z")).period).toBe("2026-W46");
  });

  it("minuit à Paris selon l'heure d'hiver ou d'été", () => {
    expect(parisMidnight(day("2026-11-02")).toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(parisMidnight(day("2026-07-06")).toISOString()).toBe("2026-07-05T22:00:00.000Z");
    const w = currentWeek(new Date("2026-11-04T10:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });
});

describe("quêtes de la semaine (collectives)", () => {
  it("compte les tâches terminées jusqu'à 8", () => {
    const q = computeQuests({ ...calm, doneThisWeek: 3 }).find((x) => x.key === "huit-taches")!;
    expect(q.achieved).toBe(false);
    expect(q.percent).toBe(38);
    expect(q.detail).toBe("3/8 tâches terminées cette semaine");
    const full = computeQuests({ ...calm, doneThisWeek: 12 }).find((x) => x.key === "huit-taches")!;
    expect(full.achieved).toBe(true);
    expect(full.percent).toBe(100);
  });

  it("zéro relance en retard et rien de bloqué depuis 48 h", () => {
    const quests = computeQuests({ ...calm, lateFollowUps: 2, blockedOver48h: 1 });
    expect(quests.find((x) => x.key === "zero-relance")!.achieved).toBe(false);
    expect(quests.find((x) => x.key === "zero-relance")!.detail).toMatch(/2 relances en retard/);
    expect(quests.find((x) => x.key === "rien-bloque")!.achieved).toBe(false);
    expect(computeQuests(calm).every((x) => x.achieved)).toBe(true);
  });

  it("passations : toutes traitées en moins de 24 h, et au moins une", () => {
    const pass = (f: Partial<QuestFacts>) =>
      computeQuests({ ...calm, ...f }).find((x) => x.key === "passations-traitees")!;
    expect(pass({}).achieved).toBe(true);
    expect(pass({ handoffsAnsweredFast: 1 }).achieved).toBe(false);
    expect(pass({ handoffsOverdue: 1 }).achieved).toBe(false);
    expect(pass({ handoffsAnswered: 0, handoffsAnsweredFast: 0 }).achieved).toBe(false);
  });

  it("aucune quête n'est individuelle", () => {
    for (const q of computeQuests(calm)) expect(q.label).not.toMatch(/Johan|Charles|Pierre/);
  });
});

describe("badges d'équipe", () => {
  const wednesday = new Date("2026-11-04T10:00:00Z");
  const friday16 = new Date("2026-11-06T15:30:00Z"); // 16 h 30 à Paris
  const friday17 = new Date("2026-11-06T16:00:00Z"); // 17 h à Paris
  const sunday = new Date("2026-11-08T12:00:00Z");

  it("évalue les badges d'état à partir du vendredi 17 h (Paris)", () => {
    expect(isStateEvaluationTime(wednesday)).toBe(false);
    expect(isStateEvaluationTime(friday16)).toBe(false);
    expect(isStateEvaluationTime(friday17)).toBe(true);
    expect(isStateEvaluationTime(sunday)).toBe(true);
  });

  it("le cumul est gagné dès qu'il est atteint, les états seulement le vendredi soir", () => {
    expect(earnedBadges(calm, wednesday)).toEqual(["huit-taches"]);
    expect(earnedBadges(calm, friday17)).toEqual([
      "huit-taches",
      "zero-relance",
      "rien-bloque",
      "passations-traitees",
    ]);
    expect(earnedBadges({ ...calm, doneThisWeek: 2, lateFollowUps: 1 }, friday17)).toEqual([
      "rien-bloque",
      "passations-traitees",
    ]);
  });
});
