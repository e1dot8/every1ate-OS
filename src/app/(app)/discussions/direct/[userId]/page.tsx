import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { ensureDirectChannel } from "@/features/discussions/channels";

export const metadata: Metadata = { title: "Message direct" };

/** Contrat partagé : /discussions/direct/<userId> ouvre (et crée au besoin) le message direct. */
async function OpenDirect({ params }: { params: Promise<{ userId: string }> }): Promise<React.ReactNode> {
  const user = await requireUser();
  const { userId } = await params;
  const channel = await ensureDirectChannel(user.id, userId);
  if (!channel) notFound();
  redirect(`/discussions/${channel.slug}`);
}

export default function DirectPage({ params }: PageProps<"/discussions/direct/[userId]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <OpenDirect params={params} />
    </Suspense>
  );
}
