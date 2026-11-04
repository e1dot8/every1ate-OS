import "server-only";
import { randomBytes } from "node:crypto";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { formatDay, todayDate } from "@/lib/dates";
import { emitEvent } from "@/features/events/emit";
import { dueFollowUps } from "@/features/crm/service";
import { setPresence } from "@/features/presence/service";
import { saveStandup } from "@/features/qg/standup";
import { saveTask, type ServiceResult } from "@/features/projects/service";
import { foldText } from "@/features/search/rules";
import {
  accessChannel,
  createSystemMessage,
  type ChannelAccess,
  type ChannelRow,
} from "@/features/discussions/channels";
import {
  ATTACHMENT_TITLE_MAX,
  CHANNEL_NAME_MAX,
  MESSAGE_MAX_LENGTH,
  TOPIC_MAX,
  canArchiveChannel,
  canPostInChannel,
  channelSlugCandidates,
  channelTitle,
  extractMentionTokens,
  formatHourFr,
  formatMomentFr,
  helpLines,
  isCommand,
  isDefaultChannel,
  isHttpsUrl,
  isReaction,
  jitsiUrl,
  messageHref,
  plainExcerpt,
  reminderAt,
  resolveMentions,
  type EphemeralLine,
  type ParsedCommand,
  type ReminderChoice,
} from "@/features/discussions/rules";

/** Associé qui agit (session). */
export type Actor = { id: string; name: string };

const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

const NOT_FOUND = "Salon introuvable.";
const ARCHIVED = "Ce salon est archivé : il est en lecture seule.";
const MESSAGE_NOT_FOUND = "Message introuvable.";

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

function checkBody(body: string, allowEmpty = false): string | null {
  if (!body && !allowEmpty) return "Écris un message.";
  if (body.length > MESSAGE_MAX_LENGTH)
    return `Message trop long (${MESSAGE_MAX_LENGTH.toLocaleString("fr-FR")} caractères au plus).`;
  return null;
}

/** Message accessible au lecteur (contrôle d'accès du salon compris). */
async function accessMessage(messageId: string, userId: string) {
  const message = await getDb().message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      channelId: true,
      authorId: true,
      parentId: true,
      body: true,
      mentionIds: true,
      taskId: true,
      deletedAt: true,
      pinnedAt: true,
    },
  });
  if (!message) return null;
  const access = await accessChannel({ id: message.channelId }, userId);
  return access ? { message, ...access } : null;
}

// ─── Publication (mentions, messages directs) ───────────────────────────────

/** Personnes qu'un message de ce salon peut mentionner : tous les associés, ou les seuls membres. */
async function mentionablePeople(channel: ChannelRow) {
  const db = getDb();
  if (channel.kind === "PUBLIC")
    return db.user.findMany({ where: { role: "associe" }, select: { id: true, name: true } });
  return (
    await db.channelMember.findMany({
      where: { channelId: channel.id },
      select: { user: { select: { id: true, name: true } } },
    })
  ).map((m) => m.user);
}

async function resolveMessageMentions(channel: ChannelRow, body: string, authorId: string) {
  const tokens = extractMentionTokens(body);
  if (!tokens.length) return [];
  const people = await mentionablePeople(channel);
  const resolved = resolveMentions(tokens, people, authorId);
  const ids = new Set(resolved.ids);
  if (resolved.here) {
    const members = await getDb().channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    for (const m of members) if (m.userId !== authorId) ids.add(m.userId);
  }
  return [...ids];
}

function channelPlace(channel: ChannelRow) {
  if (channel.kind === "DIRECT") return "un message direct";
  if (channel.kind === "PERSO") return "tes notes";
  return `« ${channelTitle({ ...channel, projectName: channel.project?.name })} »`;
}

/** Notifie les nouvelles mentions et, en message direct, l'autre associé. */
async function announce(
  author: Actor,
  channel: ChannelRow,
  message: { id: string; parentId: string | null; body: string },
  mentionIds: string[],
  options: { direct: boolean },
) {
  const href = messageHref(channel.slug, message);
  const body = plainExcerpt(message.body) || undefined;
  const mentioned = mentionIds.filter((id) => id !== author.id);
  if (mentioned.length)
    await emitEvent({
      kind: "mention",
      actorId: author.id,
      title: `${author.name} te mentionne dans ${channelPlace(channel)}`,
      body,
      href,
      projectId: channel.projectId,
      recipients: mentioned,
      dedupeKey: `mention:${message.id}`,
      channelPost: false,
    });
  if (options.direct && channel.kind === "DIRECT") {
    const others = (
      await getDb().channelMember.findMany({
        where: { channelId: channel.id, userId: { not: author.id } },
        select: { userId: true },
      })
    )
      .map((m) => m.userId)
      .filter((id) => !mentioned.includes(id));
    if (others.length)
      await emitEvent({
        kind: "message.direct",
        actorId: author.id,
        title: `${author.name} t'a écrit`,
        body,
        href,
        recipients: others,
        dedupeKey: `dm:${message.id}`,
        channelPost: false,
      });
  }
}

/**
 * Publie le message d'un associé (accès vérifié par l'appelant) : mentions résolues,
 * notifications, salon marqué comme lu pour l'auteur. Utilisé aussi pour les messages programmés.
 */
export async function publishMessage(
  author: Actor,
  channel: ChannelRow,
  input: {
    body: string;
    parentId?: string | null;
    alsoInChannel?: boolean;
    attachment?: { title: string; url: string } | null;
  },
  now = new Date(),
): Promise<{ id: string }> {
  const db = getDb();
  const mentionIds = await resolveMessageMentions(channel, input.body, author.id);
  const message = await db.message.create({
    data: {
      channelId: channel.id,
      authorId: author.id,
      parentId: input.parentId ?? null,
      alsoInChannel: !!input.parentId && !!input.alsoInChannel,
      body: input.body,
      mentionIds,
      createdAt: now,
      ...(input.attachment ? { attachments: { create: [input.attachment] } } : {}),
    },
    select: { id: true, parentId: true, body: true },
  });
  await db.channelMember.upsert({
    where: { channelId_userId: { channelId: channel.id, userId: author.id } },
    create: { channelId: channel.id, userId: author.id, lastReadAt: now },
    update: { lastReadAt: now },
  });
  await announce(author, channel, message, mentionIds, { direct: true });
  return { id: message.id };
}

export type NewMessage = {
  channelId: string;
  body: string;
  parentId?: string | null;
  alsoInChannel?: boolean;
  attachment?: { title: string; url: string } | null;
};

function checkAttachment(attachment: NewMessage["attachment"]): string | null {
  if (!attachment) return null;
  if (!isHttpsUrl(attachment.url)) return "Le lien joint doit commencer par https://.";
  if (attachment.title.length > ATTACHMENT_TITLE_MAX) return "Titre du lien trop long.";
  return null;
}

async function checkParent(channelId: string, parentId: string | null | undefined) {
  if (!parentId) return null;
  const parent = await getDb().message.findFirst({
    where: { id: parentId, channelId },
    select: { parentId: true, deletedAt: true },
  });
  if (!parent || parent.parentId) return "Fil introuvable.";
  if (parent.deletedAt) return "Ce message a été supprimé : on ne peut plus y répondre.";
  return null;
}

export async function postMessage(
  actor: Actor,
  input: NewMessage,
): Promise<ServiceResult<{ id: string; slug: string }>> {
  const access = await accessChannel({ id: input.channelId }, actor.id);
  if (!access) return failed(NOT_FOUND);
  if (!canPostInChannel(access.channel, !!access.member)) return failed(ARCHIVED);
  const body = input.body.trim();
  const problem =
    checkBody(body, !!input.attachment) ??
    checkAttachment(input.attachment) ??
    (await checkParent(access.channel.id, input.parentId));
  if (problem) return failed(problem);
  const message = await publishMessage(actor, access.channel, { ...input, body });
  return done({ id: message.id, slug: access.channel.slug });
}

export async function editMessage(
  actor: Actor,
  messageId: string,
  rawBody: string,
): Promise<ServiceResult<{ slug: string; parentId: string | null }>> {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.authorId !== actor.id || found.message.deletedAt)
    return failed(MESSAGE_NOT_FOUND);
  if (!canPostInChannel(found.channel, !!found.member)) return failed(ARCHIVED);
  const body = rawBody.trim();
  const problem = checkBody(body);
  if (problem) return failed(problem);
  if (isCommand(body))
    return failed("Une commande ne remplace pas un message : écris-la dans un nouveau message.");
  const mentionIds = await resolveMessageMentions(found.channel, body, actor.id);
  await getDb().message.update({
    where: { id: messageId },
    data: { body, mentionIds, editedAt: new Date() },
  });
  // Seules les personnes ajoutées sont prévenues (même clé : jamais deux fois la même personne).
  const added = mentionIds.filter((id) => !found.message.mentionIds.includes(id));
  if (added.length)
    await announce(actor, found.channel, { ...found.message, body }, added, { direct: false });
  return done({ slug: found.channel.slug, parentId: found.message.parentId });
}

/** Suppression douce : le message devient « Message supprimé », son fil reste lisible. */
export async function deleteMessage(
  actor: Actor,
  messageId: string,
): Promise<ServiceResult<{ slug: string; parentId: string | null }>> {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.authorId !== actor.id || found.message.deletedAt)
    return failed(MESSAGE_NOT_FOUND);
  const db = getDb();
  await db.$transaction([
    db.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: "", mentionIds: [], pinnedAt: null, pinnedById: null },
    }),
    db.messageAttachment.deleteMany({ where: { messageId } }),
    db.messageReaction.deleteMany({ where: { messageId } }),
  ]);
  await recordAudit({
    action: "channel.message_deleted",
    actorId: actor.id,
    targetType: "message",
    targetId: messageId,
    after: { channelId: found.channel.id },
  });
  return done({ slug: found.channel.slug, parentId: found.message.parentId });
}

async function writableMessage(actor: Actor, messageId: string) {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.deletedAt) return { error: MESSAGE_NOT_FOUND } as const;
  if (!canPostInChannel(found.channel, !!found.member)) return { error: ARCHIVED } as const;
  return { found } as const;
}

export async function toggleReaction(
  actor: Actor,
  messageId: string,
  emoji: string,
): Promise<ServiceResult<{ slug: string }>> {
  if (!isReaction(emoji)) return failed("Réaction inconnue.");
  const { found, error } = await writableMessage(actor, messageId);
  if (!found) return failed(error);
  const db = getDb();
  const removed = await db.messageReaction.deleteMany({ where: { messageId, userId: actor.id, emoji } });
  if (!removed.count) {
    try {
      await db.messageReaction.create({ data: { messageId, userId: actor.id, emoji } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return done({ slug: found.channel.slug });
}

export async function togglePin(
  actor: Actor,
  messageId: string,
): Promise<ServiceResult<{ slug: string; pinned: boolean }>> {
  const { found, error } = await writableMessage(actor, messageId);
  if (!found) return failed(error);
  const pinned = !found.message.pinnedAt;
  await getDb().message.update({
    where: { id: messageId },
    data: pinned ? { pinnedAt: new Date(), pinnedById: actor.id } : { pinnedAt: null, pinnedById: null },
  });
  return done({ slug: found.channel.slug, pinned });
}

/** « Plus tard » : enregistre (ou retire) un message pour y revenir. */
export async function toggleSaved(
  actor: Actor,
  messageId: string,
): Promise<ServiceResult<{ slug: string; saved: boolean }>> {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.deletedAt) return failed(MESSAGE_NOT_FOUND);
  const db = getDb();
  const removed = await db.savedMessage.deleteMany({ where: { userId: actor.id, messageId } });
  if (removed.count) return done({ slug: found.channel.slug, saved: false });
  try {
    await db.savedMessage.create({ data: { userId: actor.id, messageId } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
  return done({ slug: found.channel.slug, saved: true });
}

// ─── Rappels et envois programmés ───────────────────────────────────────────

export async function remindAboutMessage(
  actor: Actor,
  messageId: string,
  choice: ReminderChoice,
  now = new Date(),
): Promise<ServiceResult<{ slug: string; remindAt: Date }>> {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.deletedAt) return failed(MESSAGE_NOT_FOUND);
  const remindAt = reminderAt(choice, now);
  await getDb().reminder.create({
    data: {
      userId: actor.id,
      messageId,
      text: plainExcerpt(found.message.body, 200) || "Message",
      remindAt,
    },
  });
  return done({ slug: found.channel.slug, remindAt });
}

export async function createReminder(
  actor: Actor,
  text: string,
  remindAt: Date,
): Promise<ServiceResult<null>> {
  const clean = text.trim();
  if (!clean) return failed("Écris le texte du rappel.");
  if (clean.length > 500) return failed("Rappel trop long (500 caractères).");
  await getDb().reminder.create({ data: { userId: actor.id, text: clean, remindAt } });
  return done(null);
}

export async function deleteReminder(actor: Actor, reminderId: string): Promise<ServiceResult<null>> {
  const removed = await getDb().reminder.deleteMany({ where: { id: reminderId, userId: actor.id } });
  return removed.count ? done(null) : failed("Rappel introuvable.");
}

const MAX_SCHEDULE_MS = 365 * 24 * 3600_000;

export async function scheduleMessage(
  actor: Actor,
  input: { channelId: string; body: string; parentId?: string | null; sendAt: Date },
  now = new Date(),
): Promise<ServiceResult<{ slug: string }>> {
  const access = await accessChannel({ id: input.channelId }, actor.id);
  if (!access) return failed(NOT_FOUND);
  if (!canPostInChannel(access.channel, !!access.member)) return failed(ARCHIVED);
  const body = input.body.trim();
  const problem = checkBody(body) ?? (await checkParent(access.channel.id, input.parentId));
  if (problem) return failed(problem);
  if (isCommand(body))
    return failed("Les commandes s'exécutent tout de suite : elles ne se programment pas.");
  if (input.sendAt.getTime() < now.getTime() + 60_000)
    return failed("Choisis une heure d'envoi dans le futur (au moins une minute).");
  if (input.sendAt.getTime() > now.getTime() + MAX_SCHEDULE_MS)
    return failed("Programmation possible jusqu'à un an.");
  await getDb().scheduledMessage.create({
    data: {
      authorId: actor.id,
      channelId: access.channel.id,
      parentId: input.parentId ?? null,
      body,
      sendAt: input.sendAt,
    },
  });
  return done({ slug: access.channel.slug });
}

export async function cancelScheduled(actor: Actor, scheduledId: string): Promise<ServiceResult<null>> {
  const updated = await getDb().scheduledMessage.updateMany({
    where: { id: scheduledId, authorId: actor.id, sentAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  return updated.count ? done(null) : failed("Message programmé introuvable ou déjà envoyé.");
}

/** Fin du focus de l'autre associé d'un message direct (pour « Envoyer à la fin de son focus »). */
export async function partnerFocusEnd(
  channelId: string,
  userId: string,
  now = new Date(),
): Promise<Date | null> {
  const partner = await getDb().channelMember.findFirst({
    where: { channelId, userId: { not: userId }, channel: { kind: "DIRECT" } },
    select: { user: { select: { presenceState: true, presenceUntil: true, presenceShared: true } } },
  });
  const p = partner?.user;
  if (!p || !p.presenceShared || p.presenceState !== "FOCUS" || !p.presenceUntil) return null;
  return p.presenceUntil > now ? p.presenceUntil : null;
}

// ─── Salons ─────────────────────────────────────────────────────────────────

async function associateIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  return (
    await getDb().user.findMany({ where: { id: { in: ids }, role: "associe" }, select: { id: true } })
  ).map((u) => u.id);
}

export async function createChannel(
  actor: Actor,
  input: { name: string; topic: string | null; isPrivate: boolean; memberIds: string[] },
): Promise<ServiceResult<{ slug: string }>> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return failed("Donne un nom au salon.");
  if (name.length > CHANNEL_NAME_MAX) return failed(`Nom trop long (${CHANNEL_NAME_MAX} caractères).`);
  const topic = input.topic?.trim() || null;
  if (topic && topic.length > TOPIC_MAX) return failed(`Sujet trop long (${TOPIC_MAX} caractères).`);
  const others = input.isPrivate
    ? (await associateIds([...new Set(input.memberIds)])).filter((id) => id !== actor.id)
    : [];
  const db = getDb();
  for (const slug of channelSlugCandidates(name, randomBytes(6).toString("hex"))) {
    try {
      const channel = await db.channel.create({
        data: {
          slug,
          name,
          topic,
          kind: input.isPrivate ? "PRIVE" : "PUBLIC",
          createdById: actor.id,
          members: { create: [actor.id, ...others].map((userId) => ({ userId })) },
        },
        select: { id: true, slug: true, kind: true },
      });
      await recordAudit({
        action: "channel.created",
        actorId: actor.id,
        targetType: "channel",
        targetId: channel.id,
        after: { name, kind: channel.kind, memberIds: [actor.id, ...others] },
      });
      return done({ slug: channel.slug });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return failed("Impossible de créer le salon : réessaie.");
}

async function editableChannel(actor: Actor, channelId: string) {
  const access = await accessChannel({ id: channelId }, actor.id);
  if (!access) return { error: NOT_FOUND } as const;
  if (!canPostInChannel(access.channel, !!access.member)) return { error: ARCHIVED } as const;
  return { access } as const;
}

/** Sujet, lien visio et (salons créés à la main) nom. */
export async function updateChannel(
  actor: Actor,
  channelId: string,
  input: { name?: string | null; topic: string | null; meetUrl: string | null },
): Promise<ServiceResult<{ slug: string }>> {
  const { access, error } = await editableChannel(actor, channelId);
  if (!access) return failed(error);
  const { channel } = access;
  const topic = input.topic?.trim() || null;
  if (topic && topic.length > TOPIC_MAX) return failed(`Sujet trop long (${TOPIC_MAX} caractères).`);
  const meetUrl = input.meetUrl?.trim() || null;
  if (meetUrl && !isHttpsUrl(meetUrl)) return failed("Le lien visio doit commencer par https://.");
  const renamable =
    (channel.kind === "PUBLIC" || channel.kind === "PRIVE") &&
    !channel.projectId &&
    !isDefaultChannel(channel.slug);
  const name = renamable && input.name ? input.name.replace(/\s+/g, " ").trim() : channel.name;
  if (!name) return failed("Donne un nom au salon.");
  if (name.length > CHANNEL_NAME_MAX) return failed(`Nom trop long (${CHANNEL_NAME_MAX} caractères).`);
  const changes = diff(
    { name: channel.name, topic: channel.topic, meetUrl: channel.meetUrl },
    { name, topic, meetUrl },
  );
  if (!changes.changed) return done({ slug: channel.slug });
  await getDb().channel.update({ where: { id: channelId }, data: { name, topic, meetUrl } });
  await recordAudit({
    action: "channel.updated",
    actorId: actor.id,
    targetType: "channel",
    targetId: channelId,
    before: changes.before,
    after: changes.after,
  });
  return done({ slug: channel.slug });
}

/** « Créer une salle Jitsi » : lien gratuit, propre au salon, enregistré comme lien visio. */
export async function createJitsiRoom(
  actor: Actor,
  channelId: string,
): Promise<ServiceResult<{ slug: string }>> {
  const { access, error } = await editableChannel(actor, channelId);
  if (!access) return failed(error);
  const meetUrl = jitsiUrl(access.channel.slug, randomBytes(5).toString("hex"));
  await getDb().channel.update({ where: { id: channelId }, data: { meetUrl } });
  await recordAudit({
    action: "channel.updated",
    actorId: actor.id,
    targetType: "channel",
    targetId: channelId,
    before: { meetUrl: access.channel.meetUrl },
    after: { meetUrl },
  });
  return done({ slug: access.channel.slug });
}

export async function addChannelMember(
  actor: Actor,
  channelId: string,
  userId: string,
): Promise<ServiceResult<{ slug: string }>> {
  const { access, error } = await editableChannel(actor, channelId);
  if (!access) return failed(error);
  if (access.channel.kind !== "PRIVE") return failed("Seuls les salons privés gèrent leurs membres.");
  if (!(await associateIds([userId])).length) return failed("Associé introuvable.");
  const created = await getDb().channelMember.createMany({
    data: [{ channelId, userId }],
    skipDuplicates: true,
  });
  if (created.count)
    await recordAudit({
      action: "channel.member_added",
      actorId: actor.id,
      targetType: "channel",
      targetId: channelId,
      after: { userId },
    });
  return done({ slug: access.channel.slug });
}

/** Retire un membre d'un salon privé (soi-même : quitter). Le dernier membre ne part pas. */
export async function removeChannelMember(
  actor: Actor,
  channelId: string,
  userId: string,
): Promise<ServiceResult<{ slug: string; left: boolean }>> {
  const { access, error } = await editableChannel(actor, channelId);
  if (!access) return failed(error);
  if (access.channel.kind !== "PRIVE") return failed("Seuls les salons privés gèrent leurs membres.");
  const db = getDb();
  const count = await db.channelMember.count({ where: { channelId } });
  if (count <= 1) return failed("Le dernier membre ne peut pas quitter le salon : archive-le plutôt.");
  const removed = await db.channelMember.deleteMany({ where: { channelId, userId } });
  if (!removed.count) return failed("Cette personne n'est pas membre du salon.");
  await recordAudit({
    action: "channel.member_removed",
    actorId: actor.id,
    targetType: "channel",
    targetId: channelId,
    before: { userId },
  });
  return done({ slug: access.channel.slug, left: userId === actor.id });
}

/** Archive (lecture seule) ou restaure un salon ; jamais les salons par défaut ni les messages directs. */
export async function setChannelArchived(
  actor: Actor,
  channelId: string,
  archived: boolean,
): Promise<ServiceResult<{ slug: string }>> {
  const access = await accessChannel({ id: channelId }, actor.id);
  if (!access) return failed(NOT_FOUND);
  const { channel } = access;
  if (!canArchiveChannel(channel)) return failed("Ce salon ne peut pas être archivé.");
  if (!!channel.archivedAt === archived) return done({ slug: channel.slug });
  await getDb().channel.update({
    where: { id: channelId },
    data: { archivedAt: archived ? new Date() : null },
  });
  await recordAudit({
    action: archived ? "channel.archived" : "channel.restored",
    actorId: actor.id,
    targetType: "channel",
    targetId: channelId,
    after: { name: channel.name },
  });
  return done({ slug: channel.slug });
}

// ─── Tâches ─────────────────────────────────────────────────────────────────

async function openProject(projectId: string) {
  return getDb().project.findFirst({
    where: { id: projectId, archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] } },
    select: { id: true, name: true },
  });
}

async function createTaskFrom(
  actor: Actor,
  input: { projectId: string; title: string; ownerId: string | null; dueDate: Date | null; origin: string },
): Promise<ServiceResult<{ id: string }>> {
  if (!(await openProject(input.projectId))) return failed("Projet introuvable ou clôturé.");
  if (input.ownerId && !(await associateIds([input.ownerId])).length)
    return failed("Responsable introuvable.");
  return saveTask(
    input.projectId,
    null,
    {
      title: input.title,
      description: input.origin,
      workPackageId: null,
      ownerId: input.ownerId,
      contributorIds: [],
      priority: "AUTO",
      impact: "MOYEN",
      startDate: null,
      dueDate: input.dueDate,
      estimatedMinutes: null,
    },
    actor,
  );
}

/** « Transformer en tâche » : la tâche est créée via le service des tâches, le message y est lié. */
export async function convertMessageToTask(
  actor: Actor,
  messageId: string,
  input: { title: string; projectId: string; ownerId: string | null; dueDate: Date | null },
): Promise<ServiceResult<{ taskId: string; slug: string; rootId: string }>> {
  const found = await accessMessage(messageId, actor.id);
  if (!found || found.message.deletedAt) return failed(MESSAGE_NOT_FOUND);
  if (found.message.taskId) return failed("Ce message est déjà lié à une tâche.");
  if (!canPostInChannel(found.channel, !!found.member)) return failed(ARCHIVED);
  const title = input.title.trim();
  if (!title) return failed("Donne un titre à la tâche.");
  const where = channelTitle({ ...found.channel, projectName: found.channel.project?.name });
  const created = await createTaskFrom(actor, {
    ...input,
    title,
    origin: `Créée depuis un message de « ${where} ».`,
  });
  if (!created.ok) return created;
  const db = getDb();
  await db.message.updateMany({ where: { id: messageId, taskId: null }, data: { taskId: created.data.id } });
  const rootId = found.message.parentId ?? found.message.id;
  await createSystemMessage({
    channelId: found.channel.id,
    parentId: rootId,
    text: `Tâche créée par ${actor.name} : « ${title} »`,
    href: `/taches/${created.data.id}`,
  });
  return done({ taskId: created.data.id, slug: found.channel.slug, rootId });
}

// ─── Commandes ──────────────────────────────────────────────────────────────

export type CommandReply = { message: string; lines?: EphemeralLine[] };

async function runTaskCommand(
  actor: Actor,
  access: ChannelAccess,
  cmd: Extract<ParsedCommand, { command: "tache" }>,
): Promise<ServiceResult<CommandReply>> {
  const { channel } = access;
  if (!channel.projectId)
    return failed(
      "/tache crée la tâche dans le projet du salon : utilise-la dans le salon d'un projet, ou « Transformer en tâche » sur un message pour choisir le projet.",
    );
  let ownerId: string | null = actor.id;
  let ownerName: string | null = actor.name;
  if (cmd.owner) {
    const people = await getDb().user.findMany({
      where: { role: "associe" },
      select: { id: true, name: true },
    });
    const resolved = resolveMentions([cmd.owner], people, null);
    if (resolved.ambiguous.length)
      return failed(`Plusieurs associés s'appellent ${cmd.owner} : écris le nom complet (ex. @PrénomNom).`);
    if (!resolved.ids.length) return failed(`Aucun associé ne s'appelle ${cmd.owner}.`);
    ownerId = resolved.ids[0];
    ownerName = people.find((p) => p.id === ownerId)?.name ?? null;
  }
  const created = await createTaskFrom(actor, {
    projectId: channel.projectId,
    title: cmd.title,
    ownerId,
    dueDate: cmd.due,
    origin: `Créée avec /tache dans « ${channelTitle({ ...channel, projectName: channel.project?.name })} ».`,
  });
  if (!created.ok) return created;
  const href = `/taches/${created.data.id}`;
  const details = [ownerName, cmd.due ? `échéance ${formatDay(cmd.due)}` : null].filter(Boolean).join(" · ");
  await createSystemMessage({
    channelId: channel.id,
    text: `Tâche créée par ${actor.name} : « ${cmd.title} »${details ? ` · ${details}` : ""}`,
    href,
  });
  return done({ message: `Tâche créée : « ${cmd.title} ».`, lines: [{ text: "Ouvrir la tâche", href }] });
}

async function runFollowUpCommand(filter: string | null, now: Date): Promise<ServiceResult<CommandReply>> {
  const due = await dueFollowUps(todayDate(now));
  const needle = filter ? foldText(filter) : null;
  const shown = due
    .filter((o) => !needle || foldText(o.title).includes(needle))
    .sort((a, b) => (a.nextActionDate?.getTime() ?? 0) - (b.nextActionDate?.getTime() ?? 0));
  if (!shown.length)
    return done({
      message: filter ? `Aucune relance en retard pour « ${filter} ».` : "Aucune relance en retard.",
    });
  return done({
    message: `${shown.length} relance${shown.length > 1 ? "s" : ""} à faire :`,
    lines: shown.slice(0, 15).map((o) => ({
      text: `${o.title} — ${o.nextAction ?? "relance"} (prévue le ${formatDay(o.nextActionDate)})`,
      href: `/crm/opportunites/${o.id}`,
    })),
  });
}

/**
 * Exécute une commande du compositeur. Les réponses sont éphémères (visibles par l'auteur
 * seul, jamais stockées) ; seules /tache et /huddle publient dans le salon.
 */
export async function runCommand(
  actor: Actor,
  channelId: string,
  cmd: ParsedCommand,
  now = new Date(),
): Promise<ServiceResult<CommandReply>> {
  if (!cmd.ok) return failed(cmd.error);
  const access = await accessChannel({ id: channelId }, actor.id);
  if (!access) return failed(NOT_FOUND);
  const { channel } = access;
  switch (cmd.command) {
    case "aide":
      return done({ message: "Commandes disponibles :", lines: helpLines() });
    case "tache":
      if (!canPostInChannel(channel, !!access.member)) return failed(ARCHIVED);
      return runTaskCommand(actor, access, cmd);
    case "relance":
      return runFollowUpCommand(cmd.filter, now);
    case "focus": {
      const until = new Date(now.getTime() + cmd.minutes * 60_000);
      const result = await setPresence(actor.id, { state: "FOCUS", until, note: null });
      if (!result.ok) return result;
      return done({
        message: `Focus jusqu'à ${formatHourFr(until)} : les notifications sur ton téléphone sont en pause. /dispo pour en sortir.`,
      });
    }
    case "dispo": {
      const result = await setPresence(actor.id, { state: "DISPO", until: null, note: null });
      if (!result.ok) return result;
      return done({ message: "Tu es de nouveau disponible." });
    }
    case "standup": {
      const result = await saveStandup(actor, { today: cmd.today, blocked: cmd.blocked }, now);
      if (!result.ok) return result;
      return done({
        message: cmd.blocked
          ? "Stand-up enregistré : l'équipe est prévenue du blocage."
          : "Stand-up enregistré.",
      });
    }
    case "rappel": {
      const result = await createReminder(actor, cmd.text, cmd.remindAt);
      if (!result.ok) return result;
      const when = formatMomentFr(cmd.remindAt, now);
      return done({
        message: `Rappel programmé ${/^\d/.test(when) ? `à ${when}` : when}.`,
        lines: [{ text: "Voir mes rappels", href: "/discussions/activite#rappels" }],
      });
    }
    case "huddle": {
      if (!channel.meetUrl)
        return done({
          message: "Ce salon n'a pas encore de lien visio.",
          lines: [
            {
              text: "Définir le lien visio (ou créer une salle Jitsi)",
              href: `/discussions/${channel.slug}/reglages`,
            },
          ],
        });
      if (!canPostInChannel(channel, !!access.member)) return failed(ARCHIVED);
      await publishMessage(
        actor,
        channel,
        { body: `🎧 Huddle : rejoignez la visio ${channel.meetUrl}` },
        now,
      );
      return done({ message: "Lien visio partagé dans le salon." });
    }
  }
}
