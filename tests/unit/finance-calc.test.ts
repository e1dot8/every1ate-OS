import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import {
  billingState,
  budgetRuleTriggered,
  delayRuleTriggered,
  marginRate,
  mrr,
  summarize,
  tally,
} from "@/features/finance/calc";

const d = (s: string) => parseDateInput(s)!;
const today = d("2026-10-12");

describe("synthèse financière", () => {
  const base = {
    budget: { revenue: 5000000, cost: 3000000 },
    initial: { revenue: 5000000, cost: 2800000 },
    today,
  };

  it("un coût engagé pèse sur la marge prévisionnelle avant paiement", () => {
    const s = summarize({
      ...base,
      costs: [
        { amount: 2500000, status: "ENGAGE", rebillable: false },
        { amount: 1000000, status: "PREVU", rebillable: false },
      ],
      billing: [],
      payments: [],
    });
    expect(s.costsCommitted).toBe(2500000);
    expect(s.costsPaid).toBe(0);
    // 25 000 engagés + 10 000 prévus > budget 30 000 → coûts prévisionnels 35 000.
    expect(s.forecastCost).toBe(3500000);
    expect(s.marginForecast).toBe(1500000);
    expect(s.remainingToPay).toBe(2500000);
  });

  it("attendu, facturé et encaissé restent distincts", () => {
    const s = summarize({
      ...base,
      costs: [{ amount: 1000000, status: "PAYE", rebillable: true }],
      billing: [
        { id: "a", amount: 1500000, status: "FACTURE", plannedDate: d("2026-09-01") },
        { id: "b", amount: 2000000, status: "ATTENDU", plannedDate: d("2026-11-01") },
        { id: "c", amount: 1500000, status: "ATTENDU", plannedDate: d("2026-10-01") },
        { id: "x", amount: 999, status: "ANNULE", plannedDate: null },
      ],
      payments: [{ amount: 500000, billingMilestoneId: "a" }],
    });
    expect(s.billingExpected).toBe(5000000);
    expect(s.billingInvoiced).toBe(1500000);
    expect(s.collected).toBe(500000);
    expect(s.lateBillingCount).toBe(1);
    expect(s.marginActual).toBe(1500000 - 1000000);
    expect(s.rebillable).toBe(1000000);
  });

  it("les coûts annulés sont ignorés ; sans budget, revenus = échéancier", () => {
    const s = summarize({
      budget: null,
      initial: null,
      today,
      costs: [{ amount: 400000, status: "ANNULE", rebillable: false }],
      billing: [{ id: "a", amount: 800000, status: "ATTENDU", plannedDate: null }],
      payments: [],
    });
    expect(s.costsPlanned).toBe(0);
    expect(s.revenuePlanned).toBe(800000);
    expect(s.marginForecast).toBe(800000);
    expect(s.budgetConsumedPct).toBeNull();
  });

  it("taux de marge", () => {
    expect(marginRate(1500000, 5000000)).toBe(30);
    expect(marginRate(10, 0)).toBeNull();
  });

  describe("temps partiellement valorisé (minutes sans coût horaire)", () => {
    const withTime = (time: Parameters<typeof summarize>[0]["time"]) =>
      summarize({
        ...base,
        costs: [{ amount: 1000000, status: "FACTURE", rebillable: false }],
        billing: [{ id: "a", amount: 2000000, status: "FACTURE", plannedDate: null }],
        payments: [],
        time,
      });

    it("tout le temps valorisé : marges après temps calculées", () => {
      const s = withTime({ logged: 60000, planned: 90000, unvaluedMinutes: 0, plannedUnvaluedMinutes: 0 });
      expect(s.timeUnvaluedMinutes).toBe(0);
      expect(s.timeForecastPartial).toBe(false);
      expect(s.marginActualAfterTime).toBe(2000000 - 1000000 - 60000);
      expect(s.marginForecastAfterTime).toBe(5000000 - 3000000 - 90000);
    });

    it("temps passé sans taux : coût minimum affiché, marges après temps non calculées", () => {
      // 10 h valorisées à 60 €/h, 50 h saisies par des associés sans taux (et sans taux d'agence).
      const s = withTime({ logged: 60000, planned: 60000, unvaluedMinutes: 3000, plannedUnvaluedMinutes: 0 });
      expect(s.timeCostLogged).toBe(60000);
      expect(s.timeUnvaluedMinutes).toBe(3000);
      expect(s.timeForecastPartial).toBe(true);
      expect(s.marginActualAfterTime).toBeNull();
      expect(s.marginForecastAfterTime).toBeNull();
    });

    it("seules des tâches prévues sans taux : marge réelle après temps calculée, prévisionnelle non", () => {
      const s = withTime({ logged: 60000, planned: 90000, unvaluedMinutes: 0, plannedUnvaluedMinutes: 600 });
      expect(s.timeForecastPartial).toBe(true);
      expect(s.marginActualAfterTime).toBe(2000000 - 1000000 - 60000);
      expect(s.marginForecastAfterTime).toBeNull();
    });

    it("aucun taux défini : rien de valorisé, rien de partiel", () => {
      const s = withTime({ logged: null, planned: null });
      expect(s.timeCostLogged).toBeNull();
      expect(s.timeUnvaluedMinutes).toBe(0);
      expect(s.timeForecastPartial).toBe(false);
      expect(s.marginActualAfterTime).toBeNull();
    });
  });
});

describe("statut d'échéance", () => {
  const m = { amount: 100000, status: "ATTENDU" as const, plannedDate: d("2026-10-01") };
  it("calculé à partir des encaissements et de la date", () => {
    expect(billingState(m, 0, today)).toBe("EN_RETARD");
    expect(billingState({ ...m, plannedDate: d("2026-10-30") }, 0, today)).toBe("ATTENDU");
    expect(billingState(m, 40000, today)).toBe("PARTIELLEMENT_ENCAISSE");
    expect(billingState(m, 100000, today)).toBe("ENCAISSE");
    expect(billingState({ ...m, status: "ANNULE" }, 100000, today)).toBe("ANNULE");
  });
});

describe("MRR", () => {
  it("ne compte que les contrats actifs à la date", () => {
    const value = mrr(
      [
        { monthlyAmount: 150000, status: "ACTIF", startDate: d("2026-01-01"), endDate: null },
        { monthlyAmount: 90000, status: "ACTIF", startDate: d("2026-11-01"), endDate: null },
        { monthlyAmount: 50000, status: "ACTIF", startDate: d("2025-01-01"), endDate: d("2026-09-30") },
        { monthlyAmount: 70000, status: "SUSPENDU", startDate: d("2026-01-01"), endDate: null },
      ],
      today,
    );
    expect(value).toBe(150000);
  });
});

describe("gouvernance", () => {
  const rules = { budgetOverrunPct: 10, delayPct: 20, delayMinDays: 7 };
  it("dépassement de budget au-delà du seuil", () => {
    expect(budgetRuleTriggered(1000000, 1100000, rules)).toEqual({ triggered: false, pct: 10 });
    expect(budgetRuleTriggered(1000000, 1150000, rules)).toEqual({ triggered: true, pct: 15 });
    expect(budgetRuleTriggered(1000000, 5000000, { ...rules, budgetOverrunPct: null }).triggered).toBe(false);
  });
  it("retard majeur : pourcentage ET durée minimale", () => {
    // Projet de 30 jours ; +10 jours = 33 % et ≥ 7 jours.
    expect(delayRuleTriggered(d("2026-10-01"), d("2026-10-31"), d("2026-11-10"), rules).triggered).toBe(true);
    // +5 jours = 16,7 % : sous le seuil.
    expect(delayRuleTriggered(d("2026-10-01"), d("2026-10-31"), d("2026-11-05"), rules).triggered).toBe(
      false,
    );
    // Avancement : jamais déclenché.
    expect(delayRuleTriggered(d("2026-10-01"), d("2026-10-31"), d("2026-10-20"), rules).triggered).toBe(
      false,
    );
  });
  it("dépouillement", () => {
    expect(tally([{ choice: "POUR" }, { choice: "POUR" }], 2, 3).status).toBe("APPROUVEE");
    expect(tally([{ choice: "POUR" }], 2, 3).status).toBe("OUVERTE");
    expect(tally([{ choice: "CONTRE" }, { choice: "CONTRE" }], 2, 3).status).toBe("REFUSEE");
    expect(tally([{ choice: "POUR" }, { choice: "ABSTENTION" }, { choice: "CONTRE" }], 2, 3).status).toBe(
      "REFUSEE",
    );
  });
});

import { periodRange } from "@/features/finance/calc";

describe("périodes du cockpit", () => {
  const iso = (r: [Date, Date]) => r.map((x) => x.toISOString().slice(0, 10));
  it("semaine, mois, trimestre calendaires", () => {
    expect(iso(periodRange("semaine", d("2026-10-15")))).toEqual(["2026-10-12", "2026-10-18"]);
    expect(iso(periodRange("mois", d("2026-02-10")))).toEqual(["2026-02-01", "2026-02-28"]);
    expect(iso(periodRange("trimestre", d("2026-11-03")))).toEqual(["2026-10-01", "2026-12-31"]);
  });
});
