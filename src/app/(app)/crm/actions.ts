"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActivityKind, LeadSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import { STAGES, type Stage } from "@/features/crm/rules";
import {
  addActivity,
  archiveContact,
  archiveOpportunity,
  changeStage,
  saveClient,
  saveContact,
  saveOpportunity,
  saveStageSettings,
  setNextAction,
} from "@/features/crm/service";

const text = (max = 2000) =>
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
const url = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      const u = new URL(v);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Lien invalide (https://…)." });
      return null;
    }
  });
const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

// ─── Entreprises ────────────────────────────────────────────────────────────

const clientSchema = z.object({
  clientId: z.string().optional(),
  name: z.string().trim().min(1, "Nom requis.").max(200),
  website: url,
  sector: text(200),
  address: text(500),
  notes: text(5000),
});

export async function saveClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { clientId, ...data } = parsed.data;
  const result = await saveClient(clientId || null, data, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/crm/clients");
  redirect(`/crm/clients/${result.data.id}`);
}

const contactSchema = z.object({
  clientId: z.string().min(1),
  contactId: z.string().optional(),
  firstName: z.string().trim().min(1, "Prénom requis.").max(100),
  lastName: z.string().trim().min(1, "Nom requis.").max(100),
  role: text(200),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(z.email("Adresse e-mail invalide.").nullable()),
  phone: text(50),
  notes: text(2000),
});

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { clientId, contactId, ...data } = parsed.data;
  const result = await saveContact(clientId, contactId || null, data, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/crm/clients/${clientId}`);
  redirect(`/crm/clients/${clientId}`);
}

export async function archiveContactAction(formData: FormData) {
  const user = await requireUser();
  const result = await archiveContact(String(formData.get("contactId")), user);
  if (result.ok) redirect(`/crm/clients/${result.data.clientId}`);
}

// ─── Opportunités ───────────────────────────────────────────────────────────

const SOURCES = ["OUTBOUND", "INBOUND", "RECOMMANDATION", "RESEAU", "PARTENAIRE"] as const;

const oppSchema = z.object({
  opportunityId: z.string().optional(),
  title: z.string().trim().min(1, "Intitulé requis.").max(200),
  clientId: z.string().min(1, "Choisissez l'entreprise."),
  contactId: z
    .string()
    .optional()
    .transform((v) => v || null),
  ownerId: z.string().min(1, "Responsable commercial requis."),
  source: z
    .enum(SOURCES)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? (v as LeadSource) : null)),
  amount: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const cents = parseMoney(v);
      if (cents == null)
        ctx.addIssue({ code: "custom", message: "Montant invalide (ex. 12 500 ou 12500,50)." });
      return cents;
    }),
  probability: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100)
        ctx.addIssue({ code: "custom", message: "Entre 0 et 100." });
      return n;
    }),
  expectedCloseDate: date,
  nextAction: text(500),
  nextActionDate: date,
});

export async function saveOpportunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = oppSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { opportunityId, amount, ...data } = parsed.data;
  const result = await saveOpportunity(opportunityId || null, { ...data, amountCents: amount }, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/crm");
  redirect(`/crm/opportunites/${result.data.id}`);
}

const stageSchema = z.object({
  opportunityId: z.string().min(1),
  stage: z.enum(STAGES),
  lossReason: text(1000),
  note: text(2000),
});

export async function changeStageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await changeStage(parsed.data.opportunityId, parsed.data.stage as Stage, parsed.data, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/crm/opportunites/${parsed.data.opportunityId}`);
  revalidatePath("/crm");
  return { status: "success", message: "Étape mise à jour." };
}

const KINDS = ["ECHANGE", "REUNION", "PROPOSITION", "NOTE", "RELANCE"] as const;
const activitySchema = z.object({
  opportunityId: z.string().min(1),
  kind: z.enum(KINDS),
  body: z.string().trim().min(1, "Décrivez l'échange.").max(5000),
  occurredAt: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return new Date();
      const d = parseDateInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
      return d ?? new Date();
    }),
  fileUrl: url,
});

export async function addActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { opportunityId, ...data } = parsed.data;
  const result = await addActivity(opportunityId, { ...data, kind: data.kind as ActivityKind }, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/crm/opportunites/${opportunityId}`);
  return { status: "success", message: "Ajouté à l'historique." };
}

const nextSchema = z.object({
  opportunityId: z.string().min(1),
  nextAction: text(500),
  nextActionDate: date,
});

export async function setNextActionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = nextSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await setNextAction(parsed.data.opportunityId, parsed.data, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(`/crm/opportunites/${parsed.data.opportunityId}`);
  revalidatePath("/crm");
  return { status: "success", message: "Prochaine action enregistrée." };
}

export async function archiveOpportunityAction(formData: FormData) {
  const user = await requireUser();
  await archiveOpportunity(String(formData.get("opportunityId")), user);
  revalidatePath("/crm");
  redirect("/crm");
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values: Partial<Record<Stage, number>> = {};
  for (const stage of STAGES) {
    const raw = formData.get(stage);
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100)
      return {
        status: "error",
        message: "Chaque probabilité doit être un entier entre 0 et 100.",
        values: keptValues(formData),
      };
    values[stage] = n;
  }
  const result = await saveStageSettings(values, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/crm");
  return { status: "success", message: "Probabilités enregistrées." };
}
