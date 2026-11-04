import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import type { ServiceResult } from "@/features/projects/service";
import {
  accessChannel,
  channelSelect,
  ensureProjectChannel,
  type ChannelRow,
} from "@/features/discussions/channels";
import { linkedTasks, messageInclude, type MessageWithDetails } from "@/features/discussions/queries";
import { canPostInChannel, isCommand, plainExcerpt } from "@/features/discussions/rules";
import { checkAttachment, checkBody, postMessage } from "@/features/discussions/service";
import { loadSubjectContext, type SubjectContext } from "@/features/discussions/subject-notify";
import {
  aboutFields,
  byLastActivity,
  lastActivity,
  legacyCommentsByTask,
  legacyReplyData,
  legacyRootDate,
  subjectHref,
  subjectReadOnlyReason,
  subjectRootBody,
  type Subject,
} from "@/features/discussions/subject-rules";

/**
 * Discussions rattachées à une tâche ou à un livrable (V1.3). Chaque élément a un fil unique dans
 * le salon de son projet : la racine est un message du QG (sans auteur) qui porte l'élément, les
 * commentaires en sont les réponses. La page de l'élément affiche ce fil ; le salon du projet
 * et l'onglet Discussion du projet regroupent tous ces fils, classés par élément.
 */

const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

const notFound = (subject: Subject) =>
  subject.type === "task" ? "Tâche introuvable." : "Livrable introuvable.";

const rootWhere = (subject: Subject): Prisma.MessageWhereInput => ({
  ...aboutFields(subject),
  parentId: null,
});

export type SubjectThread = { rootId: string; channel: ChannelRow; context: SubjectContext };

async function findRoot(subject: Subject) {
  return getDb().message.findFirst({
    where: rootWhere(subject),
    select: { id: true, channel: { select: channelSelect } },
  });
}

/**
 * Fil de l'élément : trouvé, ou créé dans le salon du projet (créé lui aussi au besoin). Une seule
 * racine par élément (index unique partiel) : deux créations simultanées se rejoignent.
 * `createdAt` : date de la racine (reprise d'anciens commentaires). Null si l'élément n'existe pas.
 */
export async function ensureSubjectThread(
  subject: Subject,
  actorId: string | null,
  options: { createdAt?: Date } = {},
): Promise<SubjectThread | null> {
  const context = await loadSubjectContext(subject);
  if (!context) return null;
  const existing = await findRoot(subject);
  if (existing) return { rootId: existing.id, channel: existing.channel, context };
  const channel = await ensureProjectChannel(context.projectId, actorId);
  if (!channel) return null;
  try {
    const root = await getDb().message.create({
      data: {
        channelId: channel.id,
        authorId: null,
        parentId: null,
        body: subjectRootBody(subject.type, context.title),
        ...aboutFields(subject),
        meta: { href: subjectHref(subject), subject: { type: subject.type, id: subject.id } },
        ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      },
      select: { id: true },
    });
    return { rootId: root.id, channel, context };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Créée en parallèle (premier commentaire simultané, reprise) : on rejoint celle-ci.
    const raced = await findRoot(subject);
    if (!raced) throw error;
    return { rootId: raced.id, channel: raced.channel, context };
  }
}

async function authorOf(actor: { id: string; name?: string }) {
  if (actor.name) return { id: actor.id, name: actor.name };
  const user = await getDb().user.findUnique({ where: { id: actor.id }, select: { id: true, name: true } });
  return user;
}

/**
 * Commentaire sur une tâche ou un livrable : réponse dans le fil de l'élément, publiée par la
 * mécanique des discussions (accès au salon du projet, mentions, lien joint, événement
 * « commentaire »). Refusé si le projet, l'élément ou le salon du projet est archivé.
 * Le salon n'est pas marqué comme lu pour l'auteur (il ne l'a pas sous les yeux).
 */
export async function postSubjectComment(
  actor: { id: string; name?: string },
  subject: Subject,
  input: {
    body: string;
    attachment?: { title: string; url: string } | null;
    alsoInChannel?: boolean;
  },
): Promise<
  ServiceResult<{ id: string; rootId: string; slug: string; projectId: string; ambiguous: string[] }>
> {
  const context = await loadSubjectContext(subject);
  if (!context) return failed(notFound(subject));
  const locked = subjectReadOnlyReason({
    type: subject.type,
    projectArchived: context.projectArchived,
    elementArchived: context.archived,
  });
  if (locked) return failed(locked);
  const body = input.body.trim();
  const attachment = input.attachment ?? null;
  const problem = checkBody(body, !!attachment) ?? checkAttachment(attachment);
  if (problem) return failed(problem === "Écris un message." ? "Écris un commentaire." : problem);
  if (isCommand(body)) return failed("Les commandes (/aide, /tache…) s'utilisent dans le salon du projet.");
  const author = await authorOf(actor);
  if (!author) return failed("Associé introuvable.");

  // Contrôle d'accès et d'écriture du salon du projet avant de créer quoi que ce soit.
  const channel = await ensureProjectChannel(context.projectId, actor.id);
  const access = channel ? await accessChannel({ id: channel.id }, actor.id) : null;
  if (!access) return failed("Salon du projet introuvable.");
  if (!canPostInChannel(access.channel, !!access.member))
    return failed(
      subjectReadOnlyReason({
        type: subject.type,
        projectArchived: false,
        elementArchived: false,
        channelArchived: true,
      })!,
    );

  const thread = await ensureSubjectThread(subject, actor.id);
  if (!thread) return failed(notFound(subject));
  const posted = await postMessage(author, {
    channelId: thread.channel.id,
    parentId: thread.rootId,
    body,
    alsoInChannel: !!input.alsoInChannel,
    attachment,
    markRead: false,
  });
  if (!posted.ok) return posted;
  await recordAudit(
    subject.type === "task"
      ? {
          action: "task.commented",
          actorId: author.id,
          projectId: context.projectId,
          targetType: "task",
          targetId: subject.id,
        }
      : {
          // Hors du fil d'activité du livrable (réservé à ses propriétés) : journal du projet seulement.
          action: "deliverable.commented",
          actorId: author.id,
          projectId: context.projectId,
          targetType: "message",
          targetId: posted.data.id,
          after: { deliverableId: subject.id },
        },
  );
  return done({
    id: posted.data.id,
    rootId: thread.rootId,
    slug: posted.data.slug,
    projectId: context.projectId,
    ambiguous: posted.data.ambiguous,
  });
}

// ─── Lectures ───────────────────────────────────────────────────────────────

export type SubjectDiscussion = {
  context: SubjectContext;
  rootId: string | null;
  /** Salon du projet (absent tant que personne n'y a écrit). */
  channel: { id: string; slug: string } | null;
  comments: MessageWithDetails[];
  tasks: Map<string, string>;
  /** Motif de lecture seule, sinon null. */
  readOnly: string | null;
};

/** Commentaires d'un élément (réponses de son fil), dans l'ordre chronologique. Null si l'élément n'existe pas. */
export async function listSubjectComments(
  subject: Subject,
  viewerId: string,
): Promise<SubjectDiscussion | null> {
  const context = await loadSubjectContext(subject);
  if (!context) return null;
  const db = getDb();
  const root = await db.message.findFirst({
    where: rootWhere(subject),
    select: { id: true, channelId: true },
  });
  const channelId =
    root?.channelId ??
    (await db.channel.findUnique({ where: { projectId: context.projectId }, select: { id: true } }))?.id ??
    null;
  const access = channelId ? await accessChannel({ id: channelId }, viewerId) : null;
  const readOnly = subjectReadOnlyReason({
    type: subject.type,
    projectArchived: context.projectArchived,
    elementArchived: context.archived,
    channelArchived: !!access?.channel.archivedAt,
  });
  // Salon existant mais inaccessible au lecteur : rien n'est révélé.
  if (channelId && !access)
    return {
      context,
      rootId: null,
      channel: null,
      comments: [],
      tasks: new Map(),
      readOnly: "Salon du projet inaccessible.",
    };
  const comments =
    root && access
      ? await db.message.findMany({
          where: { parentId: root.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 500,
          include: messageInclude(viewerId),
        })
      : [];
  return {
    context,
    rootId: root && access ? root.id : null,
    channel: access ? { id: access.channel.id, slug: access.channel.slug } : null,
    comments,
    tasks: await linkedTasks(comments),
    readOnly,
  };
}

export type ProjectSubjectThread = {
  rootId: string;
  subject: Subject;
  title: string;
  /** Section Discussion de la page de l'élément. */
  href: string;
  /** Réponses non supprimées. */
  replies: number;
  lastActivityAt: Date;
  last: { authorName: string | null; excerpt: string } | null;
};

/**
 * Fils des éléments d'un projet (racines du salon du projet portant une tâche ou un livrable),
 * du plus récemment actif au plus ancien. Vide si le salon n'existe pas ou n'est pas accessible.
 */
export async function projectSubjectThreads(
  projectId: string,
  viewerId: string,
): Promise<ProjectSubjectThread[]> {
  const channel = await getDb().channel.findUnique({ where: { projectId }, select: { id: true } });
  const access = channel ? await accessChannel({ id: channel.id }, viewerId) : null;
  return access ? subjectThreadsIn(access.channel.id) : [];
}

async function subjectThreadsIn(channelId: string): Promise<ProjectSubjectThread[]> {
  const roots = await getDb().message.findMany({
    where: {
      channelId,
      parentId: null,
      OR: [{ aboutTaskId: { not: null } }, { aboutDeliverableId: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      createdAt: true,
      aboutTask: { select: { id: true, title: true } },
      aboutDeliverable: { select: { id: true, title: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true, body: true, author: { select: { name: true } } },
      },
      _count: { select: { replies: { where: { deletedAt: null } } } },
    },
  });
  const threads: ProjectSubjectThread[] = [];
  for (const r of roots) {
    const element = r.aboutTask ?? r.aboutDeliverable;
    if (!element) continue;
    const last = r.replies[0] ?? null;
    const subject: Subject = { type: r.aboutTask ? "task" : "deliverable", id: element.id };
    threads.push({
      rootId: r.id,
      subject,
      title: element.title,
      href: subjectHref(subject),
      replies: r._count.replies,
      lastActivityAt: lastActivity(r.createdAt, last?.createdAt),
      last: last
        ? { authorName: last.author?.name ?? null, excerpt: plainExcerpt(last.body, 120) || "Lien joint" }
        : null,
    });
  }
  return byLastActivity(threads);
}

export type ProjectDiscussion = {
  channel: { id: string; slug: string; archivedAt: Date | null } | null;
  messages: MessageWithDetails[];
  hasMore: boolean;
  tasks: Map<string, string>;
  threads: ProjectSubjectThread[];
};

/**
 * Onglet Discussion d'un projet : derniers messages généraux du salon (hors fils d'éléments,
 * sauf réponses « aussi dans le salon ») et fils par élément. Le salon est créé à la demande
 * (comme /discussions?projet=), jamais pour un projet archivé.
 */
export async function projectDiscussion(
  projectId: string,
  viewerId: string,
  options: { archived: boolean; take?: number },
): Promise<ProjectDiscussion> {
  const db = getDb();
  const take = options.take ?? 20;
  const found = options.archived
    ? await db.channel.findUnique({ where: { projectId }, select: { id: true } })
    : await ensureProjectChannel(projectId, viewerId);
  const access = found ? await accessChannel({ id: found.id }, viewerId) : null;
  if (!access) return { channel: null, messages: [], hasMore: false, tasks: new Map(), threads: [] };
  const channelId = access.channel.id;
  const [rows, threads] = await Promise.all([
    db.message.findMany({
      where: {
        channelId,
        OR: [{ parentId: null, aboutTaskId: null, aboutDeliverableId: null }, { alsoInChannel: true }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: messageInclude(viewerId),
    }),
    subjectThreadsIn(channelId),
  ]);
  const messages = rows.slice(0, take).reverse();
  return {
    channel: { id: channelId, slug: access.channel.slug, archivedAt: access.channel.archivedAt },
    messages,
    hasMore: rows.length > take,
    tasks: await linkedTasks(messages),
    threads,
  };
}

// ─── Reprise des anciens commentaires de tâche (V1) ─────────────────────────

class AlreadyMoved extends Error {}

/**
 * Recopie les anciens commentaires de tâche (`TaskComment`) pas encore repris dans le fil de leur
 * tâche : auteur, texte et dates conservés, sans notification. Chaque commentaire est réservé dans
 * la même transaction que sa copie (`movedToMessageId`) : deux passes simultanées (page affichée,
 * passe planifiée) ne le recopient jamais deux fois. Idempotente ; par lots (`limit`).
 */
export async function moveLegacyTaskComments(
  options: { taskId?: string; limit?: number } = {},
  now = new Date(),
): Promise<{ moved: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 200), 1), 500);
  const pending = await db.taskComment.findMany({
    where: { movedToMessageId: null, ...(options.taskId ? { taskId: options.taskId } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      taskId: true,
      authorId: true,
      body: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      movedToMessageId: true,
    },
  });
  let moved = 0;
  for (const [taskId, comments] of legacyCommentsByTask(pending)) {
    const thread = await ensureSubjectThread({ type: "task", id: taskId }, null, {
      createdAt: legacyRootDate(comments, now),
    });
    if (!thread) continue;
    const root = { id: thread.rootId, channelId: thread.channel.id };
    let count = 0;
    for (const comment of comments) {
      try {
        await db.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: legacyReplyData(comment, root),
            select: { id: true },
          });
          const claimed = await tx.taskComment.updateMany({
            where: { id: comment.id, movedToMessageId: null },
            data: { movedToMessageId: message.id },
          });
          // Déjà repris par une autre passe : la copie est annulée avec la transaction.
          if (!claimed.count) throw new AlreadyMoved();
        });
        count += 1;
      } catch (error) {
        if (!(error instanceof AlreadyMoved)) throw error;
      }
    }
    if (count)
      await recordAudit({
        action: "task.comments_moved",
        actorId: null,
        projectId: thread.context.projectId,
        targetType: "task",
        targetId: taskId,
        after: { count },
      });
    moved += count;
  }
  return { moved };
}
