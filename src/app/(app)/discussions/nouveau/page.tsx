import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Hash, MessageSquare } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage, ViewTabs } from "@/components/notion/blocks";
import { listAssociates } from "@/features/projects/service";
import { NewChannelForm } from "@/features/discussions/components/forms";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";

export const metadata: Metadata = { title: "Nouveau salon ou message" };

type SearchParams = { vue?: string | string[] };

async function NewView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await discussionsViewer();
  const message = (await searchParams).vue === "message";
  const associates = (await listAssociates()).filter((a) => a.id !== user.id);
  return (
    <>
      <ViewTabs
        label="Créer"
        current={message ? "message" : "salon"}
        views={[
          { key: "salon", label: "Salon", href: "/discussions/nouveau", icon: Hash },
          {
            key: "message",
            label: "Message direct",
            href: "/discussions/nouveau?vue=message",
            icon: MessageSquare,
          },
        ]}
      />
      {message ? (
        <ul aria-label="Associés" className="flex flex-col">
          <li>
            <Link
              href={`/discussions/direct/${user.id}`}
              className="flex min-h-tap items-center rounded-md px-1 hover:bg-muted/60"
            >
              Moi (notes perso)
            </Link>
          </li>
          {associates.map((a) => (
            <li key={a.id}>
              <Link
                href={`/discussions/direct/${a.id}`}
                className="flex min-h-tap items-center rounded-md px-1 hover:bg-muted/60"
              >
                {a.name}
              </Link>
            </li>
          ))}
          {associates.length ? null : <EmptyLine>Aucun autre associé pour l&apos;instant.</EmptyLine>}
        </ul>
      ) : (
        <NewChannelForm associates={associates.map((a) => ({ value: a.id, label: a.name }))} />
      )}
    </>
  );
}

export default function NewPage({ searchParams }: PageProps<"/discussions/nouveau">) {
  return (
    <DiscussionsFrame>
      <NotionPage icon="✏️" crumbs={[{ label: "Discussions", href: "/discussions" }]} title="Nouveau">
        <Suspense fallback={<PageLoading />}>
          <NewView searchParams={searchParams as Promise<SearchParams>} />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
