import { describe, expect, it } from "vitest";
import { estimateFromHistory } from "@/features/finance/estimate";
import { compareToHistory, historyFromOverview, type OverviewProject } from "@/features/finance/export";
import { parseDateInput } from "@/lib/dates";

const d = (s: string) => parseDateInput(s)!;

const row = (over: Partial<OverviewProject> & { id: string }): OverviewProject => ({
  name: over.id,
  templateKey: "campagne-creative",
  clientId: null,
  status: "ACTIF",
  startDate: null,
  closedAt: null,
  minutes: 0,
  summary: { budgetRevenue: null, billingInvoiced: 0, costsCommitted: 0 },
  ...over,
});

describe("chiffrage par l'historique : préparation", () => {
  it("revenu : budget approuvé, à défaut facturé ; coûts engagés ; temps passé", () => {
    const [budgeted, billed] = historyFromOverview([
      row({
        id: "a",
        minutes: 600,
        summary: { budgetRevenue: 2000000, billingInvoiced: 500000, costsCommitted: 800000 },
      }),
      row({ id: "b", summary: { budgetRevenue: null, billingInvoiced: 700000, costsCommitted: 0 } }),
    ]);
    expect(budgeted).toMatchObject({ revenue: 2000000, costs: 800000, minutes: 600, closed: false });
    expect(billed.revenue).toBe(700000);
  });

  it("durée connue seulement pour un projet clôturé : début → jour de clôture à Paris", () => {
    const [closed, finishedNoDate, open] = historyFromOverview([
      // Clôturé le 31 mars à 23 h 30 UTC, soit le 1er avril à Paris.
      row({
        id: "c",
        status: "TERMINE",
        startDate: d("2026-03-01"),
        closedAt: new Date("2026-03-31T23:30:00Z"),
      }),
      row({ id: "t", status: "TERMINE", startDate: d("2026-03-01") }),
      row({ id: "o", startDate: d("2026-03-01") }),
    ]);
    expect(closed).toMatchObject({ closed: true, durationDays: 31 });
    expect(finishedNoDate).toMatchObject({ closed: true, durationDays: null });
    expect(open).toMatchObject({ closed: false, durationDays: null });
  });

  it("projet rouvert (TERMINE → ACTIF) : ancienne date de clôture ignorée, de nouveau en cours", () => {
    const [reopened] = historyFromOverview([
      row({
        id: "r",
        status: "ACTIF",
        startDate: d("2026-01-05"),
        closedAt: new Date("2026-02-10T10:00:00Z"),
      }),
    ]);
    expect(reopened).toMatchObject({ closed: false, durationDays: null });
  });

  it("projet archivé après sa clôture (TERMINE → ARCHIVE) : toujours terminé, durée conservée", () => {
    const [archived] = historyFromOverview([
      row({
        id: "a",
        status: "ARCHIVE",
        startDate: d("2026-01-05"),
        closedAt: new Date("2026-02-10T10:00:00Z"),
      }),
    ]);
    expect(archived).toMatchObject({ closed: true, durationDays: 36 });
  });

  it("projets terminés puis archivés : repères « clôturés », pas « en cours inclus »", () => {
    const closedAt = new Date("2026-03-01T10:00:00Z");
    const budget = (revenue: number) => ({ budgetRevenue: revenue, billingInvoiced: 0, costsCommitted: 0 });
    const e = estimateFromHistory(
      historyFromOverview([
        row({ id: "termine", status: "TERMINE", closedAt, summary: budget(1000000) }),
        row({ id: "archive", status: "ARCHIVE", closedAt, summary: budget(3000000) }),
        row({ id: "en cours", summary: budget(9000000) }),
      ]),
      "campagne-creative",
    );
    expect(e.basis).toBe("clotures");
    expect(e.projects.map((p) => p.id)).toEqual(["termine", "archive"]);
    expect(e.revenue?.median).toBe(2000000);
  });

  it("le projet comparé est exclu de ses propres repères", () => {
    const rows = [
      row({ id: "moi", summary: { budgetRevenue: 9900000, billingInvoiced: 0, costsCommitted: 0 } }),
      row({ id: "autre", summary: { budgetRevenue: 1000000, billingInvoiced: 0, costsCommitted: 400000 } }),
      row({
        id: "autre modèle",
        templateKey: "vierge",
        summary: { budgetRevenue: 5000000, billingInvoiced: 0, costsCommitted: 0 },
      }),
    ];
    const e = estimateFromHistory(historyFromOverview(rows), "campagne-creative", "moi");
    expect(e.projects.map((p) => p.id)).toEqual(["autre"]);
    expect(e.revenue).toEqual({ count: 1, min: 1000000, median: 1000000, max: 1000000 });
    expect(e.marginRate?.median).toBe(60);
    expect(estimateFromHistory(historyFromOverview([rows[0]]), "campagne-creative", "moi").projects).toEqual(
      [],
    );
  });
});

describe("chiffrage par l'historique : comparaison", () => {
  const s = { count: 3, min: 1000000, median: 2000000, max: 3000000 };
  it("situe un montant : en dessous, dans la fourchette, au-dessus, écart à la médiane", () => {
    expect(compareToHistory(500000, s)).toEqual({ kind: "dessous", deltaPct: -75 });
    expect(compareToHistory(2200000, s)).toEqual({ kind: "dans", deltaPct: 10 });
    expect(compareToHistory(1000000, s)).toEqual({ kind: "dans", deltaPct: -50 });
    expect(compareToHistory(3000001, s)).toEqual({ kind: "dessus", deltaPct: 50 });
  });
  it("rien à comparer sans montant ou sans repère", () => {
    expect(compareToHistory(null, s)).toBeNull();
    expect(compareToHistory(0, s)).toBeNull();
    expect(compareToHistory(1000, null)).toBeNull();
    expect(compareToHistory(1000, { count: 1, min: 0, median: 0, max: 0 })).toEqual({
      kind: "dessus",
      deltaPct: null,
    });
  });
});
