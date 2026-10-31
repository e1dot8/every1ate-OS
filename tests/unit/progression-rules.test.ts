import { describe, expect, it } from "vitest";
import { DAILY_TASK_XP_CAP, RANKS, TASK_XP, xpForLevel } from "@/features/progression/config";
import { levelFor, levelInfo, levelUp, rankFor, taskCompletionXp } from "@/features/progression/rules";

describe("paliers de niveau", () => {
  it("suivent le barème central, sans trou ni recul", () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(xpForLevel)).toEqual([0, 100, 250, 450, 700, 2700, 10450]);
    for (let l = 1; l < 40; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });

  it("un total exactement au seuil donne le niveau du seuil", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(249)).toBe(2);
    expect(levelFor(250)).toBe(3);
  });

  it("un total négatif (corrections) reste au niveau 1", () => {
    expect(levelInfo(-40)).toMatchObject({ xp: 0, level: 1, intoLevel: 0, percent: 0 });
  });

  it("calcule la progression dans le niveau courant", () => {
    expect(levelInfo(175)).toMatchObject({
      level: 2,
      intoLevel: 75,
      levelSpan: 150,
      toNext: 75,
      percent: 50,
    });
  });
});

describe("rangs", () => {
  it("sont attribués par niveau, le premier dès le niveau 1", () => {
    expect(RANKS[0].fromLevel).toBe(1);
    expect(rankFor(1).title).toBe("Apprenti");
    expect(rankFor(4).title).toBe("Apprenti");
    expect(rankFor(5).title).toBe("Commis");
    expect(rankFor(10).title).toBe("Chef de partie");
    expect(rankFor(99).title).toBe("Chef exécutif");
  });

  it("annonce le prochain rang, et aucun au dernier", () => {
    expect(levelInfo(0).nextRank?.title).toBe("Commis");
    expect(levelInfo(xpForLevel(25)).nextRank).toBeNull();
  });

  it("détecte un passage de niveau et un nouveau rang", () => {
    expect(levelUp(90, 110)).toEqual({ level: 2, newRank: null });
    expect(levelUp(690, 710)?.newRank?.title).toBe("Commis");
    expect(levelUp(110, 120)).toBeNull();
    expect(levelUp(120, 100)).toBeNull();
  });
});

describe("XP d'une tâche terminée", () => {
  it("dépend de la complexité choisie, jamais du temps passé", () => {
    expect(taskCompletionXp("SIMPLE", 0).amount).toBe(TASK_XP.SIMPLE);
    expect(taskCompletionXp("MOYENNE", 0).amount).toBe(TASK_XP.MOYENNE);
    expect(taskCompletionXp("COMPLEXE", 0).amount).toBe(TASK_XP.COMPLEXE);
  });

  it("une tâche sans complexité compte comme simple et le dit", () => {
    const xp = taskCompletionXp(null, 0);
    expect(xp.amount).toBe(TASK_XP.SIMPLE);
    expect(xp.label).toMatch(/non précisée/);
  });

  it("le plafond quotidien empêche de gagner plus en découpant", () => {
    const nearly = taskCompletionXp("COMPLEXE", DAILY_TASK_XP_CAP - 20);
    expect(nearly).toMatchObject({ amount: 20, capped: true });
    expect(nearly.label).toMatch(/plafond/);
    expect(taskCompletionXp("SIMPLE", DAILY_TASK_XP_CAP)).toMatchObject({ amount: 0, capped: true });
    expect(taskCompletionXp("SIMPLE", DAILY_TASK_XP_CAP + 500).amount).toBe(0);
  });
});
