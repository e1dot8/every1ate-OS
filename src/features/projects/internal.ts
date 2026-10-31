import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";

export const INTERNAL_PROJECT_NAME = "La maison Every1.ate";

/**
 * Le projet interne unique qui accueille les tâches sans client (agence, gestion, visibilité,
 * apprentissage…). Créé au premier besoin ; l'index unique partiel garantit qu'il n'y en a qu'un.
 * Il n'apparaît ni dans la liste des projets, ni en finance, ni dans les signaux commerciaux.
 */
export async function ensureInternalProject(actor: { id: string }): Promise<string> {
  const db = getDb();
  const existing = await db.project.findFirst({ where: { internal: true }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const project = await db.project.create({
      data: {
        name: INTERNAL_PROJECT_NAME,
        description: "Tâches sans client : développement de l'agence, gestion, visibilité, apprentissage.",
        internal: true,
        status: "ACTIF",
        templateKey: "vierge",
        ownerId: actor.id,
        createdById: actor.id,
      },
    });
    await recordAudit({
      action: "project.created",
      actorId: actor.id,
      projectId: project.id,
      targetType: "project",
      targetId: project.id,
      after: { name: project.name, internal: true },
    });
    return project.id;
  } catch (e) {
    // Création concurrente : l'autre a gagné, on le réutilise.
    const again = await db.project.findFirst({ where: { internal: true }, select: { id: true } });
    if (again) return again.id;
    throw e;
  }
}
