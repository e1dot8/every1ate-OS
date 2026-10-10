import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OpportunityForm } from "@/features/crm/components/forms";
import { clientOptions } from "@/features/crm/options";
import { getOpportunity, getStageSettings } from "@/features/crm/service";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";

export const metadata: Metadata = { title: "Modifier l'opportunité" };

async function EditOpportunity({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [opp, clients, associates, settings] = await Promise.all([
    getOpportunity(id),
    clientOptions(),
    listAssociates(),
    getStageSettings(),
  ]);
  if (!opp || opp.archivedAt) notFound();
  const cents = toCents(opp.amount);
  return (
    <>
      <BackLink href={`/crm/opportunites/${id}`}>{opp.title}</BackLink>
      <PageHeader title="Modifier l'opportunité" description="Les modifications sont journalisées." />
      <Card className="max-w-2xl">
        <OpportunityForm
          clients={clients}
          associates={associates.map((a) => ({ value: a.id, label: a.name }))}
          currentUserId={user.id}
          settings={settings}
          opportunity={{
            id,
            title: opp.title,
            clientId: opp.clientId,
            contactId: opp.contactId,
            ownerId: opp.ownerId,
            source: opp.source,
            amount: opp.amount ? centsToDecimal(cents).replace(".00", "").replace(".", ",") : "",
            probability: opp.probability == null ? "" : String(opp.probability),
            expectedCloseDate: toDateInput(opp.expectedCloseDate),
            nextAction: opp.nextAction ?? "",
            nextActionDate: toDateInput(opp.nextActionDate),
            stage: opp.stage,
          }}
        />
      </Card>
    </>
  );
}

export default function EditOpportunityPage({ params }: PageProps<"/crm/opportunites/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EditOpportunity params={params} />
      </Suspense>
    </div>
  );
}
