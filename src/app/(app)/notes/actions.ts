"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { archiveNote, createTasksFromNote, saveNote, type NoteActionInput } from "@/features/notes/service";
import { tasksCreatedLabel, type ActionsFormState } from "@/features/notes/rules";

const optionalId = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || null);
const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d;
  });
const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

// ─── Compte rendu ───────────────────────────────────────────────────────────

const noteSchema = z.object({
  noteId: z.string().optional(),
  title: z.string().trim().min(1, "Titre requis.").max(200),
  occurredAt: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const d = parseDateInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Date invalide." });
        return z.NEVER;
      }
      return d;
    }),
  body: z
    .string()
    .max(20000, "Compte rendu trop long (20 000 caractères au plus).")
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1, "Écrivez le compte rendu.")),
  projectId: optionalId,
  clientId: optionalId,
  opportunityId: optionalId,
  eventId: optionalId,
});

export async function saveNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { noteId, ...input } = parsed.data;
  const result = await saveNote(noteId || null, input, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/notes");
  if (input.projectId) revalidatePath(`/projets/${input.projectId}`);
  if (input.clientId) revalidatePath(`/crm/clients/${input.clientId}`);
  if (input.opportunityId) revalidatePath(`/crm/opportunites/${input.opportunityId}`);
  if (input.eventId) revalidatePath(`/calendrier/${input.eventId}`);
  redirect(`/notes/${result.data.id}`);
}

export async function archiveNoteAction(formData: FormData) {
  await requireUser();
  const noteId = z.string().min(1).max(100).safeParse(formData.get("noteId"));
  if (!noteId.success) return;
  const result = await archiveNote(noteId.data);
  if (!result.ok) return;
  revalidatePath("/notes");
  redirect("/notes");
}

// ─── Actions détectées → tâches ─────────────────────────────────────────────

const MAX_ROWS = 100;
const rowSchema = z.object({
  line: z.coerce.number().int().min(1).max(100_000),
  raw: z.string().max(5000),
  title: z.string().trim().min(1, "Titre requis.").max(300),
  ownerId: optionalId,
  dueDate: optionalDate,
  projectId: optionalId,
});

export async function createTasksFromNoteAction(
  _prev: ActionsFormState,
  formData: FormData,
): Promise<ActionsFormState> {
  const user = await requireUser();
  const note = z.string().trim().min(1).max(100).safeParse(formData.get("noteId"));
  if (!note.success) return { status: "error", message: "Compte rendu introuvable." };
  const noteId = note.data;
  const count = Math.min(MAX_ROWS, Math.max(0, Math.trunc(Number(formData.get("count"))) || 0));

  const actions: NoteActionInput[] = [];
  const fieldErrors: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    if (formData.get(`a${i}_selected`) !== "on") continue;
    const parsed = rowSchema.safeParse({
      line: formData.get(`a${i}_line`),
      raw: formData.get(`a${i}_raw`) ?? "",
      title: formData.get(`a${i}_title`) ?? "",
      ownerId: formData.get(`a${i}_ownerId`) ?? undefined,
      dueDate: formData.get(`a${i}_dueDate`) ?? undefined,
      projectId: formData.get(`a${i}_projectId`) ?? undefined,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        fieldErrors[`a${i}_${String(issue.path[0])}`] ??= issue.message;
      continue;
    }
    actions.push(parsed.data);
  }
  if (Object.keys(fieldErrors).length)
    return {
      status: "error",
      message: "Corrigez les champs signalés.",
      fieldErrors,
      values: keptValues(formData),
    };
  if (!actions.length) return fail("Cochez au moins une action.", formData);

  const result = await createTasksFromNote(noteId, actions, user);
  if (!result.ok) {
    // Le compte rendu a pu changer entre-temps : la page repropose les actions à jour.
    revalidatePath(`/notes/${noteId}`);
    return fail(result.error, formData);
  }
  const { created } = result.data;
  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/notes");
  revalidatePath("/taches");
  for (const projectId of new Set(created.map((t) => t.projectId))) revalidatePath(`/projets/${projectId}`);
  if (!created.length)
    return { status: "success", message: "Ces actions ont déjà été transformées en tâches.", created: [] };
  return {
    status: "success",
    message: `${tasksCreatedLabel(created.length)}.`,
    created: created.map(({ id, title }) => ({ id, title })),
  };
}
