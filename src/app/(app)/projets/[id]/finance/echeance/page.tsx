import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { BillingForm } from "@/features/finance/components/forms";
import { projectLots } from "@/features/finance/page-helpers";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Nouvelle échéance" };

async function NewBilling({ params }: { params: Promise<{ id: string }> }) {
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
      <PageHeader title="Nouvelle échéance de facturation" />
      <Card className="max-w-3xl">
        <BillingForm projectId={id} lots={await projectLots(id)} />
      </Card>
    </>
  );
}

export default function NewBillingPage({ params }: PageProps<"/projets/[id]/finance/echeance">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <NewBilling params={params} />
      </Suspense>
    </div>
  );
}
