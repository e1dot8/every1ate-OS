/**
 * Discussions rattachées à un élément (V1.3) : chaque tâche et chaque livrable a son fil dans le
 * salon de son projet. La racine du fil (message du QG, sans auteur) et ses réponses portent
 * l'élément (`aboutTaskId` / `aboutDeliverableId`). Règles pures : partagées par le serveur,
 * les composants et les tests unitaires.
 */
import { MESSAGE_MAX_LENGTH } from "@/features/discussions/rules";

export const SUBJECT_TYPES = ["task", "deliverable"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];
/** Élément discuté : une tâche ou un livrable. */
export type Subject = { type: SubjectType; id: string };

export const isSubjectType = (value: string): value is SubjectType =>
  (SUBJECT_TYPES as readonly string[]).includes(value);

export const subjectLabels: Record<SubjectType, string> = { task: "Tâche", deliverable: "Livrable" };
/** Icône décorative de la ligne d'un fil d'élément dans le salon. */
export const subjectIcons: Record<SubjectType, string> = { task: "✅", deliverable: "🎬" };

/** Page de l'élément. */
export function subjectPath(subject: Subject): string {
  return subject.type === "task" ? `/taches/${subject.id}` : `/livrables/${subject.id}`;
}

/** Section « Discussion » de la page de l'élément. */
export const subjectHref = (subject: Subject) => `${subjectPath(subject)}#discussion`;

/** Un commentaire précis, sur la page de l'élément. */
export const subjectMessageHref = (subject: Subject, messageId: string) =>
  `${subjectPath(subject)}#m-${messageId}`;

/** Texte de la racine du fil : « Discussion · Tâche « Titre » ». */
export function subjectRootBody(type: SubjectType, title: string): string {
  const clean = title.replace(/\s+/g, " ").trim() || "Sans titre";
  return `Discussion · ${subjectLabels[type]} « ${clean} »`.slice(0, MESSAGE_MAX_LENGTH);
}

/** Champ de rattachement d'un message (racine ou réponse) à son élément. */
export function aboutFields(subject: Subject): { aboutTaskId: string } | { aboutDeliverableId: string } {
  return subject.type === "task" ? { aboutTaskId: subject.id } : { aboutDeliverableId: subject.id };
}

/** Élément porté par un message, s'il en porte un. */
export function subjectOf(message: {
  aboutTaskId: string | null;
  aboutDeliverableId: string | null;
}): Subject | null {
  if (message.aboutTaskId) return { type: "task", id: message.aboutTaskId };
  if (message.aboutDeliverableId) return { type: "deliverable", id: message.aboutDeliverableId };
  return null;
}

/** « la tâche « Titre » » / « le livrable « Titre » ». */
export function subjectPhrase(type: SubjectType, title: string): string {
  return `${type === "task" ? "la tâche" : "le livrable"} « ${title} »`;
}

/** Titre de la notification « commentaire ». */
export const commentEventTitle = (authorName: string, type: SubjectType, title: string) =>
  `${authorName} a commenté ${subjectPhrase(type, title)}`;

/**
 * Destinataires de l'événement « commentaire » : le responsable de l'élément, les contributeurs
 * d'une tâche et les personnes ayant déjà commenté ce fil ; jamais l'auteur, ni les personnes
 * mentionnées (déjà prévenues par la mention). Sans doublon, dans cet ordre.
 */
export function commentRecipients(input: {
  authorId: string;
  ownerId: string | null;
  contributorIds?: string[];
  previousAuthorIds: (string | null)[];
  mentionedIds: string[];
}): string[] {
  const excluded = new Set([input.authorId, ...input.mentionedIds]);
  const ordered = [input.ownerId, ...(input.contributorIds ?? []), ...input.previousAuthorIds];
  const recipients: string[] = [];
  for (const id of ordered) if (id && !excluded.has(id) && !recipients.includes(id)) recipients.push(id);
  return recipients;
}

/**
 * Lecture seule : projet archivé, élément archivé ou salon du projet archivé.
 * Renvoie le motif affiché, ou null si l'on peut commenter.
 */
export function subjectReadOnlyReason(input: {
  type: SubjectType;
  projectArchived: boolean;
  elementArchived: boolean;
  channelArchived?: boolean;
}): string | null {
  if (input.projectArchived) return "Projet archivé : la discussion est en lecture seule.";
  if (input.elementArchived)
    return input.type === "task"
      ? "Tâche archivée : la discussion est en lecture seule."
      : "Livrable archivé : la discussion est en lecture seule.";
  if (input.channelArchived) return "Salon du projet archivé : la discussion est en lecture seule.";
  return null;
}

/** Dernière activité d'un fil : sa dernière réponse, sinon sa création. */
export function lastActivity(rootCreatedAt: Date, lastReplyAt: Date | null | undefined): Date {
  return lastReplyAt && lastReplyAt > rootCreatedAt ? lastReplyAt : rootCreatedAt;
}

/** Fils triés par dernière activité, le plus récent d'abord (ordre stable à égalité). */
export function byLastActivity<T extends { lastActivityAt: Date }>(threads: T[]): T[] {
  return threads
    .map((thread, index) => ({ thread, index }))
    .sort(
      (a, b) => b.thread.lastActivityAt.getTime() - a.thread.lastActivityAt.getTime() || a.index - b.index,
    )
    .map(({ thread }) => thread);
}

/** « Aucune réponse », « 1 réponse », « 3 réponses ». */
export function repliesLabel(count: number): string {
  if (count <= 0) return "Aucune réponse";
  return `${count} réponse${count > 1 ? "s" : ""}`;
}

// ─── Reprise des anciens commentaires de tâche (V1) ─────────────────────────

export type LegacyComment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  movedToMessageId: string | null;
};

/**
 * Commentaires encore à reprendre, regroupés par tâche, chacun dans l'ordre chronologique.
 * Un commentaire déjà repris (`movedToMessageId`) n'est jamais recopié : la reprise est idempotente.
 */
export function legacyCommentsByTask<T extends LegacyComment>(comments: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const pending = comments
    .filter((c) => !c.movedToMessageId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const comment of pending) {
    const group = groups.get(comment.taskId) ?? [];
    group.push(comment);
    groups.set(comment.taskId, group);
  }
  return groups;
}

/** Date de la racine créée pour une reprise : celle du plus ancien commentaire (jamais « non lue »). */
export function legacyRootDate(comments: { createdAt: Date }[], now: Date): Date {
  return comments.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), now);
}

/**
 * Réponse de fil recopiée d'un ancien commentaire : même auteur, même texte, mêmes dates
 * (création, modification, suppression). Aucune mention : la reprise ne notifie personne.
 */
export function legacyReplyData(comment: LegacyComment, root: { id: string; channelId: string }) {
  return {
    channelId: root.channelId,
    parentId: root.id,
    authorId: comment.authorId,
    body: comment.body.slice(0, MESSAGE_MAX_LENGTH),
    mentionIds: [] as string[],
    alsoInChannel: false,
    aboutTaskId: comment.taskId,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
    deletedAt: comment.deletedAt,
  };
}
