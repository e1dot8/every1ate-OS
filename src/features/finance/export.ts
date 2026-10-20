/**
 * Export comptable (Excel) et préparation des repères de chiffrage.
 *
 * Tout ce fichier est pur (périmètres, dates de rattachement, lignes des feuilles), sauf
 * `writeWorkbook`, seule fonction qui touche à exceljs (chargé à la demande).
 * Montants manipulés en centimes entiers ; convertis en euros uniquement à l'écriture du classeur.
 *
 * Dates de rattachement à une période (mois ou année) :
 * - coût : date de facture, à défaut date de paiement, à défaut échéance, à défaut date d'engagement ;
 *   un coût sans aucune de ces dates n'est rattaché à aucune période (il reste dans l'export projet) ;
 * - échéance de facturation : date de facturation, à défaut date prévue ;
 * - encaissement : date de réception.
 */
import {
  billingState,
  billingStateLabels,
  type BillingLine,
  type FinanceSummary,
} from "@/features/finance/calc";
import type { HistoryProject, Stat } from "@/features/finance/estimate";
import { billingKindLabels, costStatusLabels } from "@/features/finance/labels";
import { daysBetween, todayDate } from "@/lib/dates";
import { toCents } from "@/lib/money";

// ─── Périmètre ──────────────────────────────────────────────────────────────

export type ExportScope =
  | { kind: "projet"; projectId: string }
  | { kind: "mois"; year: number; month: number }
  | { kind: "annee"; year: number };

type Parsed = { ok: true; scope: ExportScope } | { ok: false; error: string };

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const validYear = (y: number) => y >= MIN_YEAR && y <= MAX_YEAR;

/**
 * Lit le périmètre demandé : `?projet=<id>`, `?mois=AAAA-MM` ou `?annee=AAAA` (un seul à la fois).
 * `?mois=AAAA-MM&periode=annee` exporte toute l'année du mois choisi (formulaire sans JavaScript).
 */
export function parseExportScope(params: URLSearchParams): Parsed {
  const value = (k: string) => params.get(k)?.trim() || null;
  const projet = value("projet");
  const mois = value("mois");
  const annee = value("annee");
  const periode = value("periode");
  const given = [projet, mois, annee].filter(Boolean).length;
  if (!given) return { ok: false, error: "Précisez un périmètre : projet, mois (AAAA-MM) ou année (AAAA)." };
  if (given > 1) return { ok: false, error: "Un seul périmètre à la fois : projet, mois ou année." };
  if (periode && periode !== "mois" && periode !== "annee") return { ok: false, error: "Période invalide." };

  if (projet) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(projet)) return { ok: false, error: "Identifiant de projet invalide." };
    return { ok: true, scope: { kind: "projet", projectId: projet } };
  }
  if (annee) {
    const y = /^\d{4}$/.test(annee) ? Number(annee) : NaN;
    if (!validYear(y)) return { ok: false, error: "Année invalide (AAAA)." };
    return { ok: true, scope: { kind: "annee", year: y } };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(mois!);
  const year = m ? Number(m[1]) : NaN;
  const month = m ? Number(m[2]) : NaN;
  if (!validYear(year) || month < 1 || month > 12) return { ok: false, error: "Mois invalide (AAAA-MM)." };
  return {
    ok: true,
    scope: periode === "annee" ? { kind: "annee", year } : { kind: "mois", year, month },
  };
}

export type DateRange = [Date, Date];

/** Bornes incluses (dates calendrier à minuit UTC) ; null pour un export projet (tout l'historique). */
export function scopeRange(scope: ExportScope): DateRange | null {
  if (scope.kind === "mois")
    return [
      new Date(Date.UTC(scope.year, scope.month - 1, 1)),
      new Date(Date.UTC(scope.year, scope.month, 0)),
    ];
  if (scope.kind === "annee")
    return [new Date(Date.UTC(scope.year, 0, 1)), new Date(Date.UTC(scope.year, 11, 31))];
  return null;
}

export function inRange(date: Date | null, range: DateRange | null): boolean {
  if (!range) return true;
  return !!date && date >= range[0] && date <= range[1];
}

/** « Campagne Été 2026 » → « campagne-ete-2026 » (ASCII, pour un nom de fichier sûr). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Nom du fichier : every1ate-finance-<périmètre>.xlsx. */
export function exportFileName(scope: ExportScope, projectName?: string): string {
  const part =
    scope.kind === "projet"
      ? `projet-${slugify(projectName ?? "") || slugify(scope.projectId) || "export"}`
      : scope.kind === "mois"
        ? `${scope.year}-${pad(scope.month)}`
        : String(scope.year);
  return `every1ate-finance-${part}.xlsx`;
}

/** Libellé lisible du périmètre (feuille « À lire »). */
export function scopeLabel(scope: ExportScope, projectName?: string): string {
  if (scope.kind === "projet") return `Projet « ${projectName ?? scope.projectId} » (tout l'historique)`;
  if (scope.kind === "annee") return `Année ${scope.year}`;
  const name = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(scope.year, scope.month - 1, 1)),
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Valeur journalisée (sans montant) : identifiant du projet, « AAAA-MM » ou « AAAA ». */
export function scopeValue(scope: ExportScope): string {
  if (scope.kind === "projet") return scope.projectId;
  return scope.kind === "mois" ? `${scope.year}-${pad(scope.month)}` : String(scope.year);
}

// ─── Dates de rattachement ──────────────────────────────────────────────────

type CostDates = {
  invoiceDate: Date | null;
  paidAt: Date | null;
  dueDate: Date | null;
  committedAt: Date | null;
};
export const costDate = (c: CostDates) => c.invoiceDate ?? c.paidAt ?? c.dueDate ?? c.committedAt ?? null;

type BillingDates = { invoicedAt: Date | null; plannedDate: Date | null };
export const billingDate = (b: BillingDates) => b.invoicedAt ?? b.plannedDate ?? null;

// ─── Feuilles ───────────────────────────────────────────────────────────────

export type ColumnKind = "text" | "money" | "date" | "hours";
export type Column = { header: string; kind: ColumnKind; width?: number };
/** Cellule brute : centimes pour « money », minutes pour « hours », Date (minuit UTC) pour « date ». */
export type Cell = string | number | Date | null;
export type SheetSpec = { name: string; columns: Column[]; rows: Cell[][]; filter?: boolean };

export const NUM_FMT: Record<Exclude<ColumnKind, "text">, string> = {
  money: "#,##0.00 €",
  date: "dd/mm/yyyy",
  hours: "#,##0.00",
};

/** Valeur écrite dans Excel : euros (nombre) pour les montants, heures décimales pour le temps. */
export function excelValue(kind: ColumnKind, value: Cell): Cell {
  if (value == null || value === "") return null;
  if (kind === "money" && typeof value === "number") return value / 100;
  if (kind === "hours" && typeof value === "number") return Math.round((value / 60) * 100) / 100;
  return value;
}

type Amount = { toString(): string } | string;
type Named = { name: string } | null;
type RecordProject = { name: string; client: Named };

const yesNo = (b: boolean) => (b ? "Oui" : "Non");
const time = (d: Date | null) => d?.getTime() ?? Number.POSITIVE_INFINITY;
/** Tri : date croissante (sans date en dernier), puis projet. */
function byDateThenProject<T>(rows: T[], date: (r: T) => Date | null, project: (r: T) => string) {
  return [...rows].sort((a, b) => {
    const ta = time(date(a));
    const tb = time(date(b));
    if (ta !== tb) return ta < tb ? -1 : 1;
    return project(a).localeCompare(project(b), "fr");
  });
}

export type CostRecord = CostDates & {
  description: string;
  supplier: string | null;
  category: string | null;
  amount: Amount;
  vatAmount: Amount | null;
  status: keyof typeof costStatusLabels;
  documentRef: string | null;
  rebillable: boolean;
  project: RecordProject;
  workPackage: Named;
};

export function costSheet(costs: CostRecord[], range: DateRange | null): SheetSpec {
  const rows = byDateThenProject(
    costs.filter((c) => inRange(costDate(c), range)),
    costDate,
    (c) => c.project.name,
  );
  return {
    name: "Coûts",
    columns: [
      { header: "Date", kind: "date" },
      { header: "Projet", kind: "text", width: 28 },
      { header: "Client", kind: "text" },
      { header: "Lot", kind: "text" },
      { header: "Libellé", kind: "text", width: 36 },
      { header: "Fournisseur", kind: "text" },
      { header: "Catégorie", kind: "text", width: 16 },
      { header: "Montant HT", kind: "money" },
      { header: "TVA", kind: "money" },
      { header: "Statut", kind: "text", width: 16 },
      { header: "Engagé le", kind: "date" },
      { header: "Facture du", kind: "date" },
      { header: "Échéance", kind: "date" },
      { header: "Payé le", kind: "date" },
      { header: "Pièce", kind: "text", width: 16 },
      { header: "Refacturable", kind: "text", width: 13 },
    ],
    rows: rows.map((c) => [
      costDate(c),
      c.project.name,
      c.project.client?.name ?? null,
      c.workPackage?.name ?? null,
      c.description,
      c.supplier,
      c.category,
      toCents(c.amount),
      c.vatAmount == null ? null : toCents(c.vatAmount),
      costStatusLabels[c.status],
      c.committedAt,
      c.invoiceDate,
      c.dueDate,
      c.paidAt,
      c.documentRef,
      yesNo(c.rebillable),
    ]),
  };
}

export type BillingRecord = BillingDates & {
  label: string;
  kind: keyof typeof billingKindLabels;
  amount: Amount;
  vatAmount: Amount | null;
  status: BillingLine["status"];
  invoiceRef: string | null;
  project: RecordProject;
  workPackage: Named;
  /** Tous les encaissements rattachés (non supprimés), quelle que soit leur date. */
  payments: { amount: Amount }[];
};

export function billingSheet(billing: BillingRecord[], range: DateRange | null, today: Date): SheetSpec {
  const rows = byDateThenProject(
    billing.filter((b) => inRange(billingDate(b), range)),
    billingDate,
    (b) => b.project.name,
  );
  return {
    name: "Facturation",
    columns: [
      { header: "Date", kind: "date" },
      { header: "Projet", kind: "text", width: 28 },
      { header: "Client", kind: "text" },
      { header: "Lot", kind: "text" },
      { header: "Libellé", kind: "text", width: 32 },
      { header: "Type", kind: "text", width: 14 },
      { header: "Montant HT", kind: "money" },
      { header: "TVA", kind: "money" },
      { header: "Statut", kind: "text", width: 22 },
      { header: "Date prévue", kind: "date" },
      { header: "Facturé le", kind: "date" },
      { header: "Réf. facture", kind: "text", width: 16 },
      { header: "Encaissé", kind: "money" },
    ],
    rows: rows.map((b) => {
      const amount = toCents(b.amount);
      const paid = b.payments.reduce((n, p) => n + toCents(p.amount), 0);
      const state = billingState({ amount, status: b.status, plannedDate: b.plannedDate }, paid, today);
      return [
        billingDate(b),
        b.project.name,
        b.project.client?.name ?? null,
        b.workPackage?.name ?? null,
        b.label,
        billingKindLabels[b.kind],
        amount,
        b.vatAmount == null ? null : toCents(b.vatAmount),
        billingStateLabels[state],
        b.plannedDate,
        b.invoicedAt,
        b.invoiceRef,
        paid,
      ];
    }),
  };
}

export type PaymentRecordRow = {
  receivedAt: Date;
  amount: Amount;
  reference: string | null;
  label: string | null;
  source: "MANUEL" | "IMPORT";
  project: RecordProject;
  billingMilestone: { label: string; workPackage: Named } | null;
};

export function paymentSheet(payments: PaymentRecordRow[], range: DateRange | null): SheetSpec {
  const rows = byDateThenProject(
    payments.filter((p) => inRange(p.receivedAt, range)),
    (p) => p.receivedAt,
    (p) => p.project.name,
  );
  return {
    name: "Encaissements",
    columns: [
      { header: "Date", kind: "date" },
      { header: "Projet", kind: "text", width: 28 },
      { header: "Client", kind: "text" },
      { header: "Lot", kind: "text" },
      { header: "Libellé", kind: "text", width: 32 },
      { header: "Échéance", kind: "text", width: 28 },
      { header: "Référence", kind: "text", width: 18 },
      { header: "Montant HT", kind: "money" },
      { header: "Source", kind: "text", width: 14 },
    ],
    rows: rows.map((p) => [
      p.receivedAt,
      p.project.name,
      p.project.client?.name ?? null,
      p.billingMilestone?.workPackage?.name ?? null,
      p.label ?? p.billingMilestone?.label ?? "Encaissement",
      p.billingMilestone?.label ?? "Non rattaché",
      p.reference,
      toCents(p.amount),
      p.source === "IMPORT" ? "Import" : "Saisie",
    ]),
  };
}

export type SynthesisRow = {
  project: string;
  client: string | null;
  /** null : ligne de l'ensemble du projet. */
  lot: string | null;
  status: string;
  summary: Pick<
    FinanceSummary,
    | "revenuePlanned"
    | "forecastCost"
    | "costsCommitted"
    | "costsPaid"
    | "billingInvoiced"
    | "collected"
    | "marginForecast"
    | "marginActual"
    | "timeCostLogged"
    | "timeUnvaluedMinutes"
  >;
  /** Minutes passées ; null quand non disponible (lignes de lot). */
  minutes: number | null;
};

/** Synthèse par projet (et par lot pour un export projet), reprise telle quelle de summarize(). */
export function synthesisSheet(rows: SynthesisRow[], timeValued: boolean): SheetSpec {
  const columns: Column[] = [
    { header: "Projet", kind: "text", width: 28 },
    { header: "Client", kind: "text" },
    { header: "Lot", kind: "text" },
    { header: "Statut", kind: "text", width: 14 },
    { header: "Revenus prévus", kind: "money", width: 16 },
    { header: "Coûts prévisionnels", kind: "money", width: 18 },
    { header: "Coûts engagés", kind: "money", width: 16 },
    { header: "Coûts payés", kind: "money", width: 16 },
    { header: "Facturé", kind: "money", width: 16 },
    { header: "Encaissé", kind: "money", width: 16 },
    { header: "Marge prévisionnelle", kind: "money", width: 18 },
    { header: "Marge réelle", kind: "money", width: 16 },
    { header: "Temps passé (h)", kind: "hours", width: 15 },
  ];
  // Temps sans coût horaire : signalé à côté du temps valorisé (qui ne le compte pas), jamais à 0 €.
  if (timeValued)
    columns.push(
      { header: "Temps valorisé", kind: "money", width: 16 },
      { header: "Temps non valorisé (h)", kind: "hours", width: 18 },
    );
  return {
    name: "Synthèse",
    columns,
    rows: rows.map((r) => {
      const s = r.summary;
      const row: Cell[] = [
        r.project,
        r.client,
        r.lot ?? "Ensemble du projet",
        r.status,
        s.revenuePlanned,
        s.forecastCost,
        s.costsCommitted,
        s.costsPaid,
        s.billingInvoiced,
        s.collected,
        s.marginForecast,
        s.marginActual,
        r.minutes,
      ];
      if (timeValued) row.push(s.timeCostLogged, s.timeUnvaluedMinutes || null);
      return row;
    }),
  };
}

/** Feuille explicative : périmètre, règles de rattachement, avertissements. */
export function notesSheet(input: {
  scopeLabel: string;
  generatedAt: Date;
  periodic: boolean;
  timeValued: boolean;
}): SheetSpec {
  const generated = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(input.generatedAt);
  const rows: Cell[][] = [
    ["Périmètre", input.scopeLabel],
    ["Généré le", generated],
    [
      "Montants",
      "Hors taxes, en euros. Outil de pilotage : ne remplace ni la comptabilité ni l'expert-comptable.",
    ],
    [
      "Synthèse",
      input.periodic
        ? "Cumul à date de chaque projet ayant au moins une ligne sur la période (non limité à la période)."
        : "Cumul à date du projet, puis détail par lot.",
    ],
    ["Coûts", "Date : facture, à défaut paiement, à défaut échéance, à défaut engagement."],
    ["Facturation", "Date : facturation, à défaut date prévue. Statut tenant compte des encaissements."],
    ["Encaissements", "Date : réception du paiement."],
    [
      "Temps",
      input.timeValued
        ? "Temps valorisé au coût horaire interne : ni un décaissement, ni un montant facturable. Le temps saisi sans coût horaire (ni celui de l'associé, ni celui de l'agence) n'y est pas compté : voir « Temps non valorisé »."
        : "Aucun coût horaire interne défini : temps passé non valorisé.",
    ],
  ];
  return {
    name: "À lire",
    columns: [
      { header: "Rubrique", kind: "text", width: 16 },
      { header: "Détail", kind: "text", width: 100 },
    ],
    rows,
    filter: false,
  };
}

const DEFAULT_WIDTH: Record<ColumnKind, number> = { text: 22, money: 14, date: 12, hours: 12 };

/** Seule fonction d'écriture : classeur .xlsx (en-têtes en gras et figés, filtres automatiques). */
export async function writeWorkbook(sheets: SheetSpec[], created: Date): Promise<Uint8Array<ArrayBuffer>> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Every1.ate OS";
  wb.created = created;
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({ header: c.header, width: c.width ?? DEFAULT_WIDTH[c.kind] }));
    ws.getRow(1).font = { bold: true };
    for (const values of sheet.rows) {
      const row = ws.addRow(values.map((v, i) => excelValue(sheet.columns[i].kind, v)));
      sheet.columns.forEach((c, i) => {
        if (c.kind !== "text") row.getCell(i + 1).numFmt = NUM_FMT[c.kind];
      });
    }
    if (sheet.filter !== false)
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  }
  // Buffer Node (copie) ou ArrayBuffer (vue) selon l'environnement : octets du fichier dans les deux cas.
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

// ─── Chiffrage par l'historique : préparation des repères ───────────────────

/** Ligne de la vue agence (financeOverview) utile au chiffrage. */
export type OverviewProject = {
  id: string;
  name: string;
  templateKey: string | null;
  clientId: string | null;
  status: string;
  startDate: Date | null;
  closedAt: Date | null;
  minutes: number;
  summary: Pick<FinanceSummary, "budgetRevenue" | "billingInvoiced" | "costsCommitted">;
};

/**
 * Projets de la vue agence → historique de chiffrage.
 * Revenu : budget approuvé, à défaut facturé ; coûts : engagés ; durée : début → clôture
 * (connue seulement pour un projet clôturé).
 * « Terminé » se lit sur le statut (Terminé, ou Archivé après sa clôture) : un projet rouvert
 * (TERMINE → ACTIF) garde son ancienne date de clôture mais redevient un projet en cours.
 */
export function historyFromOverview(rows: OverviewProject[]): HistoryProject[] {
  return rows.map((p) => {
    const closed = p.status === "TERMINE" || p.status === "ARCHIVE";
    return {
      id: p.id,
      name: p.name,
      templateKey: p.templateKey,
      clientId: p.clientId,
      revenue: p.summary.budgetRevenue || p.summary.billingInvoiced,
      costs: p.summary.costsCommitted,
      minutes: p.minutes,
      durationDays:
        closed && p.startDate && p.closedAt
          ? Math.max(0, daysBetween(p.startDate, todayDate(p.closedAt)))
          : null,
      closed,
    };
  });
}

export type HistoryPosition = { kind: "dessous" | "dans" | "dessus"; deltaPct: number | null };

/** Position d'un montant par rapport aux repères : sous le plus bas, dans la fourchette, au-dessus. */
export function compareToHistory(value: number | null | undefined, s: Stat): HistoryPosition | null {
  if (!s || value == null || value <= 0) return null;
  return {
    kind: value < s.min ? "dessous" : value > s.max ? "dessus" : "dans",
    deltaPct: s.median ? Math.round(((value - s.median) / s.median) * 100) : null,
  };
}
