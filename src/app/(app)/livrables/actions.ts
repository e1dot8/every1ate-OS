"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { BLOCK_REASON_MIN, FORMATS, STAGES, WORK_STAGES, isHttpsUrl } from "@/features/deliverables/rules";
import {
  addCheckItem,
  assignCheckItem,
  blockDeliverable,
  changeDeliverableStage,
  createDeliverable,
  deleteCheckItem,
  moveCheckItem,
  renameCheckItem,
  saveDeliverableNotes,
  setDeliverableArchived,
  toggleCheckItem,
  unblockDeliverable,
  updateDeliverable,
} from "@/features/deliverables/service";

const id = z.string().trim().min(1).max(100);
const optionalId = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => v || null);
const dateInput = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d;
  });

const failure = (message: string, formData: FormData): FormState => ({
  status: "error",
  message,
  values: keptValues(formData),
});

/** Tout ce qui affiche des livrables : la base, la page, le projet, l'accueil (brief, « Mes livrables »). */
function refresh(projectIds: (string | null | undefined)[], deliverableId?: string) {
  revalidatePath("/livrables");
  if (deliverableId) revalidatePath(`/livrables/${deliverableId}`);
  for (const projectId of new Set(projectIds.filter(Boolean))) revalidatePath(`/projets/${projectId}`);
  revalidatePath("/");
}

// ─── Livrable ───────────────────────────────────────────────────────────────

const deliverableSchema = z.object({
  projectId: z.string().trim().min(1, "Choisissez un projet.").max(100),
  workPackageId: optionalId,
  title: z.string().trim().min(1, "Titre requis.").max(200, "200 caractères maximum."),
  format: z.enum(FORMATS, "Format invalide."),
  channel: optionalText(80),
  ownerId: optionalId,
  dueDate: dateInput,
  publishDate: dateInput,
  link: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || isHttpsUrl(v), "Le lien doit commencer par https://"),
  notes: optionalText(10000),
});

export async function createDeliverableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = deliverableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await createDeliverable(parsed.data, user);
  if (!result.ok) return failure(result.error, formData);
  refresh([result.data.projectId]);
  redirect(`/livrables/${result.data.id}`);
}

export async function updateDeliverableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = deliverableSchema.extend({ deliverableId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { deliverableId, ...data } = parsed.data;
  const result = await updateDeliverable(deliverableId, data, user);
  if (!result.ok) return failure(result.error, formData);
  refresh([result.data.projectId, result.data.previousProjectId], deliverableId);
  redirect(`/livrables/${deliverableId}`);
}

const notesSchema = z.object({ deliverableId: id, notes: optionalText(10000) });

export async function saveNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = notesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveDeliverableNotes(parsed.data.deliverableId, parsed.data.notes, user);
  if (!result.ok) return failure(result.error, formData);
  refresh([result.data.projectId], parsed.data.deliverableId);
  return { status: "success", message: "Notes enregistrées." };
}

const archiveSchema = z.object({ deliverableId: id, archived: z.enum(["true", "false"]) });

export async function archiveDeliverableAction(formData: FormData) {
  const user = await requireUser();
  const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const archived = parsed.data.archived === "true";
  const result = await setDeliverableArchived(parsed.data.deliverableId, archived, user);
  if (!result.ok) return;
  refresh([result.data.projectId], parsed.data.deliverableId);
  if (archived) redirect("/livrables");
}

// ─── Étapes et blocage ──────────────────────────────────────────────────────

const stageSchema = z.object({ deliverableId: id, stage: z.enum(STAGES) });

export async function changeStageAction(formData: FormData) {
  const user = await requireUser();
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await changeDeliverableStage(parsed.data.deliverableId, parsed.data.stage, user);
  if (result.ok) refresh([result.data.projectId], parsed.data.deliverableId);
}

const blockSchema = z.object({
  deliverableId: id,
  reason: z
    .string()
    .trim()
    .min(BLOCK_REASON_MIN, "Indiquez le motif du blocage (3 caractères minimum).")
    .max(500, "500 caractères maximum."),
});

export async function blockDeliverableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await blockDeliverable(parsed.data.deliverableId, parsed.data.reason, user);
  if (!result.ok) return failure(result.error, formData);
  refresh([result.data.projectId], parsed.data.deliverableId);
  return { status: "success", message: "Livrable bloqué : l'équipe est prévenue." };
}

const deliverableOnly = z.object({ deliverableId: id });

export async function unblockDeliverableAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deliverableOnly.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await unblockDeliverable(parsed.data.deliverableId, user);
  if (result.ok) refresh([result.data.projectId], parsed.data.deliverableId);
}

// ─── Checklist ──────────────────────────────────────────────────────────────

const toggleSchema = z.object({ itemId: id, checked: z.enum(["true", "false"]) });

export async function toggleCheckItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await toggleCheckItem(parsed.data.itemId, parsed.data.checked === "true", user);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}

const addItemSchema = z.object({
  deliverableId: id,
  stage: z.enum(WORK_STAGES),
  label: z.string().trim().min(1, "Libellé requis.").max(200, "200 caractères maximum."),
});

export async function addCheckItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = addItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await addCheckItem(parsed.data.deliverableId, parsed.data.stage, parsed.data.label, user);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}

const renameSchema = z.object({
  itemId: id,
  label: z.string().trim().min(1, "Libellé requis.").max(200, "200 caractères maximum."),
});

export async function renameCheckItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = renameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await renameCheckItem(parsed.data.itemId, parsed.data.label, user);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}

const itemOnly = z.object({ itemId: id });

export async function deleteCheckItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = itemOnly.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await deleteCheckItem(parsed.data.itemId, user);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}

const moveSchema = z.object({ itemId: id, direction: z.enum(["up", "down"]) });

export async function moveCheckItemAction(formData: FormData) {
  await requireUser();
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await moveCheckItem(parsed.data.itemId, parsed.data.direction);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}

const assignSchema = z.object({ itemId: id, assigneeId: optionalId, dueDate: dateInput });

export async function assignCheckItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = assignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const result = await assignCheckItem(parsed.data.itemId, parsed.data.assigneeId, parsed.data.dueDate, user);
  if (result.ok) refresh([result.data.projectId], result.data.deliverableId);
}
