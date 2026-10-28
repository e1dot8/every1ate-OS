"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { validationError, type FormState } from "@/lib/forms";
import {
  addWeeklyItem,
  openWeek,
  removeWeeklyItem,
  saveWeekNotes,
  setWeeklyItemStatus,
  validateWeek,
} from "@/features/briefing/service";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const refresh = () => {
  revalidatePath("/service");
  revalidatePath("/");
};

export async function openWeekAction(formData: FormData) {
  const user = await requireUser();
  const week = parseDateInput(String(formData.get("weekStart") ?? ""));
  if (!week) return;
  await openWeek(week, user);
  refresh();
}

const itemSchema = z.object({
  briefingId: z.string().min(1),
  kind: z.enum(["OBJECTIF", "BLOCAGE", "DECISION", "ACTION"]),
  title: z.string().trim().min(1, "Un intitulé, même court.").max(300),
  detail: optional(1000),
  ownerId: optional(64),
  dueDate: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = parseDateInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
      return d;
    }),
});

export async function addWeeklyItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { briefingId, ...input } = parsed.data;
  const result = await addWeeklyItem(briefingId, input, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "success", message: "Ajouté au menu." };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OUVERT", "ATTEINT", "NON_ATTEINT", "FAIT"]),
});

export async function setWeeklyItemStatusAction(formData: FormData) {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setWeeklyItemStatus(parsed.data.id, parsed.data.status, user);
  refresh();
}

export async function removeWeeklyItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await removeWeeklyItem(id, user);
  refresh();
}

const notesSchema = z.object({
  briefingId: z.string().min(1),
  progressFocus: optional(300),
  notes: optional(5000),
});

export async function saveWeekNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = notesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { briefingId, ...input } = parsed.data;
  const result = await saveWeekNotes(briefingId, input, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "success", message: "Notes enregistrées." };
}

export async function validateWeekAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("briefingId") ?? "");
  if (id) await validateWeek(id, user);
  refresh();
}
