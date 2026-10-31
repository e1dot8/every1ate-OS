import { describe, expect, it } from "vitest";
import { dayCapacityMinutes, dayLoad, itemLimitError } from "@/features/briefing/rules";

describe("menu de la semaine : limites", () => {
  it("trois objectifs et trois blocages au plus", () => {
    expect(itemLimitError("OBJECTIF", 2)).toBeNull();
    expect(itemLimitError("OBJECTIF", 3)).toMatch(/Trois objectifs/);
    expect(itemLimitError("BLOCAGE", 3)).toMatch(/Trois blocages/);
  });
  it("décisions et actions ne sont pas limitées", () => {
    expect(itemLimitError("DECISION", 12)).toBeNull();
    expect(itemLimitError("ACTION", 40)).toBeNull();
  });
});

describe("mise en place : charge du jour", () => {
  it("capacité du jour = capacité hebdomadaire sur 5 jours", () => {
    expect(dayCapacityMinutes(35)).toBe(420);
    expect(dayCapacityMinutes(0)).toBe(0);
  });
  it("lit la charge sans jugement, avec une sortie quand c'est trop", () => {
    expect(dayLoad(100, 420)).toMatchObject({ tone: "normal", pct: 24 });
    expect(dayLoad(300, 420)).toMatchObject({ tone: "normal", label: "Journée équilibrée" });
    expect(dayLoad(400, 420)).toMatchObject({ tone: "warning" });
    expect(dayLoad(500, 420).label).toMatch(/alléger ou décaler/);
  });
  it("capacité nulle : 0 %, pas de division par zéro", () => expect(dayLoad(60, 0).pct).toBe(0));
});
