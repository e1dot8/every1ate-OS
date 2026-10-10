import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import { centsToDecimal, formatMoney, parseMoney, percentOf, toCents } from "@/lib/money";
import {
  DEFAULT_PROBABILITIES,
  STAGES,
  checkStageChange,
  effectiveProbability,
  forecast,
  stageLabels,
} from "@/features/crm/rules";

const d = (s: string) => parseDateInput(s)!;

describe("montants", () => {
  it.each([
    ["1 234,56 €", 123456],
    ["1234.5", 123450],
    ["12 000", 1200000],
    ["0,07", 7],
    ["15 000 €", 1500000],
  ])("parseMoney(%s) = %i", (raw, cents) => expect(parseMoney(raw)).toBe(cents));
  it("rejette négatif, texte et trop de décimales", () => {
    expect(parseMoney("-10")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1,234")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
  it("conversions exactes sans flottant", () => {
    expect(toCents("0.10")).toBe(10);
    expect(toCents("1234.5")).toBe(123450);
    expect(toCents("-3.07")).toBe(-307);
    expect(centsToDecimal(123456)).toBe("1234.56");
    expect(centsToDecimal(5)).toBe("0.05");
    // 0,1 + 0,2 : exact en centimes.
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
  });
  it("pondération arrondie au centime", () => {
    expect(percentOf(1000001, 35)).toBe(350000);
    expect(formatMoney(123456).replace(/\s/g, " ")).toBe("1 234,56 €");
  });
});

describe("pipeline", () => {
  it("contient exactement les 7 étapes dans l'ordre", () => {
    expect(STAGES.map((s) => stageLabels[s])).toEqual([
      "À contacter",
      "Premier échange",
      "Qualification",
      "Proposition envoyée",
      "Négociation",
      "Gagné",
      "Perdu",
    ]);
  });
  it("probabilité : saisie > étape ; gagné 100, perdu 0", () => {
    expect(effectiveProbability("QUALIFICATION", null, DEFAULT_PROBABILITIES)).toBe(35);
    expect(effectiveProbability("QUALIFICATION", 50, DEFAULT_PROBABILITIES)).toBe(50);
    expect(effectiveProbability("GAGNE", 20, DEFAULT_PROBABILITIES)).toBe(100);
    expect(effectiveProbability("PERDU", 90, DEFAULT_PROBABILITIES)).toBe(0);
  });
  it("une opportunité convertie ne quitte plus « Gagné »", () => {
    expect(checkStageChange("GAGNE", "NEGOCIATION", { converted: true }).ok).toBe(false);
    expect(checkStageChange("GAGNE", "NEGOCIATION", { converted: false }).ok).toBe(true);
    expect(checkStageChange("PERDU", "QUALIFICATION", { converted: false }).ok).toBe(true);
  });
});

describe("prévisions", () => {
  const settings = { ...DEFAULT_PROBABILITIES, QUALIFICATION: 40 };
  const opps = [
    {
      id: "a",
      stage: "QUALIFICATION" as const,
      amountCents: 1000000,
      probability: null,
      nextActionDate: d("2026-10-01"),
    },
    {
      id: "b",
      stage: "PROPOSITION_ENVOYEE" as const,
      amountCents: 2000000,
      probability: 60,
      nextActionDate: d("2026-10-20"),
    },
    { id: "c", stage: "GAGNE" as const, amountCents: 500000, probability: null, nextActionDate: null },
    { id: "d", stage: "PERDU" as const, amountCents: 900000, probability: null, nextActionDate: null },
    { id: "e", stage: "A_CONTACTER" as const, amountCents: 0, probability: null, nextActionDate: null },
  ];
  const f = forecast(opps, settings, d("2026-10-12"));
  it("brut et pondéré sur les seules opportunités ouvertes, probabilité configurée", () => {
    expect(f.gross).toBe(3000000);
    expect(f.weighted).toBe(400000 + 1200000);
    expect(f.openCount).toBe(3);
  });
  it("détail par étape, propositions et relances en retard", () => {
    expect(f.byStage.find((s) => s.stage === "QUALIFICATION")).toMatchObject({
      count: 1,
      gross: 1000000,
      weighted: 400000,
    });
    expect(f.proposals).toEqual({ count: 1, gross: 2000000 });
    expect(f.lateIds).toEqual(["a"]);
    expect(f.withoutNextIds).toEqual(["e"]);
    expect(f.won.gross).toBe(500000);
  });
});
