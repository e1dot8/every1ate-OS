import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { addDays, todayDate } from "@/lib/dates";
import type { ServiceResult } from "@/features/projects/service";
import { getProgress } from "@/features/progression/service";
import { getPreferences, listUserBadges } from "@/features/badges/service";
import { weekOf } from "@/features/briefing/service";
import { skillProfile } from "@/features/skills/service";
import {
  DEFAULT_AVATAR,
  ITEMS,
  SLOTS,
  isUnlocked,
  itemByKey,
  resolveLayout,
  validLook,
  type AvatarLook,
  type AvatarView,
  type Progress,
} from "./cosmetics";
import { portraitFor } from "./portraits";

type Actor = { id: string };

/** Ce qui débloque les cosmétiques : la progression existante, rien d'autre. */
export async function progressContext(userId: string): Promise<Progress> {
  const [p, badges] = await Promise.all([
    getProgress(userId),
    getDb().userBadge.findMany({ where: { userId }, select: { badgeKey: true } }),
  ]);
  return {
    level: p.level,
    rankKey: p.rank.key,
    rankLevel: p.rank.fromLevel,
    badges: new Set(badges.map((b) => b.badgeKey)),
  };
}

/** Le dessin personnalisé seul (atelier d'avatar). */
export async function getAvatarLook(userId: string): Promise<AvatarLook> {
  const a = await getDb().userAvatar.findUnique({ where: { userId } });
  return a
    ? { skin: a.skin, hat: a.hat, apron: a.apron, accessory: a.accessory, backdrop: a.backdrop }
    : DEFAULT_AVATAR;
}

/** L'avatar affiché partout ailleurs : portrait de l'associé s'il existe, sinon le dessin. */
export async function getAvatar(userId: string): Promise<AvatarView> {
  const [look, user] = await Promise.all([
    getAvatarLook(userId),
    getDb().user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  return { ...look, portrait: user ? portraitFor(user.name) : null };
}

export async function avatarsOf(userIds: string[]): Promise<Map<string, AvatarView>> {
  const [rows, users] = await Promise.all([
    getDb().userAvatar.findMany({ where: { userId: { in: userIds } } }),
    getDb().user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);
  const map = new Map<string, AvatarView>(
    rows.map((a) => [
      a.userId,
      { skin: a.skin, hat: a.hat, apron: a.apron, accessory: a.accessory, backdrop: a.backdrop },
    ]),
  );
  for (const id of userIds) {
    const name = users.find((u) => u.id === id)?.name;
    map.set(id, { ...(map.get(id) ?? DEFAULT_AVATAR), portrait: name ? portraitFor(name) : null });
  }
  return map;
}

export async function saveAvatar(look: AvatarLook, actor: Actor): Promise<ServiceResult<null>> {
  const error = validLook(look, await progressContext(actor.id));
  if (error) return { ok: false, error };
  await getDb().userAvatar.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, ...look },
    update: look,
  });
  return { ok: true, data: null };
}

/** Placer un objet débloqué dans un emplacement (« vide » retire l'objet). */
export async function placeItem(slot: string, itemKey: string, actor: Actor): Promise<ServiceResult<null>> {
  if (!SLOTS.some((s) => s.key === slot)) return { ok: false, error: "Emplacement inconnu." };
  if (itemKey !== "vide") {
    const item = itemByKey(itemKey);
    if (!item || item.slot !== slot) return { ok: false, error: "Cet objet ne va pas à cet emplacement." };
    if (!isUnlocked(item.unlock, await progressContext(actor.id)))
      return { ok: false, error: `« ${item.name} » n'est pas encore débloqué.` };
  }
  await getDb().apartmentItem.upsert({
    where: { userId_slot: { userId: actor.id, slot } },
    create: { userId: actor.id, slot, itemKey },
    update: { itemKey },
  });
  return { ok: true, data: null };
}

export type Availability = "DISPONIBLE" | "CONCENTRE" | "ABSENT";
export const availabilityLabels: Record<Availability, string> = {
  DISPONIBLE: "Disponible",
  CONCENTRE: "Concentré",
  ABSENT: "Absent",
};

/** Disponibilité du jour, facultative ; elle s'efface d'elle-même le lendemain. Aucun historique. */
export async function setAvailability(status: Availability | null, actor: Actor) {
  await getPreferences(actor.id);
  await getDb().userPreference.update({
    where: { userId: actor.id },
    data: { availability: status, availabilityDay: status ? todayDate() : null },
  });
}

export async function availabilities(today = todayDate()): Promise<Map<string, Availability>> {
  const rows = await getDb().userPreference.findMany({
    where: { availabilityDay: today, availability: { not: null } },
    select: { userId: true, availability: true },
  });
  return new Map(rows.map((r) => [r.userId, r.availability as Availability]));
}

/**
 * L'appartement d'un associé : une sélection courte (pas un second tableau de bord).
 * Pour un visiteur, seuls les badges rendus visibles et les informations publiques apparaissent.
 */
export async function apartment(userId: string, viewerId: string) {
  const db = getDb();
  const own = userId === viewerId;
  const today = todayDate();
  const [user, progress, ctx, look, saved, badges, skills, goals, briefing, avail] = await Promise.all([
    db.user.findFirst({ where: { id: userId, role: "associe" }, select: { id: true, name: true } }),
    getProgress(userId),
    progressContext(userId),
    getAvatar(userId),
    db.apartmentItem.findMany({ where: { userId } }),
    listUserBadges(userId, viewerId),
    skillProfile(userId),
    db.weeklyItem.findMany({
      where: {
        ownerId: userId,
        status: "OUVERT",
        kind: { in: ["OBJECTIF", "ACTION"] },
        briefing: { weekStart: { gte: addDays(weekOf(today), -7) } },
      },
      select: { id: true, title: true, kind: true, dueDate: true },
      take: 5,
    }),
    own
      ? db.dailyBriefing.findUnique({
          where: { userId_day: { userId, day: today } },
          select: { personalGoal: true },
        })
      : null,
    availabilities(today),
  ]);
  if (!user) return null;
  const layout = resolveLayout(saved, ctx);
  return {
    user,
    own,
    progress,
    look,
    layout,
    items: ITEMS.map((i) => ({ ...i, unlocked: isUnlocked(i.unlock, ctx) })),
    favorites: badges.filter((b) => b.favorite).slice(0, 3),
    badgeCount: badges.length,
    badges,
    target: skills.find((s) => s.target) ?? null,
    skills: skills
      .filter((s) => s.target || s.level >= 2)
      .sort((a, b) => Number(b.target) - Number(a.target) || b.level - a.level)
      .slice(0, 4),
    goals,
    personalGoal: briefing?.personalGoal ?? null,
    availability: avail.get(userId) ?? null,
    progressContext: ctx,
  };
}

/** Aperçu de l'intérieur de chaque pièce, pour la carte du bâtiment. */
export async function roomPreviews(userId: string) {
  const db = getDb();
  const today = todayDate();
  const [progress, badges, goals, help, risky, openTasks, dueSoon, recipes] = await Promise.all([
    getProgress(userId),
    db.userBadge.count({ where: { userId } }),
    db.weeklyItem.count({ where: { kind: "OBJECTIF", briefing: { weekStart: weekOf(today) } } }),
    db.helpRequest.count({ where: { resolvedAt: null } }),
    db.opportunity.count({
      where: { archivedAt: null, stage: { notIn: ["GAGNE", "PERDU"] }, nextActionDate: { lt: today } },
    }),
    db.task.count({ where: { archivedAt: null, ownerId: userId, status: { notIn: ["TERMINE", "ANNULE"] } } }),
    db.task.count({
      where: {
        archivedAt: null,
        status: { notIn: ["TERMINE", "ANNULE"] },
        dueDate: { gte: today, lte: addDays(today, 7) },
      },
    }),
    db.recipe.count({ where: { archivedAt: null } }),
  ]);
  return {
    appartement: `${progress.rank.title} · niveau ${progress.level} · ${badges} badge${badges > 1 ? "s" : ""}`,
    bureau: `${goals} objectif${goals > 1 ? "s" : ""} cette semaine · ${help} coup${help > 1 ? "s" : ""} de main demandé${help > 1 ? "s" : ""}`,
    recettes: `${recipes} recette${recipes > 1 ? "s" : ""} dans le carnet`,
    salle: `${risky} relance${risky > 1 ? "s" : ""} en retard`,
    cuisine: `${openTasks} tâche${openTasks > 1 ? "s" : ""} pour moi · ${dueSoon} livrable${dueSoon > 1 ? "s" : ""} sous 7 jours`,
    client: "Pas encore ouvert",
  } as Record<string, string>;
}

export async function auditCosmetic(actor: Actor, what: string) {
  await recordAudit({
    action: "progression.cosmetic",
    actorId: actor.id,
    targetType: "user",
    targetId: actor.id,
    after: { what },
  });
}
