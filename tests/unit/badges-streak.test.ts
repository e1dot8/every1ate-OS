import { describe, expect, it } from "vitest";
import {
  BADGES,
  PEER_BADGES,
  accurate,
  accurateStreak,
  newlyEarned,
  type BadgeStats,
} from "@/features/badges/catalog";
import { weeklyStreak } from "@/features/badges/streak";
import { houseProgress } from "@/features/brigade/house";
import { SKILLS, suggestedLevel } from "@/features/skills/tree";
import { addDays, parseDateInput } from "@/lib/dates";

const zero: BadgeStats = {
  tasksDone: 0,
  categoriesDone: 0,
  agencyTasksDone: 0,
  brandingTasksDone: 0,
  projectsDelivered: 0,
  fiveStarProjects: 0,
  rescuedTasks: 0,
  accurateStreak: 0,
  briefings: 0,
  recipesReused: 0,
};

describe("badges", () => {
  it("rien sans travail réel", () => expect(newlyEarned(zero, new Set())).toEqual([]));

  it("la première tâche terminée donne « La première commande », une seule fois", () => {
    const earned = newlyEarned({ ...zero, tasksDone: 1 }, new Set());
    expect(earned.map((b) => b.key)).toEqual(["premiere-commande"]);
    expect(newlyEarned({ ...zero, tasksDone: 9 }, new Set(["premiere-commande"]))).toEqual([]);
  });

  it("couteau suisse, service complet et œil du chef suivent leurs seuils", () => {
    const keys = newlyEarned(
      { ...zero, tasksDone: 20, categoriesDone: 4, projectsDelivered: 3, accurateStreak: 5 },
      new Set(),
    ).map((b) => b.key);
    expect(keys).toEqual(
      expect.arrayContaining(["couteau-suisse", "service-complet", "premier-service", "oeil-du-chef"]),
    );
  });

  it("les badges de reconnaissance ne se gagnent jamais automatiquement", () => {
    expect(PEER_BADGES.length).toBeGreaterThan(0);
    const all = {
      ...zero,
      tasksDone: 999,
      categoriesDone: 7,
      projectsDelivered: 99,
      fiveStarProjects: 9,
      rescuedTasks: 9,
      accurateStreak: 9,
      briefings: 99,
      agencyTasksDone: 99,
      brandingTasksDone: 99,
      recipesReused: 9,
    };
    const keys = newlyEarned(all, new Set()).map((b) => b.key);
    for (const p of PEER_BADGES) expect(keys).not.toContain(p.key);
  });

  it("clés uniques", () => expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length));

  it("estimation juste à ±15 %, série depuis la plus récente", () => {
    expect(accurate(100, 115)).toBe(true);
    expect(accurate(100, 116)).toBe(false);
    expect(
      accurateStreak([
        { estimated: 60, actual: 62 },
        { estimated: 60, actual: 55 },
        { estimated: 60, actual: 200 },
        { estimated: 60, actual: 60 },
      ]),
    ).toBe(2);
  });
});

describe("série de régularité (par semaine)", () => {
  const monday = parseDateInput("2026-10-19")!;
  const days = (weekStart: Date, n: number) => Array.from({ length: n }, (_, i) => addDays(weekStart, i));

  it("la semaine en cours ne casse jamais la série", () => {
    const s = weeklyStreak({
      activeDays: [...days(addDays(monday, -7), 3), ...days(addDays(monday, -14), 4)],
      pausedWeeks: [],
      currentWeek: monday,
      required: 3,
    });
    expect(s).toMatchObject({ weeks: 2, currentDays: 0, currentDone: false });
  });

  it("une semaine en pause (congés) ne compte pas et ne casse rien", () => {
    const s = weeklyStreak({
      activeDays: [...days(monday, 3), ...days(addDays(monday, -14), 3)],
      pausedWeeks: [addDays(monday, -7)],
      currentWeek: monday,
      required: 3,
    });
    expect(s.weeks).toBe(2);
  });

  it("une semaine sans assez de jours actifs arrête la série", () => {
    const s = weeklyStreak({
      activeDays: [...days(monday, 3), ...days(addDays(monday, -7), 1), ...days(addDays(monday, -14), 5)],
      pausedWeeks: [],
      currentWeek: monday,
      required: 3,
    });
    expect(s.weeks).toBe(1);
  });

  it("plusieurs actions le même jour = un seul jour actif", () => {
    const s = weeklyStreak({
      activeDays: [monday, monday, monday],
      pausedWeeks: [],
      currentWeek: monday,
      required: 2,
    });
    expect(s).toMatchObject({ currentDays: 1, currentDone: false, weeks: 0 });
  });
});

describe("progression de la maison et compétences", () => {
  it("paliers collectifs", () => {
    expect(houseProgress(0, 0)).toMatchObject({ points: 0, reached: 0, next: 1, percent: 0 });
    expect(houseProgress(3, 4)).toMatchObject({ points: 7, reached: 2, next: 10, percent: 40 });
    expect(houseProgress(80, 30).next).toBeNull();
  });

  it("le niveau suggéré dépend des preuves, jamais du nombre de tâches", () => {
    expect(suggestedLevel(0, 0)).toBe(1);
    expect(suggestedLevel(1, 0)).toBe(2);
    expect(suggestedLevel(2, 1)).toBe(3);
    expect(suggestedLevel(4, 2)).toBe(4);
  });

  it("six branches, clés de compétence uniques", () => {
    expect(new Set(SKILLS.map((s) => s.branch.key)).size).toBe(6);
    expect(new Set(SKILLS.map((s) => s.key)).size).toBe(SKILLS.length);
  });
});
