/**
 * Imports CSV/Excel (§10.7) : lecture, détection du type, correspondance des colonnes,
 * validation, doublons. Fonctions pures, testées ; aucune écriture ici.
 */

export type ImportKind = "COUTS" | "ENCAISSEMENTS";
export type Table = { headers: string[]; rows: string[][] };

/** CSV RFC 4180 ; séparateur détecté (« ; » courant en France, « , » ou tabulation). */
export function parseCsv(text: string): Table {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    out.push(row);
  }
  const nonEmpty = out.filter((r) => r.some((v) => v.trim() !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows: rows.map((r) => r.map((v) => v.trim())) };
}

export type FieldDef = { key: string; label: string; required: boolean; synonyms: string[] };

export const FIELDS: Record<ImportKind, FieldDef[]> = {
  COUTS: [
    {
      key: "date",
      label: "Date (facture ou engagement)",
      required: true,
      synonyms: ["date", "date facture", "date de facture", "date piece", "date pièce"],
    },
    {
      key: "description",
      label: "Description",
      required: true,
      synonyms: ["description", "libelle", "libellé", "designation", "désignation", "objet"],
    },
    {
      key: "supplier",
      label: "Fournisseur",
      required: false,
      synonyms: ["fournisseur", "tiers", "supplier", "prestataire"],
    },
    {
      key: "amount",
      label: "Montant HT",
      required: true,
      synonyms: ["montant ht", "ht", "total ht", "montant"],
    },
    { key: "vat", label: "TVA", required: false, synonyms: ["tva", "montant tva", "vat"] },
    { key: "ttc", label: "Montant TTC", required: false, synonyms: ["ttc", "montant ttc", "total ttc"] },
    { key: "status", label: "Statut", required: false, synonyms: ["statut", "etat", "état", "status"] },
    {
      key: "externalId",
      label: "Identifiant externe (n° de pièce)",
      required: false,
      synonyms: [
        "id",
        "identifiant",
        "numero",
        "numéro",
        "n°",
        "no",
        "n° piece",
        "n° pièce",
        "reference",
        "référence",
        "piece",
        "pièce",
      ],
    },
    {
      key: "category",
      label: "Catégorie",
      required: false,
      synonyms: ["categorie", "catégorie", "compte", "category"],
    },
  ],
  ENCAISSEMENTS: [
    {
      key: "date",
      label: "Date d'opération",
      required: true,
      synonyms: ["date", "date operation", "date opération", "date de valeur", "settled at"],
    },
    {
      key: "amount",
      label: "Montant encaissé",
      required: true,
      synonyms: ["montant", "credit", "crédit", "amount", "montant credit"],
    },
    {
      key: "reference",
      label: "Référence facture",
      required: false,
      synonyms: ["reference", "référence", "ref facture", "facture", "reference facture"],
    },
    {
      key: "label",
      label: "Libellé",
      required: false,
      synonyms: ["libelle", "libellé", "label", "contrepartie", "counterparty"],
    },
    {
      key: "externalId",
      label: "Identifiant externe (transaction)",
      required: false,
      synonyms: ["id", "transaction", "identifiant", "transaction id"],
    },
  ],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9° ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Détecte le type d'import à partir des en-têtes. */
export function detectKind(headers: string[]): ImportKind | null {
  const h = headers.map(norm);
  const has = (...words: string[]) => h.some((x) => words.some((w) => x.includes(norm(w))));
  if (has("fournisseur", "ht", "tva", "tiers")) return "COUTS";
  if (has("credit", "transaction", "operation", "contrepartie")) return "ENCAISSEMENTS";
  return null;
}

/** Correspondance proposée : colonne dont l'en-tête correspond à un synonyme (égalité d'abord). */
export function guessMapping(kind: ImportKind, headers: string[]): Record<string, number | null> {
  const h = headers.map(norm);
  const used = new Set<number>();
  const mapping: Record<string, number | null> = {};
  for (const f of FIELDS[kind]) {
    const syn = f.synonyms.map(norm);
    let idx = h.findIndex((x, i) => !used.has(i) && syn.includes(x));
    if (idx < 0) idx = h.findIndex((x, i) => !used.has(i) && syn.some((s) => s.length > 2 && x.includes(s)));
    mapping[f.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return mapping;
}

/** « 31/10/2026 », « 31-10-26 », « 2026-10-31 », « 2026-10-31T… » → 2026-10-31. */
export function parseFlexibleDate(raw: string): string | null {
  const v = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? `20${m[3]}` : m[3])];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** « 1 234,56 », « -1234.56 », « 1.234,56 € » → centimes signés. */
export function parseFlexibleAmount(raw: string): number | null {
  let v = raw.replace(/[\s  €]/g, "");
  if (!v) return null;
  const negative = v.startsWith("-") || (v.startsWith("(") && v.endsWith(")"));
  v = v.replace(/^[-+(]|\)$/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  // Séparateur de milliers « , » accepté seulement avec des décimales en point (« 1,234.56 ») :
  // « 12,345 » reste ambigu et est refusé.
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(v)) v = v.replace(/,/g, "");
  else v = v.replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return negative ? -cents : cents;
}

// Ordre important : « à payer » doit être reconnu avant « payé ».
const STATUS_WORDS: [RegExp, "PREVU" | "ENGAGE" | "FACTURE" | "PAYE" | "ANNULE"][] = [
  [/a payer|à payer|impay|non pay|en attente/, "FACTURE"],
  [/pay|regl|r[eé]gl|acquitt/, "PAYE"],
  [/annul/, "ANNULE"],
  [/engag|command/, "ENGAGE"],
  [/pr[eé]vu|estim/, "PREVU"],
  [/factur|re[cç]u|a payer|à payer/, "FACTURE"],
];

export type ParsedRow = {
  line: number;
  values: Record<string, string | number | null>;
  errors: string[];
  warnings: string[];
  duplicate: "fichier" | "base" | null;
};

export type Existing = { externalIds: Set<string>; fingerprints: Set<string> };

export function fingerprint(date: string, cents: number, who: string | null) {
  return `${date}|${cents}|${norm(who ?? "")}`;
}

/**
 * Valide chaque ligne : formats, montants, dates, identifiants ; repère les doublons
 * dans le fichier et les lignes probablement déjà importées.
 */
export function validateRows(
  kind: ImportKind,
  table: Table,
  mapping: Record<string, number | null>,
  existing: Existing,
): ParsedRow[] {
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  return table.rows.map((cells, i) => {
    const get = (k: string) => {
      const idx = mapping[k];
      return idx == null ? "" : (cells[idx] ?? "").trim();
    };
    const errors: string[] = [];
    const warnings: string[] = [];
    const values: ParsedRow["values"] = {};
    for (const f of FIELDS[kind])
      if (f.required && mapping[f.key] == null) errors.push(`Colonne « ${f.label} » non associée.`);

    const rawDate = get("date");
    const date = rawDate ? parseFlexibleDate(rawDate) : null;
    if (!rawDate) errors.push("Date manquante.");
    else if (!date) errors.push(`Date illisible : « ${rawDate} ».`);
    values.date = date;

    const rawAmount = get("amount");
    const amount = rawAmount ? parseFlexibleAmount(rawAmount) : null;
    if (!rawAmount) errors.push("Montant manquant.");
    else if (amount == null) errors.push(`Montant illisible : « ${rawAmount} ».`);
    else if (amount < 0)
      errors.push(
        kind === "ENCAISSEMENTS"
          ? "Montant négatif : un débit n'est pas un encaissement."
          : "Montant négatif : saisissez un avoir à part.",
      );
    else if (amount === 0) warnings.push("Montant nul.");
    values.amount = amount;

    const externalId = get("externalId") || null;
    values.externalId = externalId;

    if (kind === "COUTS") {
      values.description = get("description") || null;
      if (!values.description) errors.push("Description manquante.");
      values.supplier = get("supplier") || null;
      values.category = get("category") || null;
      for (const [k, label] of [
        ["vat", "TVA"],
        ["ttc", "TTC"],
      ] as const) {
        const raw = get(k);
        const cents = raw ? parseFlexibleAmount(raw) : null;
        if (raw && cents == null) errors.push(`${label} illisible : « ${raw} ».`);
        values[k] = cents;
      }
      if (
        typeof values.amount === "number" &&
        typeof values.vat === "number" &&
        typeof values.ttc === "number" &&
        values.amount + values.vat !== values.ttc
      )
        warnings.push("HT + TVA ≠ TTC.");
      const rawStatus = norm(get("status"));
      values.status = rawStatus ? (STATUS_WORDS.find(([re]) => re.test(rawStatus))?.[1] ?? null) : "FACTURE";
      if (rawStatus && !values.status) {
        warnings.push(`Statut inconnu « ${get("status")} » : « Reçu/facturé » retenu.`);
        values.status = "FACTURE";
      }
    } else {
      values.reference = get("reference") || null;
      values.label = get("label") || null;
    }

    let duplicate: ParsedRow["duplicate"] = null;
    if (date && typeof amount === "number") {
      const who =
        kind === "COUTS"
          ? ((values.supplier as string | null) ?? (values.description as string | null))
          : ((values.reference as string | null) ?? (values.label as string | null));
      const fp = fingerprint(date, amount, who);
      if ((externalId && existing.externalIds.has(externalId)) || existing.fingerprints.has(fp))
        duplicate = "base";
      else if ((externalId && seenIds.has(externalId)) || seen.has(fp)) duplicate = "fichier";
      seen.add(fp);
      if (externalId) seenIds.add(externalId);
    }
    if (duplicate === "base") warnings.push("Ligne probablement déjà importée.");
    if (duplicate === "fichier") warnings.push("Doublon dans le fichier.");
    return { line: i + 2, values, errors, warnings, duplicate };
  });
}
