import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage, Section, Toggle } from "@/components/notion/blocks";
import { Badge } from "@/components/ui/badge";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { channelDirectory } from "@/features/discussions/queries";
import { channelIcon, channelTitle } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Tous les salons" };

type Row = Awaited<ReturnType<typeof channelDirectory>>[number];

function ChannelRow({ c }: { c: Row }) {
  return (
    <li className="relative flex min-h-tap items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
      <span aria-hidden="true" className="w-5 shrink-0 text-center">
        {channelIcon(c)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/discussions/${c.slug}`}
          className="truncate font-bold after:absolute after:inset-0 hover:underline"
        >
          {channelTitle({ ...c, projectName: c.project?.name })}
        </Link>
        {c.topic ? <span className="truncate text-sm text-muted-foreground">{c.topic}</span> : null}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {c._count.members} membre{c._count.members > 1 ? "s" : ""}
      </span>
      {c.members.length ? <Badge variant="secondary">Rejoint</Badge> : null}
    </li>
  );
}

async function Directory() {
  const user = await discussionsViewer();
  const all = await channelDirectory(user.id);
  const open = all.filter((c) => !c.archivedAt);
  const archived = all.filter((c) => c.archivedAt);
  return (
    <>
      <Section title="Salons ouverts" count={open.length}>
        {open.length ? (
          <ul className="flex flex-col">
            {open.map((c) => (
              <ChannelRow key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucun salon.</EmptyLine>
        )}
      </Section>
      {archived.length ? (
        <Toggle title="Salons archivés" meta={String(archived.length)}>
          <ul className="flex flex-col">
            {archived.map((c) => (
              <ChannelRow key={c.id} c={c} />
            ))}
          </ul>
        </Toggle>
      ) : null}
    </>
  );
}

export default function DirectoryPage() {
  return (
    <DiscussionsFrame>
      <NotionPage
        icon="🗂️"
        crumbs={[{ label: "Discussions", href: "/discussions" }]}
        title="Tous les salons"
        description="Salons publics (ouverts à tous les associés) et tes salons privés. Ouvrir un salon le rejoint."
      >
        <Suspense fallback={<PageLoading />}>
          <Directory />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
