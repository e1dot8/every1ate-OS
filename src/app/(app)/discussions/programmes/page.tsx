import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage, Section, Toggle } from "@/components/notion/blocks";
import { formatDateTime } from "@/lib/dates";
import { cancelScheduledAction } from "@/app/(app)/discussions/actions";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { directNames, scheduledMessages } from "@/features/discussions/queries";
import { channelTitle, plainExcerpt } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Messages programmés" };

async function Scheduled() {
  const user = await discussionsViewer();
  const { pending, sent } = await scheduledMessages(user.id);
  const partners = await directNames(
    [...pending, ...sent].map((s) => s.channel.slug),
    user.id,
  );
  const where = (s: (typeof pending)[number]) =>
    channelTitle({ ...s.channel, projectName: s.channel.project?.name, partnerName: partners.get(s.channel.slug) });
  return (
    <>
      <Section title="À envoyer" count={pending.length}>
        {pending.length ? (
          <ul aria-label="Messages à envoyer" className="flex flex-col">
            {pending.map((s) => (
              <li key={s.id} className="flex min-h-tap items-start gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm break-words">{plainExcerpt(s.body, 200)}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(s.sendAt)} ·{" "}
                    <Link href={`/discussions/${s.channel.slug}`} className="underline underline-offset-2">
                      {where(s)}
                    </Link>
                    {s.parentId ? " · dans un fil" : ""}
                  </span>
                </div>
                <form action={cancelScheduledAction}>
                  <input type="hidden" name="scheduledId" value={s.id} />
                  <button
                    type="submit"
                    className="min-h-tap rounded-md px-2 text-sm font-bold text-muted-foreground hover:bg-muted"
                  >
                    Annuler l&apos;envoi
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucun message programmé. « Programmer » dans le compositeur choisit l&apos;heure d&apos;envoi.</EmptyLine>
        )}
      </Section>
      {sent.length ? (
        <Toggle title="Envoyés ces 7 derniers jours" meta={String(sent.length)}>
          <ul className="flex flex-col">
            {sent.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 rounded-md px-1 py-2 hover:bg-muted/60">
                <p className="text-sm break-words">{plainExcerpt(s.body, 200)}</p>
                <span className="text-xs text-muted-foreground">
                  Envoyé le {formatDateTime(s.sentAt)} · {where(s)}
                </span>
              </li>
            ))}
          </ul>
        </Toggle>
      ) : null}
    </>
  );
}

export default function ScheduledPage() {
  return (
    <DiscussionsFrame>
      <NotionPage
        icon="🕒"
        crumbs={[{ label: "Discussions", href: "/discussions" }]}
        title="Programmés"
        description="Tes messages qui partiront plus tard, annulables jusqu'à l'envoi."
      >
        <Suspense fallback={<PageLoading />}>
          <Scheduled />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
