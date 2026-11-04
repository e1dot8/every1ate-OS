import { MessagesSquare } from "lucide-react";
import { Callout, EmptyLine, Section } from "@/components/notion/blocks";
import { TextLink } from "@/components/ui/text-link";
import type { MessageContext } from "@/features/discussions/components/message-item";
import { MessageList } from "@/features/discussions/components/message-list";
import { SubjectComposer } from "@/features/discussions/components/subject-composer";
import { listSubjectComments } from "@/features/discussions/subjects";
import { subjectPath, type Subject } from "@/features/discussions/subject-rules";

/**
 * Section « Discussion » de la page d'une tâche ou d'un livrable : les commentaires (fil de
 * l'élément dans le salon du projet) avec réactions et menu de chaque message, puis le
 * compositeur, ou un encadré « lecture seule ».
 */
export async function SubjectDiscussion({
  subject,
  viewerId,
  editingId,
}: {
  subject: Subject;
  viewerId: string;
  /** Message en cours de modification (`?modifier=`). */
  editingId: string | null;
}) {
  const discussion = await listSubjectComments(subject, viewerId);
  if (!discussion) return null;
  const { comments, readOnly, channel, rootId, context } = discussion;
  const visible = comments.filter((c) => !c.deletedAt).length;
  const ctx: MessageContext = {
    slug: channel?.slug ?? "",
    viewerId,
    writable: !readOnly,
    retour: subjectPath(subject),
    view: "fil",
    editingId,
    tasks: discussion.tasks,
  };
  const salonHref =
    channel && rootId
      ? `/discussions/${channel.slug}/fil/${rootId}`
      : `/discussions?projet=${context.projectId}`;

  return (
    <Section
      id="discussion"
      title="Discussion"
      count={visible || undefined}
      action={
        <TextLink href={salonHref} className="min-w-0 text-right text-xs">
          <MessagesSquare aria-hidden="true" className="size-4" />
          Voir dans le salon du projet
        </TextLink>
      }
    >
      {/* Ancienne ancre des notifications de commentaires (V1). */}
      <span id="commentaires" aria-hidden="true" />
      {comments.length ? (
        <MessageList
          messages={comments}
          lastReadAt={null}
          now={new Date()}
          label="Commentaires"
          ctx={ctx}
          dayHeading="h3"
        />
      ) : (
        <EmptyLine>
          {readOnly
            ? "Aucun commentaire."
            : "Aucun commentaire pour l'instant. Pose une question, partage un lien, mentionne un associé avec @Prénom."}
        </EmptyLine>
      )}
      {readOnly ? (
        <Callout icon="🗄️" tone="warning">
          <p role="status">{readOnly}</p>
        </Callout>
      ) : (
        <SubjectComposer type={subject.type} id={subject.id} />
      )}
    </Section>
  );
}
