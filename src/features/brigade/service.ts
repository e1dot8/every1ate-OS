import "server-only";
import { getDb } from "@/lib/db/client";
import { notify, notifyMany } from "@/features/notifications/service";
import type { ServiceResult } from "@/features/projects/service";

/** Publie une réussite dans le fil (une seule fois par clé). */
export async function postBrigadeEvent(input: {
  userId: string | null;
  kind: "badge" | "rang" | "projet" | "objectif" | "aide" | "recette";
  title: string;
  detail?: string;
  href?: string;
  dedupeKey: string;
}) {
  await getDb().brigadeEvent.createMany({ data: [input], skipDuplicates: true });
}

export async function listFeed(viewerId: string, take = 20) {
  const events = await getDb().brigadeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true } },
      cheers: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  return events.map((e) => ({
    ...e,
    cheeredByMe: e.cheers.some((c) => c.userId === viewerId),
    reactionCounts: REACTIONS.map((emoji) => ({
      emoji,
      count: e.reactions.filter((r) => r.emoji === emoji).length,
      mine: e.reactions.some((r) => r.emoji === emoji && r.userId === viewerId),
    })),
  }));
}

/** Féliciter : une fois par réussite et par associé, avec un mot facultatif. */
export async function cheer(
  eventId: string,
  message: string | null,
  actor: { id: string },
): Promise<ServiceResult<null>> {
  const db = getDb();
  const event = await db.brigadeEvent.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Réussite introuvable." };
  if (event.userId === actor.id)
    return { ok: false, error: "On ne se félicite pas soi-même : la brigade s'en charge." };
  const created = await db.brigadeCheer.createMany({
    data: [{ eventId, userId: actor.id, message }],
    skipDuplicates: true,
  });
  if (created.count && event.userId) {
    const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    await notify({
      userId: event.userId,
      kind: "felicitations",
      title: `${me?.name ?? "Un associé"} vous félicite : ${event.title}`,
      body: message ?? undefined,
      href: "/bureau",
      dedupeKey: `bravo:${eventId}:${actor.id}`,
    });
  }
  return { ok: true, data: null };
}

/** Réactions rapides : un petit jeu fixe, sans compteur public de « popularité ». */
export const REACTIONS = ["👏", "🔥", "🍳", "❤️"] as const;

export async function toggleReaction(
  eventId: string,
  emoji: string,
  actor: { id: string },
): Promise<ServiceResult<null>> {
  if (!(REACTIONS as readonly string[]).includes(emoji)) return { ok: false, error: "Réaction inconnue." };
  const db = getDb();
  const event = await db.brigadeEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return { ok: false, error: "Réussite introuvable." };
  const existing = await db.brigadeReaction.findUnique({
    where: { eventId_userId_emoji: { eventId, userId: actor.id, emoji } },
  });
  if (existing) await db.brigadeReaction.delete({ where: { id: existing.id } });
  else
    await db.brigadeReaction.createMany({
      data: [{ eventId, userId: actor.id, emoji }],
      skipDuplicates: true,
    });
  return { ok: true, data: null };
}

// ─── Demandes d'aide ────────────────────────────────────────────────────────

export async function requestHelp(
  input: { taskId: string | null; skillKey: string | null; message: string },
  actor: { id: string },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  let label = "";
  if (input.taskId) {
    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: { title: true, archivedAt: true },
    });
    if (!task || task.archivedAt) return { ok: false, error: "Tâche introuvable." };
    label = ` sur « ${task.title} »`;
  }
  const help = await db.helpRequest.create({ data: { ...input, userId: actor.id } });
  const [me, others] = await Promise.all([
    db.user.findUnique({ where: { id: actor.id }, select: { name: true } }),
    db.user.findMany({ where: { role: "associe", id: { not: actor.id } }, select: { id: true } }),
  ]);
  await notifyMany(
    others.map((o) => o.id),
    {
      kind: "aide",
      title: `${me?.name ?? "Un associé"} demande un coup de main${label}`,
      body: input.message,
      href: input.taskId ? `/taches/${input.taskId}` : "/bureau",
      taskId: input.taskId,
      dedupeKey: `aide-demande:${help.id}`,
    },
  );
  return { ok: true, data: { id: help.id } };
}

export async function takeHelp(id: string, actor: { id: string }): Promise<ServiceResult<null>> {
  const db = getDb();
  const h = await db.helpRequest.findUnique({ where: { id } });
  if (!h || h.resolvedAt) return { ok: false, error: "Demande introuvable ou déjà réglée." };
  if (h.userId === actor.id) return { ok: false, error: "C'est votre propre demande." };
  const taken = await db.helpRequest.updateMany({
    where: { id, takenById: null },
    data: { takenById: actor.id },
  });
  if (!taken.count) return { ok: false, error: "Quelqu'un s'en occupe déjà." };
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  await notify({
    userId: h.userId,
    kind: "aide",
    title: `${me?.name ?? "Un associé"} s'occupe de votre demande d'aide`,
    body: h.message,
    href: h.taskId ? `/taches/${h.taskId}` : "/bureau",
    dedupeKey: `aide-prise:${id}`,
  });
  return { ok: true, data: null };
}

/** Réglée par l'auteur ou par celui qui aide. */
export async function resolveHelp(id: string, actor: { id: string }): Promise<ServiceResult<null>> {
  const db = getDb();
  const h = await db.helpRequest.findUnique({ where: { id } });
  if (!h || h.resolvedAt) return { ok: false, error: "Demande introuvable ou déjà réglée." };
  if (h.userId !== actor.id && h.takenById !== actor.id)
    return { ok: false, error: "Seuls l'auteur et la personne qui aide peuvent la clore." };
  await db.helpRequest.update({ where: { id }, data: { resolvedAt: new Date() } });
  return { ok: true, data: null };
}

export async function openHelpRequests() {
  return getDb().helpRequest.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } }, takenBy: { select: { id: true, name: true } } },
    take: 12,
  });
}
