import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CostForm } from "@/features/finance/components/forms";
import { projectLots } from "@/features/finance/page-helpers";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Nouveau coût" };

async function NewCost({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const project = await getDb().project.findUnique({
    where: { id },
    select: { name: true, archivedAt: true },
  });
  if (!project || project.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}?onglet=finance`}>{project.name}</BackLink>
      <PageHeader title="Nouveau coût" description="Montants HT ; TVA et TTC si connus." />
      <Card className="max-w-3xl">
        <CostForm projectId={id} lots={await projectLots(id)} />
      </Card>
    </>
  );
}

export default function NewCostPage({ params }: PageProps<"/projets/[id]/finance/cout">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <NewCost params={params} />
      </Suspense>
    </div>
  );
}
