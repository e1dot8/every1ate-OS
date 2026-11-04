import Link from "next/link";
import { cache, Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { sidebarData } from "@/features/discussions/queries";
import { processDueDiscussions } from "@/features/discussions/scan";
import { ChannelNav } from "@/features/discussions/components/channel-nav";
import { channelTitle, permalink } from "@/features/discussions/rules";
import { formatDateTime } from "@/lib/dates";
import type { ActivityMessage } from "@/features/discussions/queries";
import { plainExcerpt } from "@/features/discussions/rules";

/** Barre latérale du lecteur (une seule lecture par requête). */
export const getSidebar = cache((userId: string) => sidebarData(userId));

/**
 * Lecteur des pages discussions : session exigée, puis rappels et messages programmés
 * arrivés à échéance traités (fonctionne même sans tâche planifiée).
 */
export async function discussionsViewer() {
  const user = await requireUser();
  await processDueDiscussions(new Date()).catch((error) => {
    console.error("[discussions] échéances", error);
  });
  return user;
}

async function SidebarNav() {
  const user = await requireUser();
  return <ChannelNav data={await getSidebar(user.id)} label="Salons et messages directs" />;
}

/** Page des discussions : barre latérale sur grand écran, contenu seul sur mobile. */
export function DiscussionsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto pr-1">
          <Suspense fallback={<PageLoading />}>
            <SidebarNav />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Ligne fine d'un message (Activité, Plus tard) : lien vers le message dans son fil. */
export function MessageLine({
  message,
  partnerName,
  meta,
  action,
}: {
  message: ActivityMessage;
  partnerName?: string | null;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const where = channelTitle({
    ...message.channel,
    projectName: message.channel.project?.name,
    partnerName,
  });
  return (
    <li className="relative flex min-h-tap items-start gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={permalink(message.channel.slug, message)}
          className="min-w-0 text-sm break-words after:absolute after:inset-0 hover:underline"
        >
          <span className="font-bold">{message.author?.name ?? "QG"}</span>
          {" : "}
          {message.deletedAt ? <em>Message supprimé</em> : plainExcerpt(message.body, 160) || "(lien joint)"}
        </Link>
        <span className="text-xs text-muted-foreground">
          {message.channel.kind === "DIRECT" ? "Message direct" : where}
          {message.channel.kind === "DIRECT" && partnerName ? ` avec ${partnerName}` : ""} ·{" "}
          {formatDateTime(message.createdAt)}
          {meta ? <> · {meta}</> : null}
        </span>
      </div>
      {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
    </li>
  );
}
