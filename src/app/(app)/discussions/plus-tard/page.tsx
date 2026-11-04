import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage } from "@/components/notion/blocks";
import { unsaveMessageAction } from "@/app/(app)/discussions/actions";
import { DiscussionsFrame, MessageLine, discussionsViewer } from "@/features/discussions/components/frame";
import { directNames, savedMessages } from "@/features/discussions/queries";

export const metadata: Metadata = { title: "Plus tard" };

async function Saved() {
  const user = await discussionsViewer();
  const saved = await savedMessages(user.id);
  if (!saved.length)
    return <EmptyLine>Rien pour l&apos;instant : « Plus tard » dans le menu d&apos;un message l&apos;ajoute ici.</EmptyLine>;
  const partners = await directNames(
    saved.map((s) => s.message.channel.slug),
    user.id,
  );
  return (
    <ul aria-label="Messages enregistrés" className="flex flex-col">
      {saved.map((s) => (
        <MessageLine
          key={s.id}
          message={s.message}
          partnerName={partners.get(s.message.channel.slug)}
          action={
            <form action={unsaveMessageAction}>
              <input type="hidden" name="messageId" value={s.message.id} />
              <button
                type="submit"
                className="min-h-tap rounded-md px-2 text-sm font-bold text-muted-foreground hover:bg-muted"
              >
                Retirer
              </button>
            </form>
          }
        />
      ))}
    </ul>
  );
}

export default function SavedPage() {
  return (
    <DiscussionsFrame>
      <NotionPage
        icon="🔖"
        crumbs={[{ label: "Discussions", href: "/discussions" }]}
        title="Plus tard"
        description="Les messages que tu as mis de côté."
      >
        <Suspense fallback={<PageLoading />}>
          <Saved />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
