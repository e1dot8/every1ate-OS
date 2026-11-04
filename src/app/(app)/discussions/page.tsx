import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MessageSquarePlus, Plus } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Section } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { ensureProjectChannel } from "@/features/discussions/channels";
import { ChannelNav } from "@/features/discussions/components/channel-nav";
import { DiscussionsFrame, discussionsViewer, getSidebar } from "@/features/discussions/components/frame";

export const metadata: Metadata = { title: "Discussions" };

type SearchParams = { projet?: string | string[] };

function Actions() {
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href="/discussions/nouveau">
          <Plus aria-hidden="true" />
          Nouveau salon
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="/discussions/nouveau?vue=message">
          <MessageSquarePlus aria-hidden="true" />
          Nouveau message
        </Link>
      </Button>
    </>
  );
}

async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await discussionsViewer();
  const { projet } = await searchParams;
  // Contrat partagé : /discussions?projet=<id> ouvre (et crée au besoin) le salon du projet.
  if (typeof projet === "string" && projet) {
    const channel = await ensureProjectChannel(projet, user.id);
    if (!channel) notFound();
    redirect(`/discussions/${channel.slug}`);
  }
  const data = await getSidebar(user.id);
  const unread = [
    ...data.channels.filter((c) => c.unread).map((c) => ({ href: `/discussions/${c.slug}`, ...c })),
    ...data.directs.filter((d) => d.unread),
  ];
  return (
    <>
      <div className="lg:hidden">
        <ChannelNav data={data} label="Salons et messages directs" />
      </div>
      <div className="hidden flex-col gap-6 lg:flex">
        <Section title="Non lus" count={unread.length}>
          {unread.length ? (
            <ul className="flex flex-col">
              {unread.map((u) => (
                <li key={u.href}>
                  <Link
                    href={u.href}
                    className="flex min-h-tap items-center gap-2 rounded-md px-1 hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1 truncate font-bold">{u.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {u.unread} non lu{u.unread > 1 ? "s" : ""}
                      {u.mentions ? ` · ${u.mentions} mention${u.mentions > 1 ? "s" : ""}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>Tout est lu.</EmptyLine>
          )}
        </Section>
        <Callout icon="⌨️">
          <p>
            Dans un message : <strong>**gras**</strong>, <em>_italique_</em>, <code>`code`</code>, @Prénom pour
            prévenir quelqu&apos;un. Tape <code>/aide</code> pour les commandes (<code>/tache</code>,{" "}
            <code>/rappel</code>, <code>/focus</code>, <code>/huddle</code>…).
          </p>
        </Callout>
      </div>
    </>
  );
}

export default function DiscussionsPage({ searchParams }: PageProps<"/discussions">) {
  return (
    <DiscussionsFrame>
      <NotionPage
        icon="💬"
        title="Discussions"
        description="Salons, messages directs et fils de l'équipe, gardés dans l'app."
        actions={<Actions />}
      >
        <Suspense fallback={<PageLoading />}>
          <Home searchParams={searchParams as Promise<SearchParams>} />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
