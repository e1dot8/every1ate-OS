import "server-only";
import { getDb } from "@/lib/db/client";
import { emitEvent } from "@/features/events/emit";
import { plainExcerpt } from "@/features/discussions/rules";
import {
  commentEventTitle,
  commentRecipients,
  subjectHref,
  type Subject,
} from "@/features/discussions/subject-rules";

/**
 * Contexte d'un élément discuté (titre, projet, responsable, contributeurs) et annonce des
 * commentaires. Module sans dépendance au service des discussions : appelé par `publishMessage`
 * pour toute réponse dans le fil d'un élément (page de l'élément, fil du salon, message programmé).
 */

export type SubjectContext = {
  subject: Subject;
  title: string;
  projectId: string;
  projectArchived: boolean;
  archived: boolean;
  ownerId: string | null;
  contributorIds: string[];
};

export async function loadSubjectContext(subject: Subject): Promise<SubjectContext | null> {
  const db = getDb();
  if (subject.type === "task") {
    const task = await db.task.findUnique({
      where: { id: subject.id },
      select: {
        title: true,
        projectId: true,
        ownerId: true,
        archivedAt: true,
        project: { select: { archivedAt: true } },
        contributors: { select: { userId: true } },
      },
    });
    if (!task) return null;
    return {
      subject,
      title: task.title,
      projectId: task.projectId,
      projectArchived: !!task.project.archivedAt,
      archived: !!task.archivedAt,
      ownerId: task.ownerId,
      contributorIds: task.contributors.map((c) => c.userId),
    };
  }
  const deliverable = await db.deliverable.findUnique({
    where: { id: subject.id },
    select: {
      title: true,
      projectId: true,
      ownerId: true,
      archivedAt: true,
      project: { select: { archivedAt: true } },
    },
  });
  if (!deliverable) return null;
  return {
    subject,
    title: deliverable.title,
    projectId: deliverable.projectId,
    projectArchived: !!deliverable.project.archivedAt,
    archived: !!deliverable.archivedAt,
    ownerId: deliverable.ownerId,
    contributorIds: [],
  };
}

/**
 * Événement « commentaire » d'une réponse dans le fil d'un élément : responsable (et contributeurs
 * d'une tâche) et personnes ayant déjà commenté, sauf l'auteur et les mentionnés (prévenus par la
 * mention). Pas de message du QG dans le salon : le commentaire y est déjà. Ne lève jamais.
 */
export async function announceSubjectComment(
  author: { id: string; name: string },
  context: SubjectContext,
  message: { id: string; parentId: string; body: string },
  mentionIds: string[],
): Promise<void> {
  try {
    const previous = await getDb().message.findMany({
      where: { parentId: message.parentId, id: { not: message.id }, authorId: { not: null } },
      distinct: ["authorId"],
      select: { authorId: true },
    });
    const recipients = commentRecipients({
      authorId: author.id,
      ownerId: context.ownerId,
      contributorIds: context.contributorIds,
      previousAuthorIds: previous.map((p) => p.authorId),
      mentionedIds: mentionIds,
    });
    if (!recipients.length) return;
    await emitEvent({
      kind: "commentaire",
      actorId: author.id,
      title: commentEventTitle(author.name, context.subject.type, context.title),
      body: plainExcerpt(message.body) || "Lien joint",
      href: subjectHref(context.subject),
      projectId: context.projectId,
      taskId: context.subject.type === "task" ? context.subject.id : null,
      recipients,
      dedupeKey: `commentaire:${message.id}`,
      channelPost: false,
    });
  } catch (error) {
    console.error("[discussions] commentaire non annoncé", error);
  }
}
