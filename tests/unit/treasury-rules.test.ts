import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import { cashForecast } from "@/features/finance/cash";
import {
  billingInflows,
  chargeIssue,
  chargeNextDate,
  chargeOutflows,
  chargesMonthlyTotal,
  chartGeometry,
  chartSummary,
  contractInflows,
  costOutflows,
  itemKind,
  monthlyEquivalent,
  parseSignedMoney,
  treasuryForecast,
  type BillingRow,
  type ChargeRow,
  type ContractRow,
  type CostRow,
} from "@/features/finance/treasury-rules";

const d = (s: string) => parseDateInput(s)!;
const iso = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const today = d("2026-10-14"); // mercredi ; semaine 1 = 12 → 18 oct.

const billing = (over: Partial<BillingRow>): BillingRow => ({
  id: "b1",
  label: "Acompte",
  projectName: "Campagne",
  amount: 1_000_000,
  status: "FACTURE",
  plannedDate: d("2026-11-02"),
  invoicedAt: null,
  paid: 0,
  ...over,
});
const cost = (over: Partial<CostRow>): CostRow => ({
  id: "c1",
  description: "Location studio",
  supplier: "Studio Lux",
  projectName: "Campagne",
  amount: 300_000,
  status: "ENGAGE",
  dueDate: d("2026-10-20"),
  invoiceDate: null,
  ...over,
});

describe("encaissements attendus (échéances − encaissements)", () => {
  it("compte le reste à encaisser et ignore les échéances soldées ou annulées", () => {
    const items = billingInflows([
      billing({ id: "partiel", paid: 400_000 }),
      billing({ id: "solde", paid: 1_000_000 }),
      billing({ id: "trop-percu", paid: 1_200_000 }),
      billing({ id: "annule", status: "ANNULE" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      amount: 600_000,
      href: "/finance/echeances/partiel",
      label: "Acompte · Campagne",
    });
    expect(iso(items[0].date)).toBe("2026-11-02");
  });

  it("date prévue, sinon facture + 30 jours, sinon sans date", () => {
    const [planned, invoiced, undated] = billingInflows([
      billing({ id: "a", plannedDate: d("2026-12-01"), invoicedAt: d("2026-10-01") }),
      billing({ id: "b", plannedDate: null, invoicedAt: d("2026-10-01") }),
      billing({ id: "c", plannedDate: null, invoicedAt: null, status: "ATTENDU" }),
    ]);
    expect(iso(planned.date)).toBe("2026-12-01");
    expect(iso(invoiced.date)).toBe("2026-10-31");
    expect(undated.date).toBeNull();
  });
});

describe("décaissements (coûts non payés)", () => {
  it("seuls les coûts engagés ou reçus comptent", () => {
    const items = costOutflows([
      cost({ id: "engage" }),
      cost({ id: "recu", status: "FACTURE", dueDate: null, invoiceDate: d("2026-10-10") }),
      cost({ id: "prevu", status: "PREVU" }),
      cost({ id: "paye", status: "PAYE" }),
      cost({ id: "annule", status: "ANNULE" }),
      cost({ id: "sans-date", supplier: null, dueDate: null }),
    ]);
    expect(items.map((i) => i.href)).toEqual([
      "/finance/couts/engage",
      "/finance/couts/recu",
      "/finance/couts/sans-date",
    ]);
    expect(items[0].label).toBe("Studio Lux — Location studio · Campagne");
    expect(iso(items[1].date)).toBe("2026-11-09");
    expect(items[2]).toMatchObject({ date: null, label: "Location studio · Campagne" });
  });
});

describe("contrats et charges : même règle que cash.ts, avec lien vers la fiche", () => {
  const contracts: ContractRow[] = [
    {
      id: "k1",
      label: "CM",
      monthlyAmount: 150_000,
      startDate: d("2026-01-05"),
      endDate: null,
      status: "ACTIF",
    },
    {
      id: "k2",
      label: "Fin proche",
      monthlyAmount: 90_000,
      startDate: d("2026-03-20"),
      endDate: d("2026-11-30"),
      status: "ACTIF",
    },
    {
      id: "k3",
      label: "Suspendu",
      monthlyAmount: 50_000,
      startDate: d("2026-01-01"),
      endDate: null,
      status: "SUSPENDU",
    },
  ];
  const charges: ChargeRow[] = [
    {
      id: "ch1",
      label: "Loyer",
      amount: 250_000,
      frequency: "MENSUELLE",
      nextDate: d("2026-08-01"),
      endDate: null,
    },
    {
      id: "ch2",
      label: "Assurance",
      amount: 120_000,
      frequency: "TRIMESTRIELLE",
      nextDate: d("2026-11-15"),
      endDate: null,
    },
    {
      id: "ch3",
      label: "Logiciel",
      amount: 60_000,
      frequency: "ANNUELLE",
      nextDate: d("2027-03-01"),
      endDate: null,
    },
  ];

  it("totaux et répartition par semaine identiques au calcul intégré de cash.ts", () => {
    const reference = cashForecast({ today, startBalance: 0, inflows: [], outflows: [], contracts, charges });
    const linked = cashForecast({
      today,
      startBalance: 0,
      inflows: contractInflows(contracts, today),
      outflows: chargeOutflows(charges, today),
      contracts: [],
      charges: [],
    });
    expect(linked.weeks.map((w) => [w.inflow, w.outflow])).toEqual(
      reference.weeks.map((w) => [w.inflow, w.outflow]),
    );
    // Loyer : 1er nov., 1er déc., 1er janv. ; assurance : 15 nov. ; logiciel : hors horizon.
    expect(linked.totalOut).toBe(3 * 250_000 + 120_000);
    // CM : 5 nov., 5 déc., 5 janv. ; « Fin proche » : 20 oct., 20 nov. ; suspendu exclu.
    expect(linked.totalIn).toBe(3 * 150_000 + 2 * 90_000);
  });

  it("chaque occurrence pointe vers sa fiche", () => {
    expect(new Set(chargeOutflows(charges, today).map((i) => i.href))).toEqual(
      new Set(["/finance/tresorerie/charges/ch1", "/finance/tresorerie/charges/ch2"]),
    );
    expect(new Set(contractInflows(contracts, today).map((i) => i.href))).toEqual(
      new Set(["/finance/contrats/k1", "/finance/contrats/k2"]),
    );
  });
});

describe("prévision complète", () => {
  const f = treasuryForecast({
    today,
    startBalance: 500_000,
    billing: [
      billing({ id: "retard", plannedDate: d("2026-09-15"), amount: 200_000 }),
      billing({ id: "sans-date", plannedDate: null, invoicedAt: null, status: "ATTENDU" }),
    ],
    costs: [cost({ id: "studio", dueDate: d("2026-10-27"), amount: 900_000 })],
    contracts: [],
    charges: [
      {
        id: "loyer",
        label: "Loyer",
        amount: 100_000,
        frequency: "MENSUELLE",
        nextDate: d("2026-11-01"),
        endDate: null,
      },
    ],
  });

  it("le retard tombe en semaine 1 avec son lien ; le non daté est mis à part", () => {
    expect(f.weeks).toHaveLength(13);
    expect(iso(f.weeks[0].start)).toBe("2026-10-12");
    expect(f.weeks[0].inflow).toBe(200_000);
    expect(f.weeks[0].items[0]).toMatchObject({ late: true, href: "/finance/echeances/retard" });
    expect(f.undated.map((u) => u.href)).toEqual(["/finance/echeances/sans-date"]);
  });

  it("soldes, point bas et semaines négatives", () => {
    expect(f.totalIn).toBe(200_000);
    expect(f.totalOut).toBe(900_000 + 3 * 100_000);
    // Semaine 3 (26 oct. → 1er nov.) : coût du 27 oct. et loyer du 1er nov.
    expect(f.weeks[1].balance).toBe(500_000 + 200_000);
    expect(f.weeks[2].balance).toBe(500_000 + 200_000 - 900_000 - 100_000);
    expect(f.endBalance).toBe(500_000 + 200_000 - 1_200_000);
    expect(f.lowest.balance).toBe(f.endBalance);
    expect(f.negativeWeeks).toBe(11);
  });

  it("sans solde saisi, les soldes sont relatifs", () => {
    const rel = treasuryForecast({
      today,
      startBalance: null,
      billing: [],
      costs: [],
      contracts: [],
      charges: [],
    });
    expect(rel.hasStartBalance).toBe(false);
    expect(rel.endBalance).toBe(0);
  });
});

describe("charges fixes", () => {
  it("prochaine échéance à partir d'aujourd'hui, ancrée sur la date saisie", () => {
    expect(
      iso(chargeNextDate({ nextDate: d("2026-01-31"), endDate: null, frequency: "MENSUELLE" }, today)),
    ).toBe("2026-10-31");
    expect(
      iso(chargeNextDate({ nextDate: d("2026-01-31"), endDate: null, frequency: "TRIMESTRIELLE" }, today)),
    ).toBe("2026-10-31");
    expect(
      iso(chargeNextDate({ nextDate: d("2026-10-14"), endDate: null, frequency: "ANNUELLE" }, today)),
    ).toBe("2026-10-14");
    expect(
      chargeNextDate({ nextDate: d("2026-01-05"), endDate: d("2026-10-01"), frequency: "MENSUELLE" }, today),
    ).toBeNull();
  });

  it("équivalent mensuel et total des charges en cours", () => {
    expect(monthlyEquivalent(120_000, "ANNUELLE")).toBe(10_000);
    expect(monthlyEquivalent(100_000, "TRIMESTRIELLE")).toBe(33_333);
    expect(monthlyEquivalent(250_000, "MENSUELLE")).toBe(250_000);
    expect(
      chargesMonthlyTotal(
        [
          { amount: 250_000, frequency: "MENSUELLE", nextDate: d("2026-11-01"), endDate: null },
          { amount: 120_000, frequency: "ANNUELLE", nextDate: d("2027-01-01"), endDate: null },
          { amount: 999_999, frequency: "MENSUELLE", nextDate: d("2026-01-01"), endDate: d("2026-06-30") },
        ],
        today,
      ),
    ).toBe(260_000);
  });

  it("montant positif et fin postérieure à la prochaine échéance", () => {
    expect(chargeIssue({ amount: 0, nextDate: today, endDate: null })).toMatch(/supérieur à 0/);
    expect(chargeIssue({ amount: 100, nextDate: today, endDate: d("2026-10-13") })).toMatch(/précéder/);
    expect(chargeIssue({ amount: 100, nextDate: today, endDate: today })).toBeNull();
  });
});

describe("solde bancaire saisi", () => {
  it("accepte un découvert (signe moins) et refuse l'illisible", () => {
    expect(parseSignedMoney("24 500,00")).toBe(2_450_000);
    expect(parseSignedMoney("-1 200,50")).toBe(-120_050);
    expect(parseSignedMoney("− 300")).toBe(-30_000);
    expect(parseSignedMoney("-0")).toBe(0);
    expect(parseSignedMoney("douze")).toBeNull();
    expect(parseSignedMoney("--5")).toBeNull();
    expect(parseSignedMoney("")).toBeNull();
  });
});

describe("graphique", () => {
  it("ligne zéro et barres proportionnelles", () => {
    const g = chartGeometry([
      { inflow: 100, outflow: 0, balance: 300 },
      { inflow: 0, outflow: 400, balance: -100 },
    ]);
    expect(g.zeroPct).toBe(25);
    expect(g.bars[0]).toEqual({ inflowPct: 25, outflowPct: 0, balancePct: 75, negative: false });
    expect(g.bars[1]).toEqual({ inflowPct: 0, outflowPct: 100, balancePct: 25, negative: true });
    expect(chartGeometry([{ inflow: 0, outflow: 0, balance: 0 }]).bars[0].balancePct).toBe(0);
  });

  it("résumé accessible", () => {
    const f = treasuryForecast({
      today,
      startBalance: 100_000,
      billing: [],
      costs: [cost({ dueDate: d("2026-10-21"), amount: 300_000 })],
      contracts: [],
      charges: [],
    });
    const text = chartSummary(
      f,
      (c) => `${c / 100} €`,
      (x) => iso(x)!,
    );
    expect(text).toBe(
      "Prévision de trésorerie sur 13 semaines à partir du 2026-10-12 ; solde de départ 1000 € ; " +
        "encaissements 0 €, décaissements 3000 € ; point bas -2000 € la semaine du 2026-10-19 ; " +
        "solde en fin de période -2000 € ; 12 semaines sous zéro.",
    );
    // Les dates abrégées finissent par un point : pas de « .. » dans le résumé.
    expect(chartSummary(f, String, () => "12 oct.")).not.toContain("..");
    const rel = treasuryForecast({
      today,
      startBalance: null,
      billing: [],
      costs: [],
      contracts: [],
      charges: [],
    });
    expect(chartSummary(rel, String, iso as (x: Date) => string)).toContain("aucun solde de départ saisi");
  });

  it("nature d'un élément d'après son lien", () => {
    expect(itemKind("/finance/echeances/x")).toBe("echeance");
    expect(itemKind("/finance/couts/x")).toBe("cout");
    expect(itemKind("/finance/contrats/x")).toBe("contrat");
    expect(itemKind("/finance/tresorerie/charges/x")).toBe("charge");
    expect(itemKind(undefined)).toBeNull();
  });
});
