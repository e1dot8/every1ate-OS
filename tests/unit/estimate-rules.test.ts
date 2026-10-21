import { describe, expect, it } from "vitest";
import {
  COMPLEXITY_RANGES,
  MIN_HISTORY_SAMPLES,
  estimateHint,
  isClientTime,
  median,
  remaining,
  variance,
} from "@/features/time/estimate-rules";

describe("écart prévu / réel", () => {
  it("sans estimation, pas d'écart (rien à comparer)", () => {
    expect(variance(null, 120)).toBeNull();
    expect(variance(0, 120)).toBeNull();
  });

  it("calcule l'écart absolu et relatif", () => {
    expect(variance(60, 90)).toMatchObject({ absolute: 30, relative: 0.5, overrun: true });
    expect(variance(120, 90)).toMatchObject({ absolute: -30, relative: -0.25, overrun: false });
  });

  it("un dépassement demande +25 % ET au moins 30 minutes", () => {
    expect(variance(60, 80)?.overrun).toBe(false); // +33 % mais 20 min
    expect(variance(600, 700)?.overrun).toBe(false); // +100 min mais +17 %
    expect(variance(600, 760)?.overrun).toBe(true);
  });
});

describe("temps restant", () => {
  it("préfère la valeur saisie par le responsable", () =>
    expect(remaining({ remainingMinutes: 45, estimatedMinutes: 600, trackedMinutes: 30 })).toBe(45));
  it("sinon estimation moins temps suivi, jamais négatif", () => {
    expect(remaining({ remainingMinutes: null, estimatedMinutes: 120, trackedMinutes: 30 })).toBe(90);
    expect(remaining({ remainingMinutes: null, estimatedMinutes: 60, trackedMinutes: 200 })).toBe(0);
  });
  it("inconnu sans estimation", () =>
    expect(remaining({ remainingMinutes: null, estimatedMinutes: null, trackedMinutes: 30 })).toBeNull());
});

describe("suggestion d'estimation", () => {
  it("médiane classique", () => {
    expect(median([])).toBeNull();
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 41])).toBe(25);
  });

  it("une plage indicative tant que l'historique est trop mince", () => {
    expect(estimateHint("MOYENNE", [100, 200])).toEqual({ kind: "range", ...COMPLEXITY_RANGES.MOYENNE });
  });

  it("la durée observée dès assez de tâches comparables, avec la taille de l'échantillon", () => {
    const samples = [90, 120, 150, 0];
    expect(samples.filter((m) => m > 0).length).toBe(MIN_HISTORY_SAMPLES);
    expect(estimateHint("MOYENNE", samples)).toEqual({ kind: "history", median: 120, samples: 3 });
  });
});

it("seule la catégorie client compte comme temps client", () => {
  expect(isClientTime("CLIENT")).toBe(true);
  expect(isClientTime("AGENCE")).toBe(false);
  expect(isClientTime("BRANDING")).toBe(false);
});
