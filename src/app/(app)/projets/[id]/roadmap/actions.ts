"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { validationError, keptValues, type FormState } from "@/lib/forms";
import {
  archiveMilestone,
  moveMilestone,
  moveTask,
  previewMove,
  saveMilestone,
} from "@/features/planning/service";

const day = z.string().transform((v, ctx) => {
  const d = parseDateInput(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Date invalide." });
    return z.NEVER;
  }
  return d;
});

export type MovePreviewDTO =
  | {
      ok: true;
      conflicts: { id: string; title: string; message: string }[];
      cascade: { id: string; title: string; from: [string | null, string | null]; to: [string, string] }[];
    }
  | { ok: false; error: string };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Prévisualisation d'un déplacement : conflits et cascade proposée, sans rien écrire. */
export async function previewMoveAction(taskId: string, start: string, due: string): Promise<MovePreviewDTO> {
  await requireUser();
  const s = parseDateInput(start);
  const d = parseDateInput(due);
  if (!s || !d) return { ok: false, error: "Dates invalides." };
  if (d < s) return { ok: false, error: "L'échéance précède la date de début." };
  const plan = await previewMove(taskId, s, d);
  if (!plan) return { ok: false, error: "Tâche introuvable." };
  return {
    ok: true,
    conflicts: plan.conflicts,
    cascade: plan.cascade.map((c) => ({
      id: c.id,
      title: c.title,
      from: [iso(c.from[0]), iso(c.from[1])],
      to: [iso(c.to[0])!, iso(c.to[1])!],
    })),
  };
}

export async function moveTaskAction(taskId: string, start: string, due: string, cascade: boolean) {
  const user = await requireUser();
  const s = parseDateInput(start);
  const d = parseDateInput(due);
  if (!s || !d) return { ok: false as const, error: "Dates invalides." };
  const result = await moveTask(taskId, s, d, cascade, user);
  if (!result.ok) return result;
  revalidatePath(`/projets/${result.data.projectId}/roadmap`);
  revalidatePath(`/taches/${taskId}`);
  return { ok: true as const, moved: result.data.moved };
}

export async function moveMilestoneAction(id: string, date: string) {
  const user = await requireUser();
  const d = parseDateInput(date);
  if (!d) return { ok: false as const, error: "Date invalide." };
  const result = await moveMilestone(id, d, user);
  if (!result.ok) return result;
  revalidatePath(`/projets/${result.data.projectId}/roadmap`);
  return { ok: true as const };
}

const milestoneSchema = z.object({
  projectId: z.string().min(1),
  milestoneId: z.string().optional(),
  name: z.string().trim().min(1, "Nom requis.").max(200),
  date: day,
  workPackageId: z
    .string()
    .optional()
    .transform((v) => v || null),
  reached: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveMilestoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, milestoneId, ...data } = parsed.data;
  const result = await saveMilestone(projectId, milestoneId || null, data, user);
  if (!result.ok) return { status: "error", message: result.error, values: keptValues(formData) };
  revalidatePath(`/projets/${projectId}/roadmap`);
  return { status: "success", message: milestoneId ? "Jalon mis à jour." : "Jalon ajouté." };
}

export async function archiveMilestoneAction(formData: FormData) {
  const user = await requireUser();
  const result = await archiveMilestone(String(formData.get("milestoneId")), user);
  if (result.ok) revalidatePath(`/projets/${result.data.projectId}/roadmap`);
}
