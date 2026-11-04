import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import {
  CHANNEL_NAME_MAX,
  DEFAULT_CHANNELS,
  GENERAL_SLUG,
  MESSAGE_MAX_LENGTH,
  canAccessChannel,
  channelSlugCandidates,
  dmSlug,
  persoSlug,
} from "@/features/discussions/rules";

/**
 * Salons : création à la demande (par défaut, projet, message direct, notes perso) et
 * contrôle d'accès centralisé. Module sans notification : utilisé aussi par les messages du QG.
 */

export const channelSelect = {
  id: true,
  slug: true,
  name: true,
  topic: true,
  kind: true,
  projectId: true,
  meetUrl: true,
  archivedAt: true,
  createdById: true,
  createdAt: true,
  project: { select: { id: true, name: true, ownerId: true, archivedAt: true } },
} as const satisfies Prisma.ChannelSelect;

export type ChannelRow = Prisma.ChannelGetPayload<{ select: typeof channelSelect }>;
export type ChannelMembership = { id: string; lastReadAt: Date; muted: boolean };
export type ChannelAccess = { channel: ChannelRow; member: ChannelMembership | null };

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

/**
 * Contrôle d'accès unique, appliqué à chaque lecture et à chaque mutation des discussions :
 * renvoie le salon et l'adhésion du lecteur, ou null s'il n'existe pas ou n'est pas accessible
 * (même réponse dans les deux cas : un salon privé n'est jamais révélé).
 */
export async function accessChannel(
  where: { id: string } | { slug: string },
  userId: string,
): Promise<ChannelAccess | null> {
  const found = await getDb().channel.findUnique({
    where,
    select: {
      ...channelSelect,
      members: { where: { userId }, select: { id: true, lastReadAt: true, muted: true } },
    },
  });
  if (!found) return null;
  const { members, ...channel } = found;
  const member = members[0] ?? null;
  return canAccessChannel(channel, !!member) ? { channel, member } : null;
}

/** « Salle commune » et « Hall clients », créés à la première utilisation. */
export async function ensureDefaultChannels(): Promise<void> {
  const db = getDb();
  const existing = await db.channel.findMany({
    where: { slug: { in: DEFAULT_CHANNELS.map((c) => c.slug) } },
    select: { slug: true },
  });
  const missing = DEFAULT_CHANNELS.filter((c) => !existing.some((e) => e.slug === c.slug));
  if (missing.length)
    await db.channel.createMany({
      data: missing.map((c) => ({ slug: c.slug, name: c.name, topic: c.topic, kind: "PUBLIC" as const })),
      skipDuplicates: true,
    });
}

export async function ensureGeneralChannel(): Promise<ChannelRow | null> {
  await ensureDefaultChannels();
  return getDb().channel.findUnique({ where: { slug: GENERAL_SLUG }, select: channelSelect });
}

/** Salon d'un projet (nom du projet), créé à la demande. Null si le projet n'existe pas. */
export async function ensureProjectChannel(projectId: string, actorId: string | null): Promise<ChannelRow | null> {
  const db = getDb();
  const found = await db.channel.findUnique({ where: { projectId }, select: channelSelect });
  if (found) return found;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  if (!project) return null;
  for (const slug of channelSlugCandidates(project.name, project.id)) {
    try {
      const created = await db.channel.create({
        data: {
          slug,
          name: project.name.slice(0, CHANNEL_NAME_MAX),
          topic: project.client ? `Projet pour ${project.client.name}` : "Salon du projet",
          kind: "PUBLIC",
          projectId,
          createdById: actorId,
        },
        select: channelSelect,
      });
      await recordAudit({
        action: "channel.created",
        actorId,
        targetType: "channel",
        targetId: created.id,
        after: { name: created.name, kind: created.kind, projectId },
      });
      return created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Créé en parallèle (projet) ou identifiant déjà pris (candidat suivant).
      const raced = await db.channel.findUnique({ where: { projectId }, select: channelSelect });
      if (raced) return raced;
    }
  }
  return db.channel.findUnique({ where: { projectId }, select: channelSelect });
}

/** Notes pour soi : un salon dont l'associé est le seul membre. */
export async function ensurePersoChannel(userId: string): Promise<ChannelRow> {
  const db = getDb();
  const slug = persoSlug(userId);
  const found = await db.channel.findUnique({ where: { slug }, select: channelSelect });
  if (found) return found;
  try {
    return await db.channel.create({
      data: {
        slug,
        name: "Notes perso",
        kind: "PERSO",
        createdById: userId,
        members: { create: [{ userId }] },
      },
      select: channelSelect,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return (await db.channel.findUnique({ where: { slug }, select: channelSelect }))!;
  }
}

/** Message direct entre deux associés (un seul salon par paire). Null si l'autre n'existe pas. */
export async function ensureDirectChannel(userId: string, otherId: string): Promise<ChannelRow | null> {
  if (otherId === userId) return ensurePersoChannel(userId);
  const db = getDb();
  const other = await db.user.findFirst({ where: { id: otherId, role: "associe" }, select: { id: true } });
  if (!other) return null;
  const slug = dmSlug(userId, otherId);
  let channel = await db.channel.findUnique({ where: { slug }, select: channelSelect });
  if (!channel) {
    try {
      channel = await db.channel.create({
        data: {
          slug,
          name: "Message direct",
          kind: "DIRECT",
          createdById: userId,
          members: { create: [{ userId }, { userId: otherId }] },
        },
        select: channelSelect,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      channel = await db.channel.findUnique({ where: { slug }, select: channelSelect });
    }
  }
  if (!channel) return null;
  await db.channelMember.createMany({
    data: [userId, otherId].map((id) => ({ channelId: channel.id, userId: id })),
    skipDuplicates: true,
  });
  return channel;
}

/** Message du QG (sans auteur), éventuellement dans un fil, avec un lien facultatif. */
export async function createSystemMessage(input: {
  channelId: string;
  text: string;
  href?: string | null;
  parentId?: string | null;
}): Promise<string> {
  const message = await getDb().message.create({
    data: {
      channelId: input.channelId,
      authorId: null,
      parentId: input.parentId ?? null,
      body: input.text.slice(0, MESSAGE_MAX_LENGTH),
      ...(input.href ? { meta: { href: input.href } } : {}),
    },
    select: { id: true },
  });
  return message.id;
}

/** Marque le salon comme lu (rejoint un salon public à la première visite). */
export async function markChannelRead(channelId: string, userId: string, at = new Date()): Promise<void> {
  await getDb().channelMember.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}
