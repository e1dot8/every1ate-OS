import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronUp, FolderKanban, Settings, Users, Video } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Toggle } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { utcToLocalInput } from "@/features/calendar/rules";
import { accessChannel, markChannelRead } from "@/features/discussions/channels";
import { Composer } from "@/features/discussions/components/composer";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { MessageList } from "@/features/discussions/components/message-list";
import { ScrollToEnd } from "@/features/discussions/components/scroll-to-end";
import {
  channelMembers,
  channelMessages,
  directPartner,
  linkedTasks,
  pinnedMessages,
} from "@/features/discussions/queries";
import {
  channelIcon,
  channelTitle,
  formatHourFr,
  permalink,
  plainExcerpt,
  presenceNotice,
  tomorrowAt9,
} from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Salon" };

type Params = { slug: string };
type SearchParams = { avant?: string | string[]; modifier?: string | string[] };
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

async function ChannelView({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await discussionsViewer();
  const { slug } = await params;
  const sp = await searchParams;
  const access = await accessChannel({ slug }, user.id);
  if (!access) notFound();
  const { channel, member } = access;
  const now = new Date();
  const before = one(sp.avant);
  const [{ messages, hasMore }, pinned, members, partner] = await Promise.all([
    channelMessages(channel.id, user.id, before),
    pinnedMessages(channel.id),
    channelMembers(channel.id),
    channel.kind === "DIRECT" ? directPartner(channel.id, user.id, now) : null,
  ]);
  const tasks = await linkedTasks(messages);
  // Ligne « Nouveaux messages » calculée avant de marquer le salon comme lu (rejoint s'il est public).
  const lastReadAt = member?.lastReadAt ?? null;
  if (!before) await markChannelRead(channel.id, user.id, now);

  const writable = !channel.archivedAt;
  const title = channelTitle({ ...channel, projectName: channel.project?.name, partnerName: partner?.name });
  const notice = partner ? presenceNotice(partner.name, partner.presence, now) : null;
  const focusEnd =
    partner?.presence.state === "FOCUS" && partner.presence.until
      ? formatHourFr(partner.presence.until)
      : null;
  const retour = `/discussions/${channel.slug}`;
  const placeholder =
    channel.kind === "PERSO"
      ? "Note pour toi… (/aide pour les commandes)"
      : `Écrire à ${channel.kind === "DIRECT" ? title : `« ${title} »`}… (/aide pour les commandes)`;

  return (
    <NotionPage
      icon={channelIcon(channel)}
      crumbs={[{ label: "Discussions", href: "/discussions" }]}
      title={title}
      description={channel.topic ?? undefined}
      actions={
        <>
          {channel.meetUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={channel.meetUrl} target="_blank" rel="noopener noreferrer">
                <Video aria-hidden="true" />
                Visio
              </a>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="icon">
            <Link href={`/discussions/${channel.slug}/reglages`} aria-label="Réglages du salon">
              <Settings aria-hidden="true" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="-mt-3 flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {channel.kind !== "PERSO" ? (
            <Link
              href={`/discussions/${channel.slug}/reglages`}
              className="inline-flex min-h-9 items-center gap-1.5 hover:underline"
            >
              <Users aria-hidden="true" className="size-4" />
              {channel.kind === "PUBLIC"
                ? `${members.count} membre${members.count > 1 ? "s" : ""} · ouvert à tous les associés`
                : members.members.map((m) => m.name).join(", ")}
            </Link>
          ) : (
            <span>Visible par toi seul.</span>
          )}
          {channel.project ? (
            <Link
              href={`/projets/${channel.project.id}`}
              className="inline-flex min-h-9 items-center gap-1.5 hover:underline"
            >
              <FolderKanban aria-hidden="true" className="size-4" />
              Voir le projet
            </Link>
          ) : null}
        </p>
        {pinned.length ? (
          <Toggle title={`Épinglés (${pinned.length})`}>
            <ul className="flex flex-col">
              {pinned.map((p) => (
                <li key={p.id}>
                  <Link
                    href={permalink(channel.slug, p)}
                    className="flex min-h-tap items-center gap-2 rounded-md px-1 text-sm hover:bg-muted/60"
                  >
                    <span className="font-bold">{p.author?.name ?? "QG"}</span>
                    <span className="min-w-0 truncate">{plainExcerpt(p.body, 100) || "(lien joint)"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Toggle>
        ) : null}
        {notice ? <Callout icon="🎧">{notice}</Callout> : null}
        {channel.archivedAt ? (
          <Callout icon="🗄️" tone="warning">
            Salon archivé : il reste lisible mais n&apos;accepte plus de message.
          </Callout>
        ) : null}
      </div>

      <div className="flex flex-col">
        {hasMore ? (
          <Link
            href={`/discussions/${channel.slug}?avant=${messages[0].id}`}
            className="mb-2 inline-flex min-h-tap w-fit items-center gap-1.5 text-sm font-bold hover:underline"
          >
            <ChevronUp aria-hidden="true" className="size-4" />
            Messages précédents
          </Link>
        ) : null}
        {before ? (
          <Link
            href={`/discussions/${channel.slug}`}
            className="mb-2 inline-flex min-h-tap w-fit items-center text-sm font-bold hover:underline"
          >
            Revenir aux derniers messages
          </Link>
        ) : null}
        {messages.length ? (
          <MessageList
            messages={messages}
            lastReadAt={lastReadAt}
            now={now}
            label="Messages"
            ctx={{
              slug: channel.slug,
              viewerId: user.id,
              writable,
              retour,
              view: "salon",
              editingId: one(sp.modifier),
              tasks,
            }}
          />
        ) : (
          <EmptyLine>
            {channel.kind === "PERSO"
              ? "Tes notes perso : liens, idées, brouillons. Personne d'autre ne les voit."
              : "Aucun message pour l'instant. Écris le premier !"}
          </EmptyLine>
        )}
        {writable && !before ? (
          <Composer
            channelId={channel.id}
            placeholder={placeholder}
            defaultSendAt={utcToLocalInput(tomorrowAt9(now))}
            focusEndLabel={focusEnd}
          />
        ) : null}
        {!before ? <ScrollToEnd marker={`${messages.at(-1)?.id ?? ""}:${messages.length}`} /> : null}
      </div>
    </NotionPage>
  );
}

export default function ChannelPage({ params, searchParams }: PageProps<"/discussions/[slug]">) {
  return (
    <DiscussionsFrame>
      <Suspense fallback={<PageLoading />}>
        <ChannelView params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </DiscussionsFrame>
  );
}
