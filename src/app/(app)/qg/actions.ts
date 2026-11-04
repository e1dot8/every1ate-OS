"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { changeTaskStatus } from "@/features/projects/service";
import { PRESENCE_CHOICES, PRESENCE_NOTE_MAX, presenceFromChoice } from "@/features/presence/rules";
import { setPresence } from "@/features/presence/service";
import { acceptHandoff, cancelHandoff, proposeHandoff, refuseHandoff } from "@/features/qg/handoffs";
import { HANDOFF_ANSWER_MAX, HANDOFF_NOTE_MAX } from "@/features/qg/handoff-rules";
import { takeTask } from "@/features/qg/service";
import { saveStandup } from "@/features/qg/standup";

const failure = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));

const id = z.string().trim().min(1).max(64);

// ─── Passations ─────────────────────────────────────────────────────────────

const proposeSchema = z.object({
  target: z.enum(["task", "opportunity"]),
  targetId: id,
  mode: z.enum(["DONNER", "REPRENDRE"]),
  toId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  note: optionalText(HANDOFF_NOTE_MAX, "Note trop longue (1 000 caractères)."),
});

export async function proposeHandoffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = proposeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  if (parsed.data.mode === "DONNER" && !parsed.data.toId)
    return { ...failure("Choisissez à qui passer la main.", formData), fieldErrors: { toId: "Choisissez un associé." } };
  const { target, targetId, mode, toId, note } = parsed.data;
  const result = await proposeHandoff(
    { target: target === "task" ? { taskId: targetId } : { opportunityId: targetId }, mode, toId, note },
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/");
  revalidatePath(target === "task" ? `/taches/${targetId}` : `/crm/opportunites/${targetId}`);
  return {
    status: "success",
    message:
      mode === "DONNER"
        ? "Passation proposée : elle changera de main dès son acceptation."
        : "Demande envoyée : le responsable actuel doit accepter.",
  };
}

const answerSchema = z.object({
  handoffId: id,
  decision: z.enum(["accepter", "refuser"]),
  answer: optionalText(HANDOFF_ANSWER_MAX, "Réponse trop longue (500 caractères)."),
  nextAction: optionalText(300, "Prochaine action trop longue (300 caractères)."),
  nextActionDate: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = parseDateInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
      return d;
    }),
});

export async function answerHandoffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { handoffId, decision, answer, nextAction, nextActionDate } = parsed.data;
  if (decision === "refuser") {
    const result = await refuseHandoff(handoffId, answer, user);
    if (!result.ok) return failure(result.error, formData);
    revalidatePath("/");
    return { status: "success", message: "Réponse envoyée." };
  }
  const result = await acceptHandoff(handoffId, { nextAction, nextActionDate }, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/");
  revalidatePath(result.data.href);
  return { status: "success", message: "Passation acceptée : c'est à vous." };
}

export async function cancelHandoffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ handoffId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await cancelHandoff(parsed.data.handoffId, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/", "layout");
  return { status: "success", message: "Proposition annulée." };
}

// ─── À prendre ──────────────────────────────────────────────────────────────

export async function takeTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ taskId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await takeTask(parsed.data.taskId, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/");
  revalidatePath(`/taches/${parsed.data.taskId}`);
  revalidatePath(`/projets/${result.data.projectId}`);
  return { status: "success", message: "C'est à vous." };
}

// ─── Stand-up ───────────────────────────────────────────────────────────────

const standupSchema = z.object({
  today: optionalText(1000, "Texte trop long (1 000 caractères)."),
  blocked: optionalText(1000, "Texte trop long (1 000 caractères)."),
});

export async function saveStandupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = standupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveStandup(user, parsed.data);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/qg/standup");
  revalidatePath("/");
  return { status: "success", message: "Stand-up publié." };
}

// ─── Grand ménage ───────────────────────────────────────────────────────────

const VERDICTS = ["TERMINE", "EN_ATTENTE", "BLOQUE", "ANNULE"] as const;

const menageSchema = z.object({
  taskId: id,
  verdict: z.enum(VERDICTS),
  reason: optionalText(500, "Motif trop long (500 caractères)."),
});

export async function menageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = menageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { taskId, verdict, reason } = parsed.data;
  if (verdict !== "TERMINE" && (reason?.length ?? 0) < 3)
    return {
      ...failure("Indiquez le motif (visible dans l'historique de la tâche).", formData),
      fieldErrors: { reason: "Motif requis." },
    };
  const result = await changeTaskStatus(
    taskId,
    verdict,
    { reason: verdict === "TERMINE" ? null : reason, nextAction: null, reviewDate: null },
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/qg/menage");
  revalidatePath("/");
  revalidatePath(`/taches/${taskId}`);
  revalidatePath(`/projets/${result.data.projectId}`);
  const labels = { TERMINE: "Terminée.", EN_ATTENTE: "Mise en attente.", BLOQUE: "Bloquée.", ANNULE: "Annulée." };
  return { status: "success", message: labels[verdict] };
}

// ─── Présence ───────────────────────────────────────────────────────────────

const presenceSchema = z.object({
  choice: z.enum(PRESENCE_CHOICES.map((c) => c.key) as [string, ...string[]]),
  note: optionalText(PRESENCE_NOTE_MAX, `Statut trop long (${PRESENCE_NOTE_MAX} caractères).`),
  shared: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

/** Statut choisi par l'associé : ni journal, ni historique (garde-fou anti-surveillance). */
export async function setPresenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = presenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const choice = PRESENCE_CHOICES.find((c) => c.key === parsed.data.choice)!;
  const { state, until } = presenceFromChoice(choice.key, new Date());
  const result = await setPresence(user.id, {
    state,
    until,
    note: parsed.data.note,
    shared: parsed.data.shared,
  });
  if (!result.ok) return failure(result.error, formData);
  revalidatePath("/", "layout");
  return { status: "success", message: `Statut : ${choice.label}.` };
}
