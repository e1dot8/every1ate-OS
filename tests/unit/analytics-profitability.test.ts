import { describe, expect, it, vi } from "vitest";
import {
  closedOn,
  groupProfitability,
  inScope,
  templateLabel,
  totalProfitability,
  type ProfitInput,
  type ScopedProject,
} from "@/features/finance/analytics";
import { parseDateInput } from "@/lib/dates";

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    throw new Error("Pas de base en test unitaire.");
  },
}));

const d = (s: string) => parseDateInput(s)!;

const project = (over: Partial<ScopedProject>): ScopedProject => ({
  status: "ACTIF",
  closedAt: null,
  actualEndDate: null,
  startDate: null,
  actualStartDate: null,
  createdAt: new Date("2026-01-15T09:00:00Z"),
  ...over,
});

const row = (over: Partial<ProfitInput> & { key: string }): ProfitInput => ({
  label: over.key,
  revenue: 0,
  costs: 0,
  timeCost: null,
  minutes: 0,
  satisfaction: null,
  ...over,
});

describe("rentabilité : projets retenus", () => {
  it("clôture : jour de Paris pour un projet terminé ou archivé, rien pour un projet rouvert", () => {
    // 31 décembre 23 h 30 UTC : clôturé le 1er janvier à Paris.
    expect(closedOn(project({ status: "TERMINE", closedAt: new Date("2025-12-31T23:30:00Z") }))).toEqual(
      d("2026-01-01"),
    );
    expect(closedOn(project({ status: "ARCHIVE", closedAt: new Date("2026-03-01T10:00:00Z") }))).toEqual(
      d("2026-03-01"),
    );
    expect(closedOn(project({ status: "TERMINE", actualEndDate: d("2026-05-02") }))).toEqual(d("2026-05-02"));
    expect(closedOn(project({ status: "ACTIF", closedAt: new Date("2026-03-01T10:00:00Z") }))).toBeNull();
  });

  it("« terminés » : clôturés dans l'année, bornes comprises", () => {
    const closedNewYear = project({ status: "TERMINE", closedAt: new Date("2025-12-31T23:30:00Z") });
    const closedNewYearsEve = project({ status: "TERMINE", closedAt: new Date("2026-12-31T22:00:00Z") });
    expect(inScope(closedNewYear, 2026, "termines")).toBe(true);
    expect(inScope(closedNewYear, 2025, "termines")).toBe(false);
    expect(inScope(closedNewYearsEve, 2026, "termines")).toBe(true);
    expect(inScope(project({ startDate: d("2026-02-01") }), 2026, "termines")).toBe(false);
  });

  it("« tous » : en plus, les projets en cours démarrés au plus tard dans l'année", () => {
    expect(inScope(project({ startDate: d("2026-12-31") }), 2026, "tous")).toBe(true);
    expect(inScope(project({ startDate: d("2024-03-01") }), 2026, "tous")).toBe(true);
    expect(inScope(project({ startDate: d("2027-01-01") }), 2026, "tous")).toBe(false);
    // Sans date de début : jour de création.
    expect(inScope(project({}), 2026, "tous")).toBe(true);
    expect(inScope(project({}), 2025, "tous")).toBe(false);
    // Clôturé une autre année : n'est plus « en cours ».
    expect(inScope(project({ status: "TERMINE", closedAt: new Date("2025-06-01T10:00:00Z") }), 2026, "tous")).toBe(
      false,
    );
    // Archivé sans clôture : rattaché à aucune année.
    expect(inScope(project({ status: "ARCHIVE", startDate: d("2026-02-01") }), 2026, "tous")).toBe(false);
  });
});

describe("rentabilité : regroupement", () => {
  it("additionne, calcule marge et taux, trie par marge décroissante", () => {
    const r = groupProfitability([
      row({ key: "clip", label: "Clip", revenue: 100000, costs: 40000, minutes: 120 }),
      row({ key: "clip", label: "Clip", revenue: 100000, costs: 60000, minutes: 30 }),
      row({ key: "conseil", label: "Conseil", revenue: 200000, costs: 20000 }),
      row({ key: "perte", label: "Perte", revenue: 0, costs: 5000 }),
    ]);
    expect(r.map((x) => [x.key, x.projects, x.revenue, x.costs, x.margin, x.marginRate, x.minutes])).toEqual([
      ["conseil", 1, 200000, 20000, 180000, 90, 0],
      ["clip", 2, 200000, 100000, 100000, 50, 150],
      ["perte", 1, 0, 5000, -5000, null, 0],
    ]);
  });

  it("marge après temps seulement si le temps de tous les projets du groupe est valorisé", () => {
    const [valued, partial] = groupProfitability([
      row({ key: "a", revenue: 100000, costs: 20000, timeCost: 30000 }),
      row({ key: "a", revenue: 100000, costs: 20000, timeCost: 10000 }),
      row({ key: "b", revenue: 50000, costs: 0, timeCost: 1000 }),
      row({ key: "b", revenue: 50000, costs: 0, timeCost: null }),
    ]);
    expect(valued).toMatchObject({ key: "a", margin: 160000, marginAfterTime: 120000, marginAfterTimeRate: 60 });
    expect(partial).toMatchObject({ key: "b", margin: 100000, marginAfterTime: null, marginAfterTimeRate: null });
  });

  it("satisfaction moyenne sur les seules notes renseignées (une décimale)", () => {
    const [g] = groupProfitability([
      row({ key: "c", satisfaction: 5 }),
      row({ key: "c", satisfaction: 4 }),
      row({ key: "c", satisfaction: 4 }),
      row({ key: "c", satisfaction: null }),
    ]);
    expect(g).toMatchObject({ satisfaction: 4.3, ratings: 3, projects: 4 });
    expect(groupProfitability([row({ key: "x" })])[0]).toMatchObject({ satisfaction: null, ratings: 0 });
  });

  it("à marge égale, ordre alphabétique ; aucun projet : tableau vide et pas de total", () => {
    const r = groupProfitability([
      row({ key: "z", label: "Zèbre", revenue: 10 }),
      row({ key: "a", label: "Abeille", revenue: 10 }),
    ]);
    expect(r.map((x) => x.label)).toEqual(["Abeille", "Zèbre"]);
    expect(groupProfitability([])).toEqual([]);
    expect(totalProfitability([])).toBeNull();
  });

  it("total : tous les projets, quel que soit le groupe", () => {
    const t = totalProfitability([
      row({ key: "a", revenue: 100000, costs: 30000, timeCost: 0, minutes: 60, satisfaction: 3 }),
      row({ key: "b", revenue: 50000, costs: 10000, timeCost: 5000, minutes: 30, satisfaction: 5 }),
    ]);
    expect(t).toMatchObject({
      key: "total",
      label: "Total",
      projects: 2,
      revenue: 150000,
      margin: 110000,
      marginAfterTime: 105000,
      satisfaction: 4,
      minutes: 90,
    });
  });

  it("libellé du modèle : nom du modèle connu, clé inconnue telle quelle, « Sans modèle »", () => {
    expect(templateLabel("campagne-creative")).toBe("Campagne créative");
    expect(templateLabel("ancien-modele")).toBe("ancien-modele");
    expect(templateLabel(null)).toBe("Sans modèle");
  });
});
