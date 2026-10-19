import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  billingDate,
  billingSheet,
  costDate,
  costSheet,
  excelValue,
  exportFileName,
  inRange,
  notesSheet,
  parseExportScope,
  paymentSheet,
  scopeLabel,
  scopeRange,
  scopeValue,
  slugify,
  synthesisSheet,
  writeWorkbook,
  type BillingRecord,
  type CostRecord,
  type PaymentRecordRow,
  type SynthesisRow,
} from "@/features/finance/export";
import { parseDateInput } from "@/lib/dates";

const d = (s: string) => parseDateInput(s)!;
const q = (s: string) => parseExportScope(new URLSearchParams(s));
const project = { name: "Campagne Été", client: { name: "Maison Test" } };

describe("export comptable : périmètre", () => {
  it("lit projet, mois, année et l'année du mois choisi", () => {
    expect(q("projet=cl_abc-123")).toEqual({ ok: true, scope: { kind: "projet", projectId: "cl_abc-123" } });
    expect(q("mois=2026-10")).toEqual({ ok: true, scope: { kind: "mois", year: 2026, month: 10 } });
    expect(q("mois=2026-10&periode=mois")).toEqual({
      ok: true,
      scope: { kind: "mois", year: 2026, month: 10 },
    });
    expect(q("mois=2025-03&periode=annee")).toEqual({ ok: true, scope: { kind: "annee", year: 2025 } });
    expect(q("annee=2026")).toEqual({ ok: true, scope: { kind: "annee", year: 2026 } });
  });

  it("refuse un périmètre absent, multiple ou mal formé", () => {
    for (const bad of [
      "",
      "mois=",
      "projet=a&mois=2026-10",
      "mois=2026-10&annee=2026",
      "mois=2026-13",
      "mois=2026-00",
      "mois=26-10",
      "mois=2026-1",
      "annee=26",
      "annee=1999",
      "annee=abcd",
      "projet=../etc",
      "projet=a b",
      `projet=${"x".repeat(65)}`,
      "mois=2026-10&periode=semaine",
    ])
      expect(q(bad).ok, bad).toBe(false);
  });

  it("bornes incluses du mois (année bissextile) et de l'année", () => {
    expect(scopeRange({ kind: "mois", year: 2028, month: 2 })).toEqual([d("2028-02-01"), d("2028-02-29")]);
    expect(scopeRange({ kind: "mois", year: 2026, month: 12 })).toEqual([d("2026-12-01"), d("2026-12-31")]);
    expect(scopeRange({ kind: "annee", year: 2026 })).toEqual([d("2026-01-01"), d("2026-12-31")]);
    expect(scopeRange({ kind: "projet", projectId: "p" })).toBeNull();
  });

  it("rattachement : bornes incluses, sans date hors période, tout pour un projet", () => {
    const oct = scopeRange({ kind: "mois", year: 2026, month: 10 });
    expect(inRange(d("2026-10-01"), oct)).toBe(true);
    expect(inRange(d("2026-10-31"), oct)).toBe(true);
    expect(inRange(d("2026-11-01"), oct)).toBe(false);
    expect(inRange(null, oct)).toBe(false);
    expect(inRange(null, null)).toBe(true);
  });

  it("nom de fichier ASCII et libellés", () => {
    expect(slugify("Campagne Été 2026 — « Lancement » !")).toBe("campagne-ete-2026-lancement");
    expect(exportFileName({ kind: "projet", projectId: "p1" }, "Clip Noël")).toBe(
      "every1ate-finance-projet-clip-noel.xlsx",
    );
    expect(exportFileName({ kind: "projet", projectId: "p1" }, "€€€")).toBe(
      "every1ate-finance-projet-p1.xlsx",
    );
    expect(exportFileName({ kind: "mois", year: 2026, month: 3 })).toBe("every1ate-finance-2026-03.xlsx");
    expect(exportFileName({ kind: "annee", year: 2026 })).toBe("every1ate-finance-2026.xlsx");
    expect(scopeLabel({ kind: "mois", year: 2026, month: 10 })).toBe("Octobre 2026");
    expect(scopeValue({ kind: "mois", year: 2026, month: 3 })).toBe("2026-03");
    expect(scopeValue({ kind: "projet", projectId: "p1" })).toBe("p1");
  });
});

describe("export comptable : dates de référence", () => {
  const none = { invoiceDate: null, paidAt: null, dueDate: null, committedAt: null };
  it("coût : facture, puis paiement, puis échéance, puis engagement", () => {
    expect(costDate({ ...none, committedAt: d("2026-01-05") })).toEqual(d("2026-01-05"));
    expect(costDate({ ...none, committedAt: d("2026-01-05"), dueDate: d("2026-02-05") })).toEqual(
      d("2026-02-05"),
    );
    expect(costDate({ ...none, dueDate: d("2026-02-05"), paidAt: d("2026-02-10") })).toEqual(d("2026-02-10"));
    expect(
      costDate({
        invoiceDate: d("2026-01-20"),
        paidAt: d("2026-02-10"),
        dueDate: d("2026-02-05"),
        committedAt: d("2026-01-05"),
      }),
    ).toEqual(d("2026-01-20"));
    expect(costDate(none)).toBeNull();
  });
  it("échéance de facturation : date de facture, sinon date prévue", () => {
    expect(billingDate({ invoicedAt: null, plannedDate: d("2026-03-01") })).toEqual(d("2026-03-01"));
    expect(billingDate({ invoicedAt: d("2026-02-25"), plannedDate: d("2026-03-01") })).toEqual(
      d("2026-02-25"),
    );
  });
});

describe("export comptable : lignes", () => {
  const cost = (over: Partial<CostRecord>): CostRecord => ({
    invoiceDate: null,
    paidAt: null,
    dueDate: null,
    committedAt: null,
    description: "Location studio",
    supplier: "Studio Test",
    category: "Production",
    amount: "1234.56",
    vatAmount: "246.91",
    status: "FACTURE",
    documentRef: "F-001",
    rebillable: false,
    project,
    workPackage: { name: "Tournage" },
    ...over,
  });

  it("coûts : filtrés par date de référence, triés, montants en centimes, libellés en français", () => {
    const oct = scopeRange({ kind: "mois", year: 2026, month: 10 });
    const sheet = costSheet(
      [
        cost({ description: "B", invoiceDate: d("2026-10-20") }),
        cost({ description: "A", committedAt: d("2026-09-30"), dueDate: d("2026-10-02") }),
        cost({ description: "Hors période", invoiceDate: d("2026-09-30"), dueDate: d("2026-10-15") }),
        cost({ description: "Sans date" }),
      ],
      oct,
    );
    expect(sheet.name).toBe("Coûts");
    expect(sheet.rows.map((r) => r[4])).toEqual(["A", "B"]);
    const [first] = sheet.rows;
    expect(first[0]).toEqual(d("2026-10-02"));
    expect(first.slice(1, 4)).toEqual(["Campagne Été", "Maison Test", "Tournage"]);
    expect(first[7]).toBe(123456);
    expect(first[8]).toBe(24691);
    expect(first[9]).toBe("Reçu / facturé");
    expect(first[15]).toBe("Non");
    expect(sheet.rows.every((r) => r.length === sheet.columns.length)).toBe(true);
  });

  it("export projet : toutes les lignes, celles sans date en dernier", () => {
    const sheet = costSheet(
      [cost({ description: "Sans date" }), cost({ description: "Daté", committedAt: d("2026-01-01") })],
      null,
    );
    expect(sheet.rows.map((r) => r[4])).toEqual(["Daté", "Sans date"]);
  });

  it("facturation : statut calculé avec les encaissements et la date", () => {
    const today = d("2026-10-14");
    const base: BillingRecord = {
      invoicedAt: null,
      plannedDate: d("2026-10-01"),
      label: "Acompte",
      kind: "ACOMPTE",
      amount: "1000.00",
      vatAmount: null,
      status: "FACTURE",
      invoiceRef: "FA-1",
      project,
      workPackage: null,
      payments: [],
    };
    const sheet = billingSheet(
      [
        { ...base, label: "Partiel", payments: [{ amount: "400.00" }] },
        { ...base, label: "Retard", status: "ATTENDU" },
        { ...base, label: "Soldé", payments: [{ amount: "600" }, { amount: "400" }] },
      ],
      null,
      today,
    );
    const byLabel = Object.fromEntries(sheet.rows.map((r) => [r[4], r]));
    expect(byLabel.Partiel[8]).toBe("Partiellement encaissé");
    expect(byLabel.Partiel[12]).toBe(40000);
    expect(byLabel.Retard[8]).toBe("En retard");
    expect(byLabel.Soldé[8]).toBe("Encaissé");
    expect(byLabel.Soldé[5]).toBe("Acompte");
    expect(byLabel.Soldé[7]).toBeNull();
  });

  it("encaissements : libellé de l'échéance à défaut, rattachement signalé", () => {
    const p: PaymentRecordRow = {
      receivedAt: d("2026-10-03"),
      amount: "500.00",
      reference: "VIR-1",
      label: null,
      source: "IMPORT",
      project,
      billingMilestone: { label: "Acompte", workPackage: { name: "Concept" } },
    };
    const sheet = paymentSheet(
      [p, { ...p, receivedAt: d("2026-11-01") }, { ...p, label: "Virement", billingMilestone: null }],
      scopeRange({ kind: "mois", year: 2026, month: 10 }),
    );
    expect(sheet.rows).toHaveLength(2);
    const [linked, free] = sheet.rows;
    expect(linked.slice(3, 9)).toEqual(["Concept", "Acompte", "Acompte", "VIR-1", 50000, "Import"]);
    expect(free.slice(3, 6)).toEqual([null, "Virement", "Non rattaché"]);
  });

  it("synthèse : ligne projet puis lots, colonne temps valorisé seulement si des taux existent", () => {
    const summary = {
      revenuePlanned: 5000000,
      forecastCost: 3000000,
      costsCommitted: 2500000,
      costsPaid: 1000000,
      billingInvoiced: 1500000,
      collected: 500000,
      marginForecast: 2000000,
      marginActual: 500000,
      timeCostLogged: 120000,
    };
    const rows: SynthesisRow[] = [
      { project: "P", client: null, lot: null, status: "Actif", summary, minutes: 90 },
      { project: "P", client: null, lot: "Concept", status: "Actif", summary, minutes: null },
    ];
    const valued = synthesisSheet(rows, true);
    expect(valued.columns.at(-1)?.header).toBe("Temps valorisé");
    expect(valued.rows[0][2]).toBe("Ensemble du projet");
    expect(valued.rows[1][2]).toBe("Concept");
    expect(valued.rows[0].slice(4, 14)).toEqual([
      5000000, 3000000, 2500000, 1000000, 1500000, 500000, 2000000, 500000, 90, 120000,
    ]);
    const plain = synthesisSheet(rows, false);
    expect(plain.columns.map((c) => c.header)).not.toContain("Temps valorisé");
    expect(plain.rows[0]).toHaveLength(plain.columns.length);
  });

  it("valeurs Excel : euros pour les montants, heures décimales, vides", () => {
    expect(excelValue("money", 123456)).toBe(1234.56);
    expect(excelValue("money", -5)).toBe(-0.05);
    expect(excelValue("hours", 90)).toBe(1.5);
    expect(excelValue("hours", 50)).toBe(0.83);
    expect(excelValue("text", "")).toBeNull();
    expect(excelValue("date", null)).toBeNull();
    expect(excelValue("date", d("2026-10-14"))).toEqual(d("2026-10-14"));
  });
});

describe("export comptable : classeur", () => {
  it("feuilles, en-tête gras et figé, filtre, montants et dates typés", async () => {
    const bytes = await writeWorkbook(
      [
        costSheet(
          [
            {
              invoiceDate: d("2026-10-14"),
              paidAt: null,
              dueDate: null,
              committedAt: null,
              description: "Location",
              supplier: null,
              category: null,
              amount: "1234.56",
              vatAmount: null,
              status: "ENGAGE",
              documentRef: null,
              rebillable: true,
              project,
              workPackage: null,
            },
          ],
          null,
        ),
        notesSheet({ scopeLabel: "Année 2026", generatedAt: new Date(), periodic: true, timeValued: false }),
      ],
      new Date(),
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Coûts", "À lire"]);
    const ws = wb.getWorksheet("Coûts")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Date");
    expect(ws.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    const row = ws.getRow(2);
    expect(row.getCell(1).value).toEqual(d("2026-10-14"));
    expect(row.getCell(1).numFmt).toBe("dd/mm/yyyy");
    expect(row.getCell(8).value).toBe(1234.56);
    expect(row.getCell(8).numFmt).toBe("#,##0.00 €");
    expect(row.getCell(10).value).toBe("Engagé");
    expect(row.getCell(16).value).toBe("Oui");
    expect(wb.getWorksheet("À lire")!.autoFilter).toBeFalsy();
  });
});
