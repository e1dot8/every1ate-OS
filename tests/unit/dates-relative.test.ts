import { describe, expect, it } from "vitest";
import { formatRelative } from "@/lib/dates";

describe("formatRelative", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("dit « à l'instant » sous une minute", () => {
    expect(formatRelative(ago(20_000), now)).toBe("à l'instant");
  });
  it("compte en minutes, heures puis jours", () => {
    expect(formatRelative(ago(12 * 60_000), now)).toBe("il y a 12 min");
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe("il y a 3 h");
    expect(formatRelative(ago(2 * 86_400_000), now)).toBe("il y a 2 j");
  });
  it("revient à la date au-delà d'une semaine", () => {
    expect(formatRelative(ago(9 * 86_400_000), now)).toBe("19 oct.");
  });
});
