import { describe, expect, it } from "vitest";
import {
  detectKind,
  fingerprint,
  guessMapping,
  parseCsv,
  parseFlexibleAmount,
  parseFlexibleDate,
  validateRows,
} from "@/features/finance/import-rules";

describe("lecture CSV", () => {
  it("point-virgule, guillemets, retours ligne et BOM", () => {
    const t = parseCsv(
      '﻿Date;Fournisseur;Libellé;Montant HT\r\n31/10/2026;"Studio ""Lux""";"Location\nplateau";1 200,50\r\n\r\n',
    );
    expect(t.headers).toEqual(["Date", "Fournisseur", "Libellé", "Montant HT"]);
    expect(t.rows).toEqual([["31/10/2026", 'Studio "Lux"', "Location\nplateau", "1 200,50"]]);
  });
  it("virgule détectée", () => {
    expect(parseCsv("a,b\n1,2").rows).toEqual([["1", "2"]]);
  });
});

describe("formats", () => {
  it.each([
    ["31/10/2026", "2026-10-31"],
    ["1-2-26", "2026-02-01"],
    ["2026-10-31T10:00:00Z", "2026-10-31"],
    ["30/02/2026", null],
    ["demain", null],
  ])("date %s", (raw, expected) => expect(parseFlexibleDate(raw)).toBe(expected));
  it.each([
    ["1 234,56", 123456],
    ["1.234,56 €", 123456],
    ["1,234.56", 123456],
    ["-45,5", -4550],
    ["(12)", -1200],
    ["12,345", null],
    ["abc", null],
  ])("montant %s", (raw, expected) => expect(parseFlexibleAmount(raw)).toBe(expected));
});

describe("type et correspondance", () => {
  it("détecte un export de coûts et associe les colonnes", () => {
    const headers = [
      "N° pièce",
      "Date",
      "Fournisseur",
      "Libellé",
      "Montant HT",
      "TVA",
      "Montant TTC",
      "Statut",
    ];
    expect(detectKind(headers)).toBe("COUTS");
    expect(guessMapping("COUTS", headers)).toMatchObject({
      externalId: 0,
      date: 1,
      supplier: 2,
      description: 3,
      amount: 4,
      vat: 5,
      ttc: 6,
      status: 7,
    });
  });
  it("détecte un relevé bancaire", () => {
    const headers = ["Date opération", "Contrepartie", "Crédit", "Référence", "Transaction ID"];
    expect(detectKind(headers)).toBe("ENCAISSEMENTS");
    expect(guessMapping("ENCAISSEMENTS", headers)).toMatchObject({
      date: 0,
      label: 1,
      amount: 2,
      reference: 3,
      externalId: 4,
    });
  });
});

describe("validation", () => {
  const table = {
    headers: ["Date", "Fournisseur", "Libellé", "Montant HT", "TVA", "TTC", "N°"],
    rows: [
      ["31/10/2026", "Studio Lux", "Plateau", "1000", "200", "1200", "F-1"],
      ["32/10/2026", "Studio Lux", "Plateau", "abc", "", "", "F-2"],
      ["31/10/2026", "Studio Lux", "Plateau", "1000", "200", "1200", "F-1"],
      ["01/11/2026", "Traiteur", "", "300", "60", "350", "F-3"],
      ["02/11/2026", "Déjà là", "Repas", "50", "", "", "F-9"],
    ],
  };
  const mapping = guessMapping("COUTS", table.headers);
  const rows = validateRows("COUTS", table, mapping, {
    externalIds: new Set(["F-9"]),
    fingerprints: new Set(),
  });

  it("ligne valide prête à importer", () => {
    expect(rows[0]).toMatchObject({ line: 2, errors: [], duplicate: null });
    expect(rows[0].values).toMatchObject({
      date: "2026-10-31",
      amount: 100000,
      vat: 20000,
      ttc: 120000,
      status: "FACTURE",
      externalId: "F-1",
    });
  });
  it("erreurs de format signalées avant import", () => {
    expect(rows[1].errors).toEqual(["Date illisible : « 32/10/2026 ».", "Montant illisible : « abc »."]);
  });
  it("doublons dans le fichier et en base", () => {
    expect(rows[2].duplicate).toBe("fichier");
    expect(rows[4].duplicate).toBe("base");
  });
  it("avertissements et champs obligatoires", () => {
    expect(rows[3].errors).toContain("Description manquante.");
    expect(rows[3].warnings).toContain("HT + TVA ≠ TTC.");
  });
  it("statuts : « à payer » n'est pas « payé »", () => {
    const t = {
      headers: ["Date", "Libellé", "Montant HT", "Statut"],
      rows: [
        ["01/10/2026", "A", "10", "À payer"],
        ["01/10/2026", "B", "11", "Payée"],
        ["01/10/2026", "C", "12", "Impayé"],
      ],
    };
    const r = validateRows("COUTS", t, guessMapping("COUTS", t.headers), {
      externalIds: new Set(),
      fingerprints: new Set(),
    });
    expect(r.map((x) => x.values.status)).toEqual(["FACTURE", "PAYE", "FACTURE"]);
  });
  it("encaissement négatif refusé ; empreinte stable", () => {
    const t = { headers: ["Date", "Crédit", "Référence"], rows: [["01/10/2026", "-50", "FA-1"]] };
    const r = validateRows("ENCAISSEMENTS", t, guessMapping("ENCAISSEMENTS", t.headers), {
      externalIds: new Set(),
      fingerprints: new Set(),
    });
    expect(r[0].errors[0]).toContain("débit");
    expect(fingerprint("2026-10-01", 100, "Éclair  Studio")).toBe(
      fingerprint("2026-10-01", 100, "eclair studio"),
    );
  });
});
