import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { effectivePresence, type PresenceValue } from "@/features/presence/rules";
import { presenceSelect } from "@/features/presence/service";
import { containsPattern, normalizeQuery, SEARCH_MIN_LENGTH } from "@/features/search/rules";
import type { ServiceResult } from "@/features/projects/service";
import { ensureDefaultChannels } from "@/features/discussions/channels";
import { DEFAULT_CHANNELS, PAGE_SIZE, channelTitle, dmSlug, persoSlug } from "@/features/discussions/rules";

/** Lectures des discussions. Chaque requête est bornée aux salons accessibles au lecteur. */

/** Salons accessibles : publics, ou dont le lecteur est membre (même règle que canAccessChannel). */
export const accessibleChannels = (userId: string): Prisma.ChannelWhereInput => ({
  OR: [{ kind: "PUBLIC" }, { members: { some: { userId } } }],
});

export type PresenceSnapshot = { state: PresenceValue; until: Date | null; note: string | null };

// ─── Barre latérale ─────────────────────────────────────────────────────────

export type SidebarChannel = {
  id: string;
  slug: string;
  title: string;
  kind: "PUBLIC" | "PRIVE" | "DIRECT" | "PERSO";
  projectId: string | null;
  unread: number;
  mentions: number;
};
export type SidebarDirect = {
  href: string;
  title: string;
  presence: PresenceSnapshot | null;
  unread: number;
  mentions: number;
};
export type Sidebar = {
  channels: SidebarChannel[];
  directs: SidebarDirect[];
  perso: { href: string; unread: number };
  totalUnread: number;
};

/**
 * Messages non lus par salon (écrits par d'autres après la dernière lecture, hors réponses de fil).
 * Les salons archivés ne comptent pas : ils ne figurent plus dans la barre latérale.
 */
async function unreadByChannel(userId: string) {
  const rows = await getDb().$queryRaw<{ channelId: string; unread: number; mentions: number }[]>`
    SELECT cm."channelId",
           count(m."id")::int AS "unread",
           (count(m."id") FILTER (WHERE ${userId} = ANY(m."mentionIds")))::int AS "mentions"
    FROM "channel_member" cm
    JOIN "channel" c ON c."id" = cm."channelId"
    JOIN "message" m ON m."channelId" = cm."channelId"
    WHERE cm."userId" = ${userId}
      AND c."archivedAt" IS NULL
      AND m."createdAt" > cm."lastReadAt"
      AND m."deletedAt" IS NULL
      AND (m."parentId" IS NULL OR m."alsoInChannel")
      AND (m."authorId" IS NULL OR m."authorId" <> ${userId})
    GROUP BY cm."channelId"`;
  return new Map(rows.map((r) => [r.channelId, { unread: Number(r.unread), mentions: Number(r.mentions) }]));
}

const DEFAULT_ORDER: string[] = DEFAULT_CHANNELS.map((c) => c.slug);
/** Raccourcis vers les associés sans message direct (3 associés en production). */
const DIRECT_SHORTCUTS = 8;

/**
 * Salons de la barre latérale : salons par défaut (rejoints automatiquement), salons dont on est
 * membre, salons des projets dont on est responsable ; messages directs avec le statut choisi
 * par l'autre associé ; notes perso.
 */
export async function sidebarData(userId: string, now = new Date()): Promise<Sidebar> {
  await ensureDefaultChannels();
  const db = getDb();
  const rows = await db.channel.findMany({
    where: {
      archivedAt: null,
      OR: [
        { slug: { in: DEFAULT_ORDER } },
        { members: { some: { userId } } },
        { project: { ownerId: userId, archivedAt: null } },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      projectId: true,
      project: { select: { name: true } },
      members: { where: { userId }, select: { id: true } },
    },
  });
  const missingDefaults = rows.filter((c) => DEFAULT_ORDER.includes(c.slug) && !c.members.length);
  if (missingDefaults.length)
    await db.channelMember.createMany({
      data: missingDefaults.map((c) => ({ channelId: c.id, userId })),
      skipDuplicates: true,
    });
  const unread = await unreadByChannel(userId);
  const count = (id: string) => unread.get(id) ?? { unread: 0, mentions: 0 };

  const channels: SidebarChannel[] = rows
    .filter((c) => c.kind === "PUBLIC" || c.kind === "PRIVE")
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: channelTitle({ ...c, projectName: c.project?.name }),
      kind: c.kind,
      projectId: c.projectId,
      ...count(c.id),
    }))
    .sort((a, b) => {
      const rank = (c: SidebarChannel) =>
        DEFAULT_ORDER.includes(c.slug) ? DEFAULT_ORDER.indexOf(c.slug) : c.projectId ? 10 : 20;
      return rank(a) - rank(b) || a.title.localeCompare(b.title, "fr");
    });

  const dms = rows.filter((c) => c.kind === "DIRECT");
  const partners = dms.length
    ? await db.channelMember.findMany({
        where: { channelId: { in: dms.map((c) => c.id) }, userId: { not: userId } },
        select: { channelId: true, user: { select: { id: true, name: true, ...presenceSelect } } },
      })
    : [];
  const presenceOf = (u: {
    presenceState: PresenceValue;
    presenceUntil: Date | null;
    presenceNote: string | null;
    presenceShared: boolean;
  }): PresenceSnapshot => {
    const p = effectivePresence(
      { state: u.presenceState, until: u.presenceUntil, note: u.presenceNote, shared: u.presenceShared },
      now,
    );
    return { state: p.state, until: p.until, note: p.note };
  };
  const directs: SidebarDirect[] = partners
    .map((p) => {
      const channel = dms.find((c) => c.id === p.channelId)!;
      return {
        href: `/discussions/${channel.slug}`,
        title: p.user.name,
        presence: presenceOf(p.user),
        ...count(channel.id),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
  const withDm = new Set(partners.map((p) => p.user.id));
  const others = await db.user.findMany({
    where: { role: "associe", id: { notIn: [userId, ...withDm] } },
    orderBy: { name: "asc" },
    take: DIRECT_SHORTCUTS,
    select: { id: true, name: true, ...presenceSelect },
  });
  for (const u of others)
    directs.push({
      href: `/discussions/direct/${u.id}`,
      title: u.name,
      presence: presenceOf(u),
      unread: 0,
      mentions: 0,
    });

  const perso = rows.find((c) => c.kind === "PERSO" && c.slug === persoSlug(userId));
  const persoCount = perso ? count(perso.id) : { unread: 0 };
  const totalUnread = channels.reduce((n, c) => n + c.unread, 0) + directs.reduce((n, d) => n + d.unread, 0);
  return {
    channels,
    directs,
    perso: {
      href: perso ? `/discussions/${perso.slug}` : `/discussions/direct/${userId}`,
      unread: persoCount.unread,
    },
    totalUnread,
  };
}

// ─── Messages ───────────────────────────────────────────────────────────────

export const messageInclude = (userId: string) =>
  ({
    author: { select: { id: true, name: true } },
    reactions: {
      orderBy: { createdAt: "asc" },
      select: { emoji: true, userId: true, user: { select: { name: true } } },
    },
    attachments: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, url: true } },
    saves: { where: { userId }, select: { id: true } },
    parent: { select: { id: true, body: true, deletedAt: true, author: { select: { name: true } } } },
    replies: {
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true },
    },
    _count: { select: { replies: { where: { deletedAt: null } } } },
  }) satisfies Prisma.MessageInclude;

export type MessageWithDetails = Prisma.MessageGetPayload<{ include: ReturnType<typeof messageInclude> }>;

/** Titres des tâches liées à des messages. */
export async function linkedTasks(messages: { taskId: string | null }[]) {
  const ids = [...new Set(messages.map((m) => m.taskId).filter(Boolean) as string[])];
  if (!ids.length) return new Map<string, string>();
  const tasks = await getDb().task.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true },
  });
  return new Map(tasks.map((t) => [t.id, t.title]));
}

/** Derniers messages du salon (et réponses « aussi dans le salon »), par pages de 50. */
export async function channelMessages(channelId: string, userId: string, before?: string | null) {
  const db = getDb();
  const where: Prisma.MessageWhereInput = {
    channelId,
    OR: [{ parentId: null }, { alsoInChannel: true }],
  };
  if (before) {
    const ref = await db.message.findFirst({ where: { id: before, channelId }, select: { createdAt: true } });
    if (ref) where.createdAt = { lt: ref.createdAt };
  }
  const rows = await db.message.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    include: messageInclude(userId),
  });
  return { messages: rows.slice(0, PAGE_SIZE).reverse(), hasMore: rows.length > PAGE_SIZE };
}

export async function pinnedMessages(channelId: string) {
  return getDb().message.findMany({
    where: { channelId, pinnedAt: { not: null }, deletedAt: null },
    orderBy: { pinnedAt: "desc" },
    take: 20,
    select: { id: true, parentId: true, body: true, createdAt: true, author: { select: { name: true } } },
  });
}

export async function channelMembers(channelId: string) {
  const db = getDb();
  const [count, members] = await Promise.all([
    db.channelMember.count({ where: { channelId } }),
    db.channelMember.findMany({
      where: { channelId },
      orderBy: { user: { name: "asc" } },
      take: 50,
      select: { user: { select: { id: true, name: true, ...presenceSelect } } },
    }),
  ]);
  return { count, members: members.map((m) => m.user) };
}

/** Statut de l'autre associé d'un message direct, tel qu'il le partage. */
export async function directPartner(channelId: string, userId: string, now = new Date()) {
  const member = await getDb().channelMember.findFirst({
    where: { channelId, userId: { not: userId } },
    select: { user: { select: { id: true, name: true, ...presenceSelect } } },
  });
  if (!member) return null;
  const u = member.user;
  const p = effectivePresence(
    { state: u.presenceState, until: u.presenceUntil, note: u.presenceNote, shared: u.presenceShared },
    now,
  );
  return { id: u.id, name: u.name, presence: { state: p.state, until: p.until, note: p.note } };
}

/** Message racine et réponses d'un fil (racine dans ce salon uniquement). */
export async function threadMessages(channelId: string, rootId: string, userId: string) {
  const db = getDb();
  const root = await db.message.findFirst({
    where: { id: rootId, channelId, parentId: null },
    include: messageInclude(userId),
  });
  if (!root) return null;
  const replies = await db.message.findMany({
    where: { parentId: rootId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: messageInclude(userId),
  });
  return { root, replies };
}

// ─── Activité, Plus tard, Programmés ────────────────────────────────────────

const activitySelect = {
  id: true,
  body: true,
  parentId: true,
  createdAt: true,
  deletedAt: true,
  author: { select: { name: true } },
  channel: {
    select: { slug: true, name: true, kind: true, projectId: true, project: { select: { name: true } } },
  },
} as const satisfies Prisma.MessageSelect;

export type ActivityMessage = Prisma.MessageGetPayload<{ select: typeof activitySelect }>;

/** Mentions, réponses dans mes fils, réactions à mes messages, rappels. */
export async function activityFeed(userId: string) {
  const db = getDb();
  const channel = accessibleChannels(userId);
  const [mentions, replies, reactions, reminders] = await Promise.all([
    db.message.findMany({
      where: { mentionIds: { has: userId }, deletedAt: null, channel },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: activitySelect,
    }),
    db.message.findMany({
      where: {
        deletedAt: null,
        channel,
        AND: [
          { OR: [{ authorId: null }, { authorId: { not: userId } }] },
          { parent: { OR: [{ authorId: userId }, { replies: { some: { authorId: userId } } }] } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: activitySelect,
    }),
    db.messageReaction.findMany({
      where: { userId: { not: userId }, message: { authorId: userId, deletedAt: null, channel } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        emoji: true,
        createdAt: true,
        user: { select: { name: true } },
        message: { select: activitySelect },
      },
    }),
    db.reminder.findMany({
      where: { userId },
      orderBy: [{ sentAt: { sort: "desc", nulls: "first" } }, { remindAt: "asc" }],
      take: 30,
      select: {
        id: true,
        text: true,
        remindAt: true,
        sentAt: true,
        message: { select: { id: true, parentId: true, channel: { select: { slug: true } } } },
      },
    }),
  ]);
  return { mentions, replies, reactions, reminders };
}

export async function savedMessages(userId: string) {
  return getDb().savedMessage.findMany({
    where: { userId, message: { channel: accessibleChannels(userId) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, createdAt: true, message: { select: activitySelect } },
  });
}

const scheduledInclude = {
  channel: {
    select: { slug: true, name: true, kind: true, projectId: true, project: { select: { name: true } } },
  },
} as const satisfies Prisma.ScheduledMessageInclude;

export async function scheduledMessages(userId: string, now = new Date()) {
  const db = getDb();
  const [pending, sent] = await Promise.all([
    db.scheduledMessage.findMany({
      where: { authorId: userId, sentAt: null, cancelledAt: null },
      orderBy: { sendAt: "asc" },
      include: scheduledInclude,
    }),
    db.scheduledMessage.findMany({
      where: { authorId: userId, sentAt: { gte: new Date(now.getTime() - 7 * 24 * 3600_000) } },
      orderBy: { sentAt: "desc" },
      take: 20,
      include: scheduledInclude,
    }),
  ]);
  return { pending, sent };
}

/** Noms des autres associés des messages directs (affichage « Message direct avec … »). */
export async function directNames(slugs: string[], userId: string) {
  const dms = [...new Set(slugs.filter((s) => s.startsWith("dm-")))];
  if (!dms.length) return new Map<string, string>();
  const members = await getDb().channelMember.findMany({
    where: { channel: { slug: { in: dms } }, userId: { not: userId } },
    select: { channel: { select: { slug: true } }, user: { select: { name: true } } },
  });
  return new Map(members.map((m) => [m.channel.slug, m.user.name]));
}

// ─── Tous les salons ────────────────────────────────────────────────────────

export async function channelDirectory(userId: string) {
  await ensureDefaultChannels();
  return getDb().channel.findMany({
    where: { kind: { in: ["PUBLIC", "PRIVE"] }, ...accessibleChannels(userId) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    take: 300,
    select: {
      id: true,
      slug: true,
      name: true,
      topic: true,
      kind: true,
      projectId: true,
      archivedAt: true,
      project: { select: { name: true } },
      members: { where: { userId }, select: { id: true } },
      _count: { select: { members: true } },
    },
  });
}

// ─── Recherche ──────────────────────────────────────────────────────────────

export type MessageHit = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  slug: string;
  channelName: string;
  kind: "PUBLIC" | "PRIVE" | "DIRECT" | "PERSO";
  projectName: string | null;
  authorName: string | null;
  attachmentTitle: string | null;
  total: number;
};
export type ChannelHit = { slug: string; name: string; kind: "PUBLIC" | "PRIVE"; projectName: string | null };

/**
 * Recherche dans les messages, les fils et les titres des liens joints des seuls salons
 * accessibles, sans tenir compte des accents ni de la casse (`unaccent`, jokers échappés).
 */
export async function searchDiscussions(
  raw: string,
  userId: string,
): Promise<ServiceResult<{ term: string; messages: MessageHit[]; total: number; channels: ChannelHit[] }>> {
  const query = normalizeQuery(raw);
  if (query.status !== "ok") return { ok: false, error: `Saisis au moins ${SEARCH_MIN_LENGTH} caractères.` };
  const like = containsPattern(query.term);
  const db = getDb();
  try {
    const [messages, channels] = await Promise.all([
      db.$queryRaw<MessageHit[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat)
        SELECT m."id", m."parentId", m."body", m."createdAt", c."slug", c."name" AS "channelName",
               c."kind"::text AS "kind", p."name" AS "projectName", u."name" AS "authorName",
               (SELECT a."title" FROM "message_attachment" a
                 WHERE a."messageId" = m."id" AND unaccent(lower(a."title")) LIKE q.pat ESCAPE '\\'
                 LIMIT 1) AS "attachmentTitle",
               (count(*) OVER ())::int AS "total"
        FROM "message" m
        CROSS JOIN q
        JOIN "channel" c ON c."id" = m."channelId"
        LEFT JOIN "project" p ON p."id" = c."projectId"
        LEFT JOIN "user" u ON u."id" = m."authorId"
        WHERE m."deletedAt" IS NULL
          AND (c."kind" = 'PUBLIC'
            OR EXISTS (SELECT 1 FROM "channel_member" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${userId}))
          AND (unaccent(lower(m."body")) LIKE q.pat ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM "message_attachment" a
                        WHERE a."messageId" = m."id" AND unaccent(lower(a."title")) LIKE q.pat ESCAPE '\\'))
        ORDER BY m."createdAt" DESC
        LIMIT 50`,
      db.$queryRaw<ChannelHit[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat)
        SELECT c."slug", c."name", c."kind"::text AS "kind", p."name" AS "projectName"
        FROM "channel" c
        CROSS JOIN q
        LEFT JOIN "project" p ON p."id" = c."projectId"
        WHERE c."kind" IN ('PUBLIC', 'PRIVE')
          AND (c."kind" = 'PUBLIC'
            OR EXISTS (SELECT 1 FROM "channel_member" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${userId}))
          AND (unaccent(lower(c."name")) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(coalesce(c."topic", ''))) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(coalesce(p."name", ''))) LIKE q.pat ESCAPE '\\')
        ORDER BY c."archivedAt" IS NOT NULL, c."name"
        LIMIT 10`,
    ]);
    const asDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
    return {
      ok: true,
      data: {
        term: query.term,
        messages: messages.map((m) => ({ ...m, createdAt: asDate(m.createdAt), total: Number(m.total) })),
        total: messages.length ? Number(messages[0].total) : 0,
        channels,
      },
    };
  } catch (error) {
    console.error("[discussions] recherche impossible", error);
    return { ok: false, error: "La recherche est momentanément indisponible. Réessaie dans un instant." };
  }
}

// ─── Rafraîchissement ───────────────────────────────────────────────────────

/**
 * Marqueur d'activité des salons accessibles et non archivés : dernier message, modification ou
 * réaction, salons suivis et total des non-lus. Le navigateur ne rafraîchit la page que s'il change
 * (archiver ou restaurer un salon suivi le change aussi).
 */
export async function activityMarker(userId: string): Promise<{ marker: string; unread: number }> {
  const db = getDb();
  const [rows, unread] = await Promise.all([
    db.$queryRaw<{ last: Date | string | null; reaction: Date | string | null; channels: number }[]>`
      SELECT
        (SELECT max(greatest(m."createdAt", m."editedAt", m."deletedAt", m."pinnedAt"))
           FROM "message" m JOIN "channel" c ON c."id" = m."channelId"
          WHERE c."archivedAt" IS NULL
            AND (c."kind" = 'PUBLIC'
              OR EXISTS (SELECT 1 FROM "channel_member" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${userId}))
        ) AS "last",
        (SELECT max(r."createdAt")
           FROM "message_reaction" r JOIN "message" m ON m."id" = r."messageId"
           JOIN "channel" c ON c."id" = m."channelId"
          WHERE c."archivedAt" IS NULL
            AND (c."kind" = 'PUBLIC'
              OR EXISTS (SELECT 1 FROM "channel_member" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${userId}))
        ) AS "reaction",
        (SELECT count(*)::int FROM "channel_member" cm JOIN "channel" c ON c."id" = cm."channelId"
          WHERE cm."userId" = ${userId} AND c."archivedAt" IS NULL) AS "channels"`,
    unreadByChannel(userId),
  ]);
  const stamp = (v: Date | string | null) => (v ? new Date(v).toISOString() : "-");
  const row = rows[0];
  const total = [...unread.values()].reduce((n, c) => n + c.unread, 0);
  return {
    marker: `${stamp(row?.last ?? null)}|${stamp(row?.reaction ?? null)}|${row?.channels ?? 0}|${total}`,
    unread: total,
  };
}

/** Identifiant de message direct entre le lecteur et un autre associé. */
export const directSlugFor = (userId: string, otherId: string) =>
  otherId === userId ? persoSlug(userId) : dmSlug(userId, otherId);
