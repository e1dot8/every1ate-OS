import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, NotionPage } from "@/components/notion/blocks";
import { getDb } from "@/lib/db/client";
import { listAssociates } from "@/features/projects/service";
import { accessChannel } from "@/features/discussions/channels";
import { ConvertToTaskForm } from "@/features/discussions/components/forms";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { RichText } from "@/features/discussions/components/rich-text";
import { channelTitle, permalink, taskTitleFromMessage } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Transformer en tâche" };

type Params = { slug: string; messageId: string };

async function ConvertView({ params }: { params: Promise<Params> }) {
  const user = await discussionsViewer();
  const { slug, messageId } = await params;
  const access = await accessChannel({ slug }, user.id);
  if (!access) notFound();
  const { channel } = access;
  const db = getDb();
  const message = await db.message.findFirst({
    where: { id: messageId, channelId: channel.id, deletedAt: null, authorId: { not: null } },
    select: { id: true, parentId: true, body: true, taskId: true, author: { select: { name: true } } },
  });
  if (!message) notFound();
  const title = channelTitle({ ...channel, projectName: channel.project?.name });
  const back = permalink(channel.slug, message);
  const crumbs = [
    { label: "Discussions", href: "/discussions" },
    { label: channel.kind === "DIRECT" ? "Message direct" : title, href: `/discussions/${channel.slug}` },
  ];

  if (message.taskId) {
    const task = await db.task.findUnique({
      where: { id: message.taskId },
      select: { id: true, title: true },
    });
    return (
      <NotionPage icon="✅" crumbs={crumbs} title="Transformer en tâche">
        <Callout icon="🔗">
          Ce message est déjà lié à une tâche
          {task ? (
            <>
              {" : "}
              <Link href={`/taches/${task.id}`} className="font-bold underline">
                {task.title}
              </Link>
            </>
          ) : null}
          .
        </Callout>
      </NotionPage>
    );
  }
  if (channel.archivedAt) notFound();

  const [projects, associates] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listAssociates(),
  ]);
  const projectId =
    channel.projectId && projects.some((p) => p.id === channel.projectId) ? channel.projectId : "";

  return (
    <NotionPage
      icon="✅"
      crumbs={crumbs}
      title="Transformer en tâche"
      description="La tâche est créée dans le projet choisi ; le message y reste lié."
    >
      <blockquote className="border-l-4 border-ink/20 pl-3 text-sm">
        <p className="font-bold">{message.author?.name}</p>
        <RichText body={message.body} className="min-w-0 break-words text-muted-foreground" />
      </blockquote>
      <ConvertToTaskForm
        messageId={message.id}
        defaults={{ title: taskTitleFromMessage(message.body), projectId, ownerId: user.id }}
        projects={projects.map((p) => ({ value: p.id, label: p.name }))}
        associates={associates.map((a) => ({ value: a.id, label: a.name }))}
      />
      <Link
        href={back}
        className="inline-flex min-h-tap w-fit items-center text-sm font-bold hover:underline"
      >
        Annuler
      </Link>
    </NotionPage>
  );
}

export default function ConvertPage({ params }: PageProps<"/discussions/[slug]/tache/[messageId]">) {
  return (
    <DiscussionsFrame>
      <Suspense fallback={<PageLoading />}>
        <ConvertView params={params} />
      </Suspense>
    </DiscussionsFrame>
  );
}
