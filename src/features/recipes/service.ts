import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { notify } from "@/features/notifications/service";
import type { ServiceResult } from "@/features/projects/service";
import { awardXp } from "@/features/progression/service";
import { BONUS_XP } from "@/features/progression/config";
import { checkAutoBadges } from "@/features/badges/service";
import { postBrigadeEvent } from "@/features/brigade/service";
import { BRANCHES } from "@/features/skills/tree";

type Actor = { id: string };

/** Catégories du carnet : les six branches de compétences. */
export const RECIPE_CATEGORIES = BRANCHES.map((b) => ({ value: b.key, label: b.name }));
export const categoryName = (key: string) => BRANCHES.find((b) => b.key === key)?.name ?? key;

export type RecipeInput = {
  title: string;
  category: string;
  summary: string;
  body: string;
  url: string | null;
};

export async function listRecipes(filter: { category?: string; q?: string } = {}) {
  return getDb().recipe.findMany({
    where: {
      archivedAt: null,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.q
        ? {
            OR: [
              { title: { contains: filter.q, mode: "insensitive" } },
              { summary: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, name: true } }, _count: { select: { uses: true } } },
  });
}

export async function getRecipe(id: string) {
  return getDb().recipe.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      uses: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

/** Créer ou modifier une recette. Toute la brigade peut l'améliorer ; chaque modification est journalisée. */
export async function saveRecipe(
  id: string | null,
  input: RecipeInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  if (!RECIPE_CATEGORIES.some((c) => c.value === input.category))
    return { ok: false, error: "Catégorie inconnue." };
  const db = getDb();
  if (id) {
    const before = await db.recipe.findUnique({ where: { id } });
    if (!before || before.archivedAt) return { ok: false, error: "Recette introuvable." };
    await db.recipe.update({ where: { id }, data: input });
    await recordAudit({
      action: "progression.recipe_updated",
      actorId: actor.id,
      targetType: "recipe",
      targetId: id,
      before: { title: before.title },
      after: { title: input.title },
    });
    return { ok: true, data: { id } };
  }
  const recipe = await db.recipe.create({ data: { ...input, authorId: actor.id } });
  await recordAudit({
    action: "progression.recipe_created",
    actorId: actor.id,
    targetType: "recipe",
    targetId: recipe.id,
    after: { title: input.title },
  });
  // Méthode documentée : bonus indicatif du barème, une fois par recette.
  await awardXp({
    userId: actor.id,
    amount: BONUS_XP.recipe,
    kind: "recipe",
    label: `Recette documentée : « ${input.title} »`,
    idempotencyKey: `recipe:${recipe.id}`,
    sourceType: "recipe",
    sourceId: recipe.id,
    createdById: actor.id,
  });
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  await postBrigadeEvent({
    userId: actor.id,
    kind: "recette",
    title: `${me?.name ?? "Un associé"} partage une recette : ${input.title}`,
    href: `/recettes/${recipe.id}`,
    dedupeKey: `recette:${recipe.id}`,
  });
  return { ok: true, data: { id: recipe.id } };
}

/** Seul l'auteur range sa recette ; elle reste dans le journal. */
export async function archiveRecipe(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const r = await db.recipe.findUnique({ where: { id } });
  if (!r || r.archivedAt) return { ok: false, error: "Recette introuvable." };
  if (r.authorId !== actor.id) return { ok: false, error: "Seul l'auteur peut ranger sa recette." };
  await db.recipe.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "progression.recipe_archived",
    actorId: actor.id,
    targetType: "recipe",
    targetId: id,
  });
  return { ok: true, data: null };
}

/** « Je l'ai réutilisée » : prévient l'auteur et peut lui valoir « Transmission du savoir ». */
export async function markRecipeUsed(
  id: string,
  note: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const r = await db.recipe.findUnique({ where: { id } });
  if (!r || r.archivedAt) return { ok: false, error: "Recette introuvable." };
  if (r.authorId === actor.id)
    return { ok: false, error: "C'est votre recette : la brigade dira si elle sert." };
  const created = await db.recipeUse.createMany({
    data: [{ recipeId: id, userId: actor.id, note }],
    skipDuplicates: true,
  });
  if (!created.count) return { ok: false, error: "Déjà noté." };
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  await notify({
    userId: r.authorId,
    kind: "felicitations",
    title: `${me?.name ?? "Un associé"} a réutilisé votre recette « ${r.title} »`,
    body: note ?? undefined,
    href: `/recettes/${id}`,
    dedupeKey: `recette-usage:${id}:${actor.id}`,
  });
  await checkAutoBadges(r.authorId);
  return { ok: true, data: null };
}
