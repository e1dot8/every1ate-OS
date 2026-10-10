"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  BillingKind,
  BillingStatus,
  ContractStatus,
  CostStatus,
  DecisionKind,
  PricingMode,
  VoteChoice,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import {
  announceDecision,
  cancelDecision,
  createDecision,
  saveGovernance,
  vote,
} from "@/features/finance/governance";
import { cancelImport, confirmImport, createDraftImport, saveMapping } from "@/features/finance/imports";
import { FIELDS, type ImportKind } from "@/features/finance/import-rules";
import {
  archiveCost,
  deletePayment,
  proposeBudget,
  recordPayment,
  saveBilling,
  saveContract,
  saveCost,
} from "@/features/finance/service";

const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});
const text = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const date = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d;
  });
const requiredDate = z.string().transform((v, ctx) => {
  const d = parseDateInput(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Date requise." });
    return z.NEVER;
  }
  return d;
});
const money = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) {
        if (required) ctx.addIssue({ code: "custom", message: "Montant requis." });
        return null;
      }
      const cents = parseMoney(v);
      if (cents == null) ctx.addIssue({ code: "custom", message: "Montant invalide (ex. 1 250,00)." });
      return cents;
    });
const optionalId = z
  .string()
  .optional()
  .transform((v) => v || null);
const url = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) ctx.addIssue({ code: "custom", message: "Lien invalide (https://…)." });
    return v;
  });

// ─── Budget ─────────────────────────────────────────────────────────────────

const budgetSchema = z.object({
  projectId: z.string().min(1),
  workPackageId: optionalId,
  revenue: money(true),
  cost: money(true),
  pricingMode: z
    .enum(["FORFAIT", "TEMPS", "FRAIS", ""])
    .optional()
    .transform((v) => (v ? (v as PricingMode) : null)),
  reason: text(1000),
});

export async function proposeBudgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, revenue, cost, ...rest } = parsed.data;
  const result = await proposeBudget(projectId, { ...rest, revenue: revenue!, cost: cost! }, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  return result.data.pendingDecision
    ? { status: "success", message: "Seuil dépassé : la révision attend une décision collective." }
    : { status: "success", message: "Budget enregistré." };
}

// ─── Coûts ──────────────────────────────────────────────────────────────────

const COST_STATUSES = ["PREVU", "ENGAGE", "FACTURE", "PAYE", "ANNULE"] as const;
const costSchema = z.object({
  projectId: z.string().min(1),
  costId: z.string().optional(),
  workPackageId: optionalId,
  supplier: text(200),
  description: z.string().trim().min(1, "Description requise.").max(500),
  category: text(100),
  pricingMode: z.enum(["FORFAIT", "TEMPS", "FRAIS"]).default("FRAIS"),
  quantity: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const n = v.replace(",", ".").trim();
      if (!/^\d{1,9}(\.\d{1,3})?$/.test(n)) ctx.addIssue({ code: "custom", message: "Quantité invalide." });
      return n;
    }),
  unit: text(30),
  unitRate: money(false),
  amount: money(true),
  vatAmount: money(false),
  amountTTC: money(false),
  status: z.enum(COST_STATUSES),
  committedAt: date,
  invoiceDate: date,
  dueDate: date,
  paidAt: date,
  documentRef: text(300),
  rebillable: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveCostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = costSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, costId, amount, ...rest } = parsed.data;
  const result = await saveCost(
    projectId,
    costId || null,
    {
      ...rest,
      amount: amount!,
      status: rest.status as CostStatus,
      pricingMode: rest.pricingMode as PricingMode,
    },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  redirect(`/projets/${projectId}?onglet=finance`);
}

export async function archiveCostAction(formData: FormData) {
  const user = await requireUser();
  const result = await archiveCost(String(formData.get("costId")), user);
  if (result.ok) redirect(`/projets/${result.data.projectId}?onglet=finance`);
}

// ─── Échéancier ─────────────────────────────────────────────────────────────

const billingSchema = z.object({
  projectId: z.string().min(1),
  billingId: z.string().optional(),
  workPackageId: optionalId,
  label: z.string().trim().min(1, "Libellé requis.").max(200),
  kind: z.enum(["ACOMPTE", "INTERMEDIAIRE", "SOLDE", "AUTRE"]),
  plannedDate: date,
  amount: money(true),
  vatAmount: money(false),
  status: z.enum(["ATTENDU", "FACTURE", "ANNULE"]),
  invoiceRef: text(100),
  invoiceUrl: url,
  invoicedAt: date,
});

export async function saveBillingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = billingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, billingId, amount, ...rest } = parsed.data;
  const result = await saveBilling(
    projectId,
    billingId || null,
    { ...rest, amount: amount!, kind: rest.kind as BillingKind, status: rest.status as BillingStatus },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  redirect(`/projets/${projectId}?onglet=finance`);
}

const paymentSchema = z.object({
  projectId: z.string().min(1),
  billingMilestoneId: optionalId,
  amount: money(true),
  receivedAt: requiredDate,
  reference: text(200),
});

export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, amount, ...rest } = parsed.data;
  const result = await recordPayment(projectId, { ...rest, amount: amount! }, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  if (rest.billingMilestoneId) revalidatePath(`/finance/echeances/${rest.billingMilestoneId}`);
  return { status: "success", message: "Encaissement enregistré." };
}

export async function deletePaymentAction(formData: FormData) {
  const user = await requireUser();
  const result = await deletePayment(String(formData.get("paymentId")), user);
  if (result.ok) {
    revalidatePath(`/projets/${result.data.projectId}`);
    const back = String(formData.get("back") ?? "");
    if (back.startsWith("/finance/") || back.startsWith("/projets/")) redirect(back);
  }
}

// ─── Contrats récurrents ────────────────────────────────────────────────────

const contractSchema = z.object({
  contractId: z.string().optional(),
  clientId: z.string().min(1, "Choisissez le client."),
  projectId: optionalId,
  label: z.string().trim().min(1, "Libellé requis.").max(200),
  monthlyAmount: money(true),
  startDate: requiredDate,
  endDate: date,
  durationMonths: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1).max(240).nullable()),
  status: z.enum(["BROUILLON", "ACTIF", "SUSPENDU", "RESILIE", "TERMINE"]),
  renewalDate: date,
  noticeDays: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(365).nullable()),
  notes: text(2000),
});

export async function saveContractAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { contractId, monthlyAmount, ...rest } = parsed.data;
  const result = await saveContract(
    contractId || null,
    { ...rest, monthlyAmount: monthlyAmount!, status: rest.status as ContractStatus },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/finance");
  redirect("/finance?onglet=contrats");
}

// ─── Gouvernance ────────────────────────────────────────────────────────────

const pct = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .pipe(z.number().int("Nombre entier.").min(0).max(1000).nullable());

const governanceSchema = z.object({
  budgetOverrunPct: pct,
  delayPct: pct,
  delayMinDays: pct,
  requiredApprovals: z.coerce.number().int().min(1),
  blocking: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveGovernanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = governanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveGovernance(parsed.data, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/gouvernance");
  return { status: "success", message: "Règles enregistrées et journalisées." };
}

const decisionSchema = z.object({
  projectId: z.string().min(1, "Choisissez le projet."),
  title: z.string().trim().min(1, "Titre requis.").max(200),
  explanation: z.string().trim().min(1, "Expliquez le changement.").max(5000),
  before: text(2000),
  after: text(2000),
  consequences: text(2000),
});

export async function requestDecisionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { before, after, ...rest } = parsed.data;
  const d = await createDecision(
    {
      ...rest,
      kind: "PERIMETRE" as DecisionKind,
      before: { description: before },
      after: { description: after },
    },
    user,
  );
  await announceDecision(d.id, user);
  redirect(`/gouvernance/${d.id}`);
}

const voteSchema = z.object({
  decisionId: z.string().min(1),
  choice: z.enum(["POUR", "CONTRE", "ABSTENTION"]),
  comment: text(2000),
});

export async function voteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = voteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await vote(
    parsed.data.decisionId,
    parsed.data.choice as VoteChoice,
    parsed.data.comment,
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/gouvernance/${parsed.data.decisionId}`);
  revalidatePath("/gouvernance");
  const labels: Record<string, string> = {
    OUVERTE: "Avis enregistré.",
    APPROUVEE: "Avis enregistré : décision approuvée.",
    REFUSEE: "Avis enregistré : décision refusée.",
  };
  return { status: "success", message: labels[result.data.status] };
}

export async function cancelDecisionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("decisionId"));
  await cancelDecision(id, user);
  revalidatePath(`/gouvernance/${id}`);
}

// ─── Imports ────────────────────────────────────────────────────────────────

export async function uploadImportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    return { status: "error", message: "Choisissez un fichier CSV ou Excel." };
  const result = await createDraftImport(file, user);
  if (!result.ok) return { status: "error", message: result.error };
  redirect(`/finance/imports/${result.data.id}`);
}

export async function saveMappingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("importId"));
  const kind = formData.get("kind");
  const projectId = String(formData.get("projectId") ?? "");
  if (kind !== "COUTS" && kind !== "ENCAISSEMENTS") return fail("Choisissez le type d'import.", formData);
  if (!projectId) return fail("Choisissez le projet concerné.", formData);
  const mapping: Record<string, number | null> = {};
  for (const f of FIELDS[kind as ImportKind]) {
    const v = formData.get(`col_${f.key}`);
    mapping[f.key] = v === null || v === "" ? null : Number(v);
  }
  const missing = FIELDS[kind as ImportKind].filter((f) => f.required && mapping[f.key] == null);
  if (missing.length)
    return fail(`Associez les colonnes obligatoires : ${missing.map((f) => f.label).join(", ")}.`, formData);
  const result = await saveMapping(id, kind as ImportKind, projectId, mapping, user);
  if (!result.ok) return fail(result.error, formData);
  redirect(`/finance/imports/${id}?etape=apercu`);
}

export async function confirmImportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("importId"));
  if (formData.get("confirm") !== "on")
    return { status: "error", message: "Cochez la case de confirmation." };
  const result = await confirmImport(id, formData.get("includeDuplicates") === "on", user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/finance");
  redirect(`/finance/imports/${id}`);
}

export async function cancelImportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("importId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { status: "error", message: "Indiquez le motif de l'annulation." };
  const result = await cancelImport(id, reason, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/finance");
  redirect(`/finance/imports/${id}`);
}
