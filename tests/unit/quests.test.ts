import { describe, expect, it } from "vitest";
import { MAX_ACTIVE_QUESTS, QUESTS, questByKey } from "@/features/quests/catalog";
import { canAccept, progressOf, questXpKey } from "@/features/quests/rules";

describe("catalogue des quêtes", () => {
  it("clés uniques, objectifs et récompenses positifs, titres courts", () => {
    expect(new Set(QUESTS.map((q) => q.key)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(q.target).toBeGreaterThan(0);
      expect(q.xp).toBeGreaterThan(0);
      expect(q.title.length).toBeLessThanOrEqual(30);
      expect(q.href.startsWith("/")).toBe(true);
    }
    expect(questByKey("inconnue")).toBeNull();
  });
});

describe("progression", () => {
  it("bornée à 100 %, atteinte au seuil exact", () => {
    expect(progressOf(2, 5)).toEqual({ value: 2, target: 5, percent: 40, reached: false });
    expect(progressOf(5, 5).reached).toBe(true);
    expect(progressOf(9, 5)).toEqual({ value: 9, target: 5, percent: 100, reached: true });
    expect(progressOf(-3, 5).value).toBe(0);
  });
});

describe("acceptation", () => {
  const none: { questKey: string; completedAt: Date | null }[] = [];
  it("refuse un doublon et au-delà du maximum, terminées comprises", () => {
    expect(canAccept("a", none)).toEqual({ ok: true });
    expect(canAccept("a", [{ questKey: "a", completedAt: null }]).ok).toBe(false);
    const full = Array.from({ length: MAX_ACTIVE_QUESTS }, (_, i) => ({
      questKey: `q${i}`,
      completedAt: i === 0 ? new Date() : null,
    }));
    expect(canAccept("x", full).ok).toBe(false);
  });
});

describe("clé d'XP", () => {
  it("une par quête, semaine et associé", () => {
    const week = new Date("2026-10-26T00:00:00Z");
    expect(questXpKey("cinq-taches", week, "u1")).toBe("quest:cinq-taches:2026-10-26:u1");
    expect(questXpKey("cinq-taches", week, "u2")).not.toBe(questXpKey("cinq-taches", week, "u1"));
  });
});
