import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LotForm } from "@/features/projects/components/forms";
import { getWorkPackage, listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";

export const metadata: Metadata = { title: "Modifier le lot" };

async function EditLot({ params }: { params: Promise<{ id: string; lotId: string }> }) {
  await requireUser();
  const { id, lotId } = await params;
  const [lot, associates] = await Promise.all([getWorkPackage(id, lotId), listAssociates()]);
  if (!lot) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}/lots/${lotId}`}>{lot.name}</BackLink>
      <PageHeader title="Modifier le lot" />
      <Card className="max-w-2xl">
        <LotForm
          projectId={id}
          associates={associates.map((a) => ({ value: a.id, label: a.name }))}
          lot={{
            id: lotId,
            name: lot.name,
            description: lot.description,
            ownerId: lot.ownerId,
            plannedStart: toDateInput(lot.plannedStart),
            plannedEnd: toDateInput(lot.plannedEnd),
            memberIds: lot.members.map((m) => m.userId),
          }}
        />
      </Card>
    </>
  );
}

export default function EditLotPage({ params }: PageProps<"/projets/[id]/lots/[lotId]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EditLot params={params} />
      </Suspense>
    </div>
  );
}
