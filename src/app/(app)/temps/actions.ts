"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseDuration } from "@/features/planning/rules";
import { addManualEntry, correctEntry, deleteEntry, startTimer, stopTimer } from "@/features/time/service";

export type TimerState = {
  status: "idle" | "error" | "conflict" | "success";
  message?: string;
  taskId?: string;
};

function refresh(taskId?: string) {
  revalidatePath("/", "layout");
  if (taskId) revalidatePath(`/taches/${taskId}`);
}

/** Démarrer : si un autre chronomètre tourne, renvoie « conflict » et attend la confirmation (force). */
export async function startTimerAction(_prev: TimerState, formData: FormData): Promise<TimerState> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const force = formData.get("force") === "true";
  const result = await startTimer(taskId, force, user);
  if (!result.ok) {
    if ("conflict" in result) return { status: "conflict", message: result.error, taskId };
    return { status: "error", message: result.error };
  }
  refresh(taskId);
  return { status: "success", message: "Chronomètre démarré." };
}

export async function stopTimerAction(formData: FormData) {
  const user = await requireUser();
  await stopTimer(user);
  refresh(String(formData.get("taskId") ?? "") || undefined);
}

const durationField = z.string().transform((v, ctx) => {
  const m = parseDuration(v);
  if (m == null) {
    ctx.addIssue({ code: "custom", message: "Durée illisible (ex. 1h30, 45, 2)." });
    return z.NEVER;
  }
  return m;
});
const dateField = z.string().transform((v, ctx) => {
  const d = parseDateInput(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Date invalide." });
    return z.NEVER;
  }
  return d;
});
const comment = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => v || null);

const manualSchema = z.object({
  taskId: z.string().min(1, "Choisissez une tâche."),
  date: dateField,
  duration: durationField,
  comment,
});

export async function addTimeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await addManualEntry({ ...parsed.data, minutes: parsed.data.duration }, user);
  if (!result.ok) return { status: "error", message: result.error, values: keptValues(formData) };
  refresh(parsed.data.taskId);
  return { status: "success", message: "Temps ajouté." };
}

const correctSchema = z.object({
  entryId: z.string().min(1),
  date: dateField,
  duration: durationField,
  comment,
  reason: comment,
});

export async function correctTimeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = correctSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await correctEntry(
    parsed.data.entryId,
    { ...parsed.data, minutes: parsed.data.duration },
    user,
  );
  if (!result.ok) return { status: "error", message: result.error, values: keptValues(formData) };
  refresh();
  redirect("/temps");
}

export async function deleteTimeAction(formData: FormData) {
  const user = await requireUser();
  await deleteEntry(String(formData.get("entryId")), user);
  refresh();
  redirect("/temps");
}
