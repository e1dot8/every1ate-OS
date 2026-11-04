import type { ProjectStatus, TaskStatus } from "@/generated/prisma/enums";

export type RuleResult = { ok: true } | { ok: false; error: string };
const ok: RuleResult = { ok: true };
const fail = (error: string): RuleResult => ({ ok: false, error });

/** Transitions de statut d'un projet (§6.2), documentées dans docs/regles-metier.md. */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  A_PREPARER: ["ACTIF", "EN_ATTENTE", "BLOQUE"],
  ACTIF: ["EN_ATTENTE", "BLOQUE", "TERMINE"],
  EN_ATTENTE: ["ACTIF", "BLOQUE"],
  BLOQUE: ["ACTIF", "EN_ATTENTE"],
  TERMINE: ["ACTIF", "ARCHIVE"],
  ARCHIVE: ["TERMINE"],
};

export function checkProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  context: { reason?: string | null; closureComplete: boolean; actorIsOwner: boolean },
): RuleResult {
  if (from === to) return ok;
  if (!PROJECT_TRANSITIONS[from].includes(to)) return fail("Ce changement de statut n'est pas autorisé.");
  if ((to === "BLOQUE" || to === "EN_ATTENTE") && !context.reason?.trim()) return fail("Indiquez la raison.");
  if (to === "TERMINE" && from === "ARCHIVE") return ok; // restauration depuis les archives
  if (to === "TERMINE") {
    if (!context.closureComplete) return fail("La checklist de clôture doit être complète.");
    if (!context.actorIsOwner) return fail("Seul le responsable global peut confirmer la clôture.");
  }
  return ok;
}

export const TASK_DONE_STATES: TaskStatus[] = ["TERMINE", "ANNULE"];

/** Transitions de statut d'une tâche (§6.3). */
export function checkTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
  context: { reason?: string | null; unfinishedPredecessors: string[] },
): RuleResult {
  if (from === to) return ok;
  if (to === "BLOQUE" && !context.reason?.trim()) return fail("Indiquez la raison du blocage.");
  if (to === "ANNULE" && !context.reason?.trim()) return fail("Indiquez pourquoi la tâche est annulée.");
  if (to === "TERMINE" && context.unfinishedPredecessors.length > 0) {
    return fail(`Terminez d'abord : ${context.unfinishedPredecessors.join(", ")}.`);
  }
  return ok;
}

/** Statuts qui occupent une place du « bureau » (limite de tâches en cours, V1.2). */
export const WIP_STATES: TaskStatus[] = ["EN_COURS", "BLOQUE"];
/** Longueur minimale du motif de dépassement (visible de tous). */
export const WIP_REASON_MIN = 5;

export type WipCheck =
  | { ok: true; override: boolean }
  | { ok: false; error: string; needsReason: true };

/**
 * Limite d'en-cours (« bureau à N places ») : passer une tâche « En cours » alors que son
 * responsable occupe déjà `limit` places (tâches en cours + bloquées, hors celle-ci) est refusé,
 * sauf avec un motif d'au moins 5 caractères. Une tâche qui occupe déjà une place (bloquée qui
 * reprend) ou sans responsable n'est jamais refusée.
 */
export function checkWipLimit(input: {
  from: TaskStatus;
  to: TaskStatus;
  hasOwner: boolean;
  /** Places occupées par le responsable, sans compter cette tâche. */
  occupied: number;
  limit: number;
  reason?: string | null;
}): WipCheck {
  if (input.to !== "EN_COURS" || WIP_STATES.includes(input.from) || !input.hasOwner)
    return { ok: true, override: false };
  if (input.occupied < input.limit) return { ok: true, override: false };
  const reason = input.reason?.trim() ?? "";
  if (reason.length >= WIP_REASON_MIN) return { ok: true, override: true };
  return {
    ok: false,
    needsReason: true,
    error: reason
      ? `Motif trop court : ${WIP_REASON_MIN} caractères minimum.`
      : `Bureau plein (${input.occupied}/${input.limit}) : terminez ou passez une tâche avant d'en commencer une autre, ou indiquez un motif (visible de tous).`,
  };
}

export type DependencyEdge = { taskId: string; dependsOnId: string };

/**
 * Ajouter « taskId attend dependsOnId » crée une boucle si dependsOnId attend déjà taskId,
 * directement ou indirectement. Renvoie le chemin de la boucle (ids), ou null.
 */
export function findDependencyCycle(
  edges: DependencyEdge[],
  taskId: string,
  dependsOnId: string,
): string[] | null {
  if (taskId === dependsOnId) return [taskId, taskId];
  const waitsOn = new Map<string, string[]>();
  for (const e of edges) waitsOn.set(e.taskId, [...(waitsOn.get(e.taskId) ?? []), e.dependsOnId]);
  // Parcours en largeur depuis dependsOnId en suivant « attend » : atteindre taskId = boucle.
  const previous = new Map<string, string>();
  const queue = [dependsOnId];
  const seen = new Set([dependsOnId]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of waitsOn.get(current) ?? []) {
      if (seen.has(next)) continue;
      previous.set(next, current);
      if (next === taskId) {
        const path = [taskId];
        let node = taskId;
        while (node !== dependsOnId) {
          node = previous.get(node)!;
          path.unshift(node);
        }
        return [taskId, ...path];
      }
      seen.add(next);
      queue.push(next);
    }
  }
  return null;
}
