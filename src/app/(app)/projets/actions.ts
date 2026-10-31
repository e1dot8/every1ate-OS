"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  Impact,
  Priority,
  ProjectPhase,
  ProjectStatus,
  Recurrence,
  TaskCategory,
  TaskComplexity,
  TaskStatus,
} from "@/generated/prisma/enums";
import { questNudge } from "@/features/quests/service";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import {
  addDependency,
  changeProjectOwner,
  changeProjectStatus,
  changeTaskStatus,
  checkVerifiedClosureItems,
  createProject,
  removeDependency,
  saveClosingReview,
  saveSatisfaction,
  saveTask,
  saveWorkPackage,
  setArchived,
  toggleClosureItem,
  updateProject,
} from "@/features/projects/service";
import { addComment, deleteComment } from "@/features/planning/service";
import { xpMessage } from "@/features/progression/labels";
import { RECURRENCES, occurrenceCreatedMessage, recurrenceIssue } from "@/features/projects/recurrence";

const PHASES = ["RECETTE", "PREPARATION", "CUISSON", "DRESSAGE", "SERVICE"] as const;
const PROJECT_STATUSES = ["A_PREPARER", "ACTIF", "EN_ATTENTE", "BLOQUE", "TERMINE", "ARCHIVE"] as const;
const TASK_STATUSES = [
  "A_FAIRE",
  "EN_COURS",
  "EN_REVUE",
  "TERMINE",
  "EN_ATTENTE",
  "BLOQUE",
  "ANNULE",
] as const;
const PRIORITIES = ["AUTO", "BASSE", "NORMALE", "HAUTE", "URGENTE"] as const;
const IMPACTS = ["FAIBLE", "MOYEN", "FORT"] as const;
const COMPLEXITIES = ["SIMPLE", "MOYENNE", "COMPLEXE"] as const;
const CATEGORIES = [
  "CLIENT",
  "AGENCE",
  "GESTION",
  "BRANDING",
  "APPRENTISSAGE",
  "ENTRAIDE",
  "RITUEL",
] as const;

const optionalText = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((v) => (v ? v : null));
const dateInput = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d;
  });
const failure = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

// ─── Création de projet (assistant en 3 étapes) ────────────────────────────

const wizardSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  clientId: z.string().nullable().optional(),
  newClientName: z.string().trim().max(200).nullable().optional(),
  ownerId: z.string().min(1, "Responsable global requis."),
  templateKey: z.string().min(1),
  startDate: z.string().min(1, "Date de début requise."),
  plannedEndDate: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  lots: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        tasks: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(300),
              startDate: z.string().nullable(),
              dueDate: z.string().nullable(),
              after: z.string().nullable().optional(),
            }),
          )
          .max(200),
      }),
    )
    .max(50),
});

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { status: "error", message: "Données du formulaire illisibles." };
  }
  const parsed = wizardSchema.safeParse(payload);
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const start = parseDateInput(parsed.data.startDate);
  if (!start) return { status: "error", message: "Date de début invalide." };
  const result = await createProject(
    {
      ...parsed.data,
      startDate: start,
      plannedEndDate: parseDateInput(parsed.data.plannedEndDate),
      lots: parsed.data.lots.map((l) => ({
        name: l.name,
        tasks: l.tasks.map((t) => ({
          title: t.title,
          startDate: parseDateInput(t.startDate),
          dueDate: parseDateInput(t.dueDate),
          after: t.after,
        })),
      })),
    },
    user,
  );
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/projets");
  if (parsed.data.opportunityId) revalidatePath(`/crm/opportunites/${parsed.data.opportunityId}`);
  redirect(`/projets/${result.data.id}${result.data.existing ? "?deja=1" : ""}`);
}

// ─── Projet ─────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Nom requis.").max(200),
  description: optionalText,
  clientId: z
    .string()
    .optional()
    .transform((v) => v || null),
  phase: z.enum(PHASES),
  startDate: dateInput,
  plannedEndDate: dateInput,
});

export async function updateProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, ...data } = parsed.data;
  const result = await updateProject(projectId, { ...data, phase: data.phase as ProjectPhase }, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  redirect(
    `/projets/${projectId}${result.data.pendingDecision ? `?decision=${result.data.pendingDecision}` : ""}`,
  );
}

const statusSchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(PROJECT_STATUSES),
  reason: optionalText,
});

export async function changeProjectStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await changeProjectStatus(
    parsed.data.projectId,
    parsed.data.status as ProjectStatus,
    parsed.data.reason,
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${parsed.data.projectId}`);
  return { status: "success", message: "Statut mis à jour." };
}

const ownerSchema = z.object({
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  reason: z.string().trim().min(1, "Indiquez le motif.").max(1000),
});

export async function changeOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await changeProjectOwner(
    parsed.data.projectId,
    parsed.data.ownerId,
    parsed.data.reason,
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${parsed.data.projectId}`);
  return { status: "success", message: "Responsable global modifié." };
}

export async function toggleClosureAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const itemId = String(formData.get("itemId"));
  await toggleClosureItem(projectId, itemId, formData.get("checked") === "true", null, user);
  revalidatePath(`/projets/${projectId}`);
}

export async function saveReviewAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  await saveClosingReview(projectId, String(formData.get("review") ?? "").slice(0, 10000), user);
  revalidatePath(`/projets/${projectId}`);
}

// ─── Lots ───────────────────────────────────────────────────────────────────

const lotSchema = z.object({
  projectId: z.string().min(1),
  lotId: z.string().optional(),
  name: z.string().trim().min(1, "Nom requis.").max(200),
  description: optionalText,
  ownerId: z
    .string()
    .optional()
    .transform((v) => v || null),
  plannedStart: dateInput,
  plannedEnd: dateInput,
});

export async function saveLotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = lotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, lotId, ...data } = parsed.data;
  const result = await saveWorkPackage(
    projectId,
    lotId || null,
    { ...data, memberIds: formData.getAll("memberIds").map(String) },
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  redirect(`/projets/${projectId}/lots/${result.data.id}`);
}

// ─── Tâches ─────────────────────────────────────────────────────────────────

const taskSchema = z
  .object({
    projectId: z.string().min(1),
    taskId: z.string().optional(),
    title: z.string().trim().min(1, "Titre requis.").max(300),
    description: optionalText,
    workPackageId: z
      .string()
      .optional()
      .transform((v) => v || null),
    ownerId: z
      .string()
      .optional()
      .transform((v) => v || null),
    priority: z.enum(PRIORITIES),
    impact: z.enum(IMPACTS).default("MOYEN"),
    complexity: z.enum(COMPLEXITIES).default("SIMPLE"),
    category: z.enum(CATEGORIES).optional(),
    startDate: dateInput,
    dueDate: dateInput,
    estimatedHours: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 1000)
          ctx.addIssue({ code: "custom", message: "Durée invalide." });
        return Math.round(n * 60);
      }),
    recurrence: z.enum(RECURRENCES).default("AUCUNE"),
    recurrenceUntil: dateInput,
  })
  .superRefine((data, ctx) => {
    // Une tâche répétée a une échéance, et sa fin de répétition ne la précède pas.
    const issue = recurrenceIssue(data);
    if (issue) ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
  });

export async function saveTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { projectId, taskId, estimatedHours, ...data } = parsed.data;
  const result = await saveTask(
    projectId,
    taskId || null,
    {
      ...data,
      priority: data.priority as Priority | "AUTO",
      impact: data.impact as Impact,
      complexity: data.complexity as TaskComplexity,
      category: data.category as TaskCategory | undefined,
      recurrence: data.recurrence as Recurrence,
      estimatedMinutes: estimatedHours,
      contributorIds: formData.getAll("contributorIds").map(String),
    },
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${projectId}`);
  redirect(`/taches/${result.data.id}`);
}

const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  reason: optionalText,
  nextAction: optionalText,
  reviewDate: dateInput,
});

export async function changeTaskStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await changeTaskStatus(
    parsed.data.taskId,
    parsed.data.status as TaskStatus,
    parsed.data,
    user,
  );
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/taches/${parsed.data.taskId}`);
  revalidatePath(`/projets/${result.data.projectId}`);
  const next = result.data.nextOccurrence;
  revalidatePath("/");
  revalidatePath("/progression");
  revalidatePath("/quetes");
  const quest = parsed.data.status === "TERMINE" ? await questNudge(user.id, "tasksDone") : null;
  return {
    status: "success",
    message: [
      "Statut mis à jour.",
      next ? occurrenceCreatedMessage(next.dueDate) : null,
      result.data.xp ? xpMessage(result.data.xp) : null,
      quest,
      result.data.badges.length
        ? `Nouveau badge : ${result.data.badges.map((b) => `« ${b} »`).join(", ")} !`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

const depSchema = z.object({
  taskId: z.string().min(1),
  dependsOnId: z.string().min(1, "Choisissez une tâche."),
});

export async function addDependencyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = depSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await addDependency(parsed.data.taskId, parsed.data.dependsOnId, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/taches/${parsed.data.taskId}`);
  return { status: "success", message: "Dépendance ajoutée." };
}

export async function removeDependencyAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId"));
  await removeDependency(taskId, String(formData.get("dependsOnId")), user);
  revalidatePath(`/taches/${taskId}`);
}

export async function archiveAction(formData: FormData) {
  const user = await requireUser();
  const kind = formData.get("kind") === "lot" ? "lot" : "task";
  const archived = formData.get("archived") === "true";
  const result = await setArchived(kind, String(formData.get("id")), archived, user);
  if (result.ok) {
    revalidatePath(`/projets/${result.data.projectId}`);
    revalidatePath("/plus/archives");
    if (archived) redirect(`/projets/${result.data.projectId}`);
  }
}

export async function restoreProjectAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  await changeProjectStatus(projectId, "TERMINE", null, user);
  revalidatePath("/plus/archives");
  revalidatePath("/projets");
}

// ─── Commentaires ───────────────────────────────────────────────────────────

const commentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1, "Écrivez un commentaire.").max(5000),
});

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await addComment(parsed.data.taskId, parsed.data.body, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/taches/${parsed.data.taskId}`);
  return { status: "success", message: "Commentaire publié." };
}

export async function deleteCommentAction(formData: FormData) {
  const user = await requireUser();
  const result = await deleteComment(String(formData.get("commentId")), user);
  if (result.ok) revalidatePath(`/taches/${result.data.taskId}`);
}

export async function checkVerifiedClosureAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const keys = formData
    .getAll("key")
    .map(String)
    .filter((k) => ["taches", "couts", "facturation", "bilan"].includes(k));
  await checkVerifiedClosureItems(projectId, keys, user);
  revalidatePath(`/projets/${projectId}`);
}

const satisfactionSchema = z.object({
  projectId: z.string().min(1),
  score: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  note: optionalText,
});

export async function saveSatisfactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = satisfactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveSatisfaction(parsed.data.projectId, parsed.data.score, parsed.data.note, user);
  if (!result.ok) return failure(result.error, formData);
  revalidatePath(`/projets/${parsed.data.projectId}`);
  return { status: "success", message: "Satisfaction enregistrée." };
}
