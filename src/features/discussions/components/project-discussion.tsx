import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Callout, EmptyLine, Section } from "@/components/notion/blocks";
import { TextLink } from "@/components/ui/text-link";
import { formatDateTime } from "@/lib/dates";
import { utcToLocalInput } from "@/features/calendar/rules";
import { Composer } from "@/features/discussions/components/composer";
import type { MessageContext } from "@/features/discussions/components/message-item";
import { MessageList } from "@/features/discussions/components/message-list";
import { tomorrowAt9 } from "@/features/discussions/rules";
import { projectDiscussion } from "@/features/discussions/subjects";
import { repliesLabel, subjectIcons, subjectLabels } from "@/features/discussions/subject-rules";

/**
 * Onglet « Discussion » d'un projet : le fil général (derniers messages du salon du projet et
 * compositeur), puis les discussions par élément (tâches et livrables), de la plus récemment
 * active à la plus ancienne. Projet archivé : lecture seule.
 */
export async function ProjectDiscussionPanel({
  projectId,
  viewerId,
  archived,
  editingId,
}: {
  projectId: string;
  viewerId: string;
  archived: boolean;
  editingId: string | null;
}) {
  const data = await projectDiscussion(projectId, viewerId, { archived });
  const now = new Date();
  const channel = data.channel;
  const writable = !archived && !!channel && !channel.archivedAt;
  const ctx: MessageContext | null = channel
    ? {
        slug: channel.slug,
        viewerId,
        writable,
        retour: `/projets/${projectId}?onglet=discussion`,
        view: "salon",
        editingId,
        tasks: data.tasks,
      }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <Section
        id="fil-general"
        title="Fil du projet"
        action={
          channel ? (
            <TextLink href={`/discussions/${channel.slug}`} className="shrink-0 text-xs">
              <MessagesSquare aria-hidden="true" className="size-4" />
              Ouvrir le salon
            </TextLink>
          ) : null
        }
      >
        {archived ? (
          <Callout icon="🗄️" tone="warning">
            <p role="status">Projet archivé : la discussion est en lecture seule.</p>
          </Callout>
        ) : channel?.archivedAt ? (
          <Callout icon="🗄️" tone="warning">
            <p role="status">Salon du projet archivé : la discussion est en lecture seule.</p>
          </Callout>
        ) : null}
        {data.hasMore && channel ? (
          <Link
            href={`/discussions/${channel.slug}`}
            className="inline-flex min-h-tap w-fit items-center text-sm font-bold hover:underline"
          >
            Messages précédents dans le salon
          </Link>
        ) : null}
        {data.messages.length && ctx ? (
          <MessageList
            messages={data.messages}
            lastReadAt={null}
            now={now}
            label="Fil du projet"
            ctx={ctx}
            dayHeading="h3"
          />
        ) : (
          <EmptyLine>
            {writable
              ? "Aucun message général pour l'instant. Écris le premier : toute l'équipe le verra dans le salon du projet."
              : "Aucun message."}
          </EmptyLine>
        )}
        {writable && channel ? (
          <Composer
            channelId={channel.id}
            placeholder="Écrire à l'équipe du projet… (/aide pour les commandes)"
            defaultSendAt={utcToLocalInput(tomorrowAt9(now))}
            inline
          />
        ) : null}
      </Section>

      <Section id="par-element" title="Discussions par élément" count={data.threads.length || undefined}>
        {data.threads.length ? (
          <ul aria-label="Discussions par élément" className="flex flex-col">
            {data.threads.map((t) => (
              <li
                key={t.rootId}
                className="relative flex min-h-tap items-start gap-3 rounded-md px-1 py-2 hover:bg-muted/60"
              >
                <span aria-hidden="true" className="text-lg leading-6">
                  {subjectIcons[t.subject.type]}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={t.href}
                    className="min-w-0 text-sm font-bold break-words after:absolute after:inset-0 hover:underline"
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {subjectLabels[t.subject.type]}
                    </span>{" "}
                    · {t.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {repliesLabel(t.replies)} · dernière activité {formatDateTime(t.lastActivityAt)}
                  </span>
                  {t.last ? (
                    <span className="min-w-0 text-sm break-words text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {t.last.authorName ?? "Ancien associé"}
                      </span>
                      {" : "}
                      {t.last.excerpt}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>
            Aucune discussion sur une tâche ou un livrable de ce projet. Commente depuis la page d&apos;une
            tâche ou d&apos;un livrable : la discussion apparaîtra ici.
          </EmptyLine>
        )}
      </Section>
    </div>
  );
}
