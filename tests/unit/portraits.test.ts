import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("portraitSlug", () => {
  it("prend le prénom, sans accent ni majuscule", async () => {
    const { portraitSlug } = await import("@/features/maison/portraits");
    expect(portraitSlug("Johan Agbovi")).toBe("johan");
    expect(portraitSlug("  Hélène ")).toBe("helene");
    expect(portraitSlug("")).toBe("");
  });
});

describe("textureIndex", () => {
  it("donne le même index pour la même clé, toujours dans la réserve", async () => {
    const { textureIndex } = await import("@/features/maison/assets");
    expect(textureIndex("recette-a")).toBe(textureIndex("recette-a"));
    for (const seed of ["a", "b", "cmh123", "zzz", ""]) {
      const n = textureIndex(seed, 14);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(14);
    }
  });
});
