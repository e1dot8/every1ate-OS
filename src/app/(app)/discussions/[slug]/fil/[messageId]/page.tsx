import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage } from "@/components/notion/blocks";
import { utcToLocalInput } from "@/features/calendar/rules";
import { accessChannel } from "@/features/discussions/channels";
import { Composer } from "@/features/discussions/components/composer";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { MessageItem, type MessageContext } from "@/features/discussions/components/message-item";
import { MessageList } from "@/features/discussions/components/message-list";
import { ScrollToEnd } from "@/features/discussions/components/scroll-to-end";
import { directPartner, linkedTasks, threadMessages } from "@/features/discussions/queries";
import { channelTitle, tomorrowAt9 } from "@/features/discussions/rules";
import { loadSubjectContext } from "@/features/discussions/subject-notify";
import { subjectOf, subjectReadOnlyReason } from "@/features/discussions/subject-rules";

export const metadata: Metadata = { title: "Fil de discussion" };

type Params = { slug: string; messageId: string };
type SearchParams = { modifier?: string | string[]; tache?: string | string[] };

async function ThreadView({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await discussionsViewer();
  const { slug, messageId } = await params;
  const sp = await searchParams;
  const access = await accessChannel({ slug }, user.id);
  if (!access) notFound();
  const { channel } = access;
  const thread = await threadMessages(channel.id, messageId, user.id);
  if (!thread) notFound();
  const now = new Date();
  const partner = channel.kind === "DIRECT" ? await directPartner(channel.id, user.id, now) : null;
  const title = channelTitle({ ...channel, projectName: channel.project?.name, partnerName: partner?.name });
  const tasks = await linkedTasks([thread.root, ...thread.replies]);
  // Fil d'une tâche ou d'un livrable : lecture seule aussi quand le projet ou l'élément est archivé.
  const about = subjectOf(thread.root);
  const subject = about ? await loadSubjectContext(about) : null;
  const subjectLocked = subject
    ? subjectReadOnlyReason({
        type: subject.subject.type,
        projectArchived: subject.projectArchived,
        elementArchived: subject.archived,
      })
    : null;
  const writable = !channel.archivedAt && !subjectLocked;
  const ctx: MessageContext = {
    slug: channel.slug,
    viewerId: user.id,
    writable,
    retour: `/discussions/${channel.slug}/fil/${thread.root.id}`,
    view: "fil",
    editingId: typeof sp.modifier === "string" ? sp.modifier : null,
    tasks,
  };
  const count = thread.replies.filter((r) => !r.deletedAt).length;

  return (
    <NotionPage
      icon="🧵"
      crumbs={[
        { label: "Discussions", href: "/discussions" },
        { label: title, href: `/discussions/${channel.slug}` },
      ]}
      title="Fil de discussion"
    >
      <BackLink href={`/discussions/${channel.slug}#m-${thread.root.id}`}>Retour à {title}</BackLink>
      {sp.tache === "creee" ? (
        <Callout icon="✅" tone="success">
          <p role="status">Tâche créée et liée au message.</p>
        </Callout>
      ) : null}
      <ul aria-label="Message d'origine" className="flex flex-col border-b pb-2">
        <MessageItem message={thread.root} compact={false} ctx={ctx} />
      </ul>
      {subjectLocked ? (
        <Callout icon="🗄️" tone="warning">
          <p role="status">{subjectLocked}</p>
        </Callout>
      ) : null}
      <div className="flex flex-col">
        <h2 className="mb-1 text-sm font-bold text-muted-foreground">
          {count ? `${count} réponse${count > 1 ? "s" : ""}` : "Aucune réponse pour l'instant"}
        </h2>
        {thread.replies.length ? (
          <MessageList messages={thread.replies} lastReadAt={null} now={now} label="Réponses" ctx={ctx} />
        ) : (
          <EmptyLine>Réponds ici : le fil garde la conversation à part du salon.</EmptyLine>
        )}
        {writable && !thread.root.deletedAt ? (
          <Composer
            channelId={channel.id}
            parentId={thread.root.id}
            placeholder="Répondre dans le fil…"
            defaultSendAt={utcToLocalInput(tomorrowAt9(now))}
          />
        ) : null}
        <ScrollToEnd marker={`${thread.replies.at(-1)?.id ?? ""}:${thread.replies.length}`} />
      </div>
    </NotionPage>
  );
}

export default function ThreadPage({
  params,
  searchParams,
}: PageProps<"/discussions/[slug]/fil/[messageId]">) {
  return (
    <DiscussionsFrame>
      <Suspense fallback={<PageLoading />}>
        <ThreadView params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </DiscussionsFrame>
  );
}
