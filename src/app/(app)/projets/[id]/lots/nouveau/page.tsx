import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LotForm } from "@/features/projects/components/forms";
import { getProject, listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouveau lot" };

async function NewLot({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [project, associates] = await Promise.all([getProject(id), listAssociates()]);
  if (!project || project.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}?onglet=vue`}>{project.name}</BackLink>
      <PageHeader title="Nouveau lot" />
      <Card className="max-w-2xl">
        <LotForm projectId={id} associates={associates.map((a) => ({ value: a.id, label: a.name }))} />
      </Card>
    </>
  );
}

export default function NewLotPage({ params }: PageProps<"/projets/[id]/lots/nouveau">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <NewLot params={params} />
      </Suspense>
    </div>
  );
}
