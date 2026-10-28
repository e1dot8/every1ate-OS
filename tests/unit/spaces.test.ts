import { describe, expect, it } from "vitest";
import { SPACES } from "@/lib/spaces";

describe("nomenclature des espaces", () => {
  it("chaque espace a un nom fonctionnel distinct de son nom d'univers", () => {
    const labels = Object.values(SPACES).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const s of Object.values(SPACES)) {
      expect(s.label).not.toBe(s.universe);
      expect(s.label.length).toBeLessThanOrEqual(20);
    }
  });
});
