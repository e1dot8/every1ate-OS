import { describe, expect, it, vi } from "vitest";
import {
  costsInYear,
  gauge,
  invoicedInYear,
  objectiveProgress,
  parseScope,
  parseYear,
  projectsStartedInYear,
  yearChoices,
  yearPace,
  yearRange,
  type YearBilling,
  type YearCost,
} from "@/features/finance/analytics";
import { parseDateInput } from "@/lib/dates";

// Règles pures uniquement : aucune base de données en test unitaire.
vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    throw new Error("Pas de base en test unitaire.");
  },
}));

const d = (s: string) => parseDateInput(s)!;
const today = d("2026-10-14");

const bill = (over: Partial<YearBilling>): YearBilling => ({
  amount: 100000,
  status: "FACTURE",
  invoicedAt: null,
  plannedDate: null,
  paid: 0,
  ...over,
});
const cost = (over: Partial<YearCost>): YearCost => ({
  amount: 10000,
  status: "ENGAGE",
  invoiceDate: null,
  paidAt: null,
  dueDate: null,
  committedAt: null,
  ...over,
});

describe("objectifs : paramètres de la page", () => {
  it("année : AAAA entre 2000 et 2100, sinon l'année par défaut", () => {
    expect(parseYear("2025", 2026)).toBe(2025);
    expect(parseYear(["2024", "2023"], 2026)).toBe(2024);
    expect(parseYear(undefined, 2026)).toBe(2026);
    expect(parseYear("26", 2026)).toBe(2026);
    expect(parseYear("1999", 2026)).toBe(2026);
    expect(parseYear("2025abc", 2026)).toBe(2026);
  });
  it("portée : « tous » sinon « terminés »", () => {
    expect(parseScope("tous")).toBe("tous");
    expect(parseScope("termines")).toBe("termines");
    expect(parseScope("n-importe")).toBe("termines");
    expect(parseScope(undefined)).toBe("termines");
  });
  it("années proposées : 3 précédentes, en cours, suivante, plus l'année affichée", () => {
    expect(yearChoices(2026, 2026)).toEqual([2023, 2024, 2025, 2026, 2027]);
    expect(yearChoices(2026, 2018)).toEqual([2018, 2023, 2024, 2025, 2026, 2027]);
  });
});

describe("objectifs : année calendaire et rythme", () => {
  it("bornes incluses du 1er janvier au 31 décembre", () => {
    expect(yearRange(2026).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-01-01", "2026-12-31"]);
  });
  it("part de l'année écoulée, aujourd'hui compris", () => {
    expect(yearPace(2026, d("2026-01-01"))).toBeCloseTo(1 / 365);
    expect(yearPace(2026, d("2026-12-31"))).toBe(1);
    expect(yearPace(2026, today)).toBeCloseTo(287 / 365);
    expect(yearPace(2028, d("2028-12-31"))).toBe(1); // bissextile : 366 jours
    expect(yearPace(2028, d("2028-02-29"))).toBeCloseTo(60 / 366);
    expect(yearPace(2027, today)).toBe(0); // année à venir
    expect(yearPace(2025, today)).toBe(1); // année passée
  });
});

describe("objectifs : réalisé de l'année", () => {
  it("CA facturé : date de facturation, à défaut date prévue, bornes de l'année", () => {
    const billing = [
      bill({ invoicedAt: d("2026-01-01"), amount: 1 }),
      bill({ invoicedAt: d("2026-12-31"), amount: 10 }),
      bill({ invoicedAt: d("2025-12-31"), amount: 100 }), // année précédente
      bill({ invoicedAt: d("2027-01-01"), amount: 1000 }), // année suivante
      bill({ plannedDate: d("2026-06-01"), amount: 10000 }), // sans date de facturation
      bill({ invoicedAt: d("2025-12-20"), plannedDate: d("2026-01-10"), amount: 100000 }), // facturée en 2025
      bill({ amount: 1000000 }), // aucune date : rattachée à aucune année
    ];
    expect(invoicedInYear(billing, 2026)).toBe(10011);
    expect(invoicedInYear(billing, 2025)).toBe(100100);
  });
  it("CA facturé : ni attendu non encaissé, ni annulé ; une échéance encaissée compte", () => {
    const at = d("2026-03-01");
    expect(
      invoicedInYear(
        [
          bill({ status: "ATTENDU", plannedDate: at, amount: 1 }),
          bill({ status: "ANNULE", invoicedAt: at, amount: 10, paid: 10 }),
          bill({ status: "ATTENDU", plannedDate: at, amount: 100, paid: 50 }),
        ],
        2026,
      ),
    ).toBe(100);
  });
  it("coûts : engagés, reçus ou payés, datés facture > paiement > échéance > engagement", () => {
    const costs = [
      cost({ status: "PREVU", committedAt: d("2026-02-01"), amount: 1 }),
      cost({ status: "ANNULE", invoiceDate: d("2026-02-01"), amount: 10 }),
      cost({ status: "ENGAGE", committedAt: d("2026-02-01"), amount: 100 }),
      cost({ status: "FACTURE", invoiceDate: d("2026-12-31"), committedAt: d("2025-11-01"), amount: 1000 }),
      // Facture de 2025 payée en 2026 : rattachée à 2025 (date de facture d'abord).
      cost({ status: "PAYE", invoiceDate: d("2025-12-31"), paidAt: d("2026-01-05"), amount: 10000 }),
      cost({ status: "PAYE", paidAt: d("2026-01-01"), amount: 100000 }),
      cost({ status: "ENGAGE", dueDate: d("2027-01-01"), committedAt: d("2026-12-01"), amount: 1000000 }),
    ];
    expect(costsInYear(costs, 2026)).toBe(101100);
    expect(costsInYear(costs, 2025)).toBe(10000);
    expect(costsInYear(costs, 2027)).toBe(1000000);
  });
  it("projets démarrés : début, à défaut démarrage réel, à défaut jour de création à Paris", () => {
    const projects = [
      { startDate: d("2026-01-01"), actualStartDate: null, createdAt: new Date("2025-06-01T10:00:00Z") },
      { startDate: d("2025-12-31"), actualStartDate: d("2026-01-02"), createdAt: new Date("2026-01-02T10:00:00Z") },
      { startDate: null, actualStartDate: d("2026-07-01"), createdAt: new Date("2025-06-01T10:00:00Z") },
      // 31 décembre 23 h 30 UTC = 1er janvier à Paris.
      { startDate: null, actualStartDate: null, createdAt: new Date("2025-12-31T23:30:00Z") },
      { startDate: null, actualStartDate: null, createdAt: new Date("2026-12-31T23:30:00Z") },
    ];
    expect(projectsStartedInYear(projects, 2026)).toBe(3);
    expect(projectsStartedInYear(projects, 2025)).toBe(1);
    expect(projectsStartedInYear(projects, 2027)).toBe(1);
    expect(projectsStartedInYear([], 2026)).toBe(0);
  });
});

describe("objectifs : jauges", () => {
  it("pourcentage, barre bornée et position par rapport au rythme", () => {
    expect(gauge(50, 100, 0.4)).toEqual({ value: 50, target: 100, pct: 50, barPct: 50, status: "dans-le-rythme" });
    expect(gauge(30, 100, 0.4).status).toBe("en-retard");
    expect(gauge(130, 100, 0.4)).toMatchObject({ pct: 130, barPct: 100, status: "atteint" });
    expect(gauge(-20, 100, 0.4)).toMatchObject({ pct: -20, barPct: 0, status: "en-retard" });
    expect(gauge(90, 100, 1).status).toBe("non-atteint"); // année écoulée
    expect(gauge(0, 100, 0).status).toBe("dans-le-rythme"); // année pas commencée
  });
  it("sans objectif (absent ou nul) : ni pourcentage ni statut", () => {
    expect(gauge(500, null, 0.5)).toEqual({ value: 500, target: null, pct: null, barPct: 0, status: null });
    expect(gauge(500, 0, 0.5).pct).toBeNull();
  });
  it("données vides et aucun objectif", () => {
    const p = objectiveProgress({ year: 2026, today, objective: null, billing: [], costs: [], projects: [] });
    expect(p.hasObjective).toBe(false);
    expect(p.revenue).toMatchObject({ value: 0, pct: null });
    expect(p.margin).toMatchObject({ value: 0, pct: null });
    expect(p.projects).toMatchObject({ value: 0, pct: null });
  });
  it("marge = CA facturé de l'année − coûts de l'année", () => {
    const p = objectiveProgress({
      year: 2026,
      today,
      objective: { revenue: 1000000, margin: 400000, projectCount: null },
      billing: [bill({ invoicedAt: d("2026-03-01"), amount: 600000 })],
      costs: [cost({ status: "PAYE", paidAt: d("2026-04-01"), amount: 200000 })],
      projects: [{ startDate: d("2026-02-01"), actualStartDate: null, createdAt: new Date() }],
    });
    expect(p.hasObjective).toBe(true);
    expect(p.revenue).toMatchObject({ value: 600000, pct: 60, status: "en-retard" }); // 60 % < 78,6 %
    expect(p.margin).toMatchObject({ value: 400000, pct: 100, status: "atteint" });
    expect(p.projects).toMatchObject({ value: 1, target: null, status: null });
    expect(p.costs).toBe(200000);
  });
});
