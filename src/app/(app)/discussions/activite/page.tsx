import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage, Section } from "@/components/notion/blocks";
import { formatDateTime } from "@/lib/dates";
import { deleteReminderAction } from "@/app/(app)/discussions/actions";
import { DiscussionsFrame, MessageLine, discussionsViewer } from "@/features/discussions/components/frame";
import { activityFeed, directNames } from "@/features/discussions/queries";
import { permalink } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Activité des discussions" };

async function Activity() {
  const user = await discussionsViewer();
  const feed = await activityFeed(user.id);
  const partners = await directNames(
    [...feed.mentions, ...feed.replies, ...feed.reactions.map((r) => r.message)].map((m) => m.channel.slug),
    user.id,
  );
  const pending = feed.reminders.filter((r) => !r.sentAt);
  const sent = feed.reminders.filter((r) => r.sentAt);
  return (
    <>
      <Section title="Mentions" count={feed.mentions.length} id="mentions">
        {feed.mentions.length ? (
          <ul className="flex flex-col">
            {feed.mentions.map((m) => (
              <MessageLine key={m.id} message={m} partnerName={partners.get(m.channel.slug)} />
            ))}
          </ul>
        ) : (
          <EmptyLine>Personne ne t&apos;a mentionné pour l&apos;instant.</EmptyLine>
        )}
      </Section>
      <Section title="Réponses à mes fils" count={feed.replies.length} id="reponses">
        {feed.replies.length ? (
          <ul className="flex flex-col">
            {feed.replies.map((m) => (
              <MessageLine key={m.id} message={m} partnerName={partners.get(m.channel.slug)} />
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucune réponse dans tes fils.</EmptyLine>
        )}
      </Section>
      <Section title="Réactions à mes messages" count={feed.reactions.length} id="reactions">
        {feed.reactions.length ? (
          <ul className="flex flex-col">
            {feed.reactions.map((r) => (
              <MessageLine
                key={r.id}
                message={r.message}
                partnerName={partners.get(r.message.channel.slug)}
                meta={
                  <>
                    <span aria-hidden="true">{r.emoji}</span> {r.user.name}
                    <span className="sr-only"> a réagi {r.emoji}</span>
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucune réaction pour l&apos;instant.</EmptyLine>
        )}
      </Section>
      <Section title="Rappels" count={pending.length} id="rappels">
        {pending.length || sent.length ? (
          <ul className="flex flex-col">
            {[...pending, ...sent].map((r) => (
              <li key={r.id} className="flex min-h-tap items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {r.message ? (
                    <Link href={permalink(r.message.channel.slug, r.message)} className="text-sm break-words hover:underline">
                      {r.text}
                    </Link>
                  ) : (
                    <span className="text-sm break-words">{r.text}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {r.sentAt ? `Rappelé le ${formatDateTime(r.sentAt)}` : `Prévu le ${formatDateTime(r.remindAt)}`}
                  </span>
                </div>
                {!r.sentAt ? (
                  <form action={deleteReminderAction}>
                    <input type="hidden" name="reminderId" value={r.id} />
                    <button
                      type="submit"
                      className="min-h-tap rounded-md px-2 text-sm font-bold text-muted-foreground hover:bg-muted"
                    >
                      Annuler
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucun rappel. « Me rappeler » sur un message, ou /rappel 1h Texte.</EmptyLine>
        )}
      </Section>
    </>
  );
}

export default function ActivityPage() {
  return (
    <DiscussionsFrame>
      <NotionPage
        icon="🔔"
        crumbs={[{ label: "Discussions", href: "/discussions" }]}
        title="Activité"
        description="Mentions, réponses à tes fils, réactions et rappels."
      >
        <Suspense fallback={<PageLoading />}>
          <Activity />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
