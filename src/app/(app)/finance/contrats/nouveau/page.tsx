import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContractForm } from "@/features/finance/components/forms";
import { projectOptions } from "@/features/finance/page-helpers";
import { listClients } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouveau contrat" };

async function Form() {
  await requireUser();
  const [clients, projects] = await Promise.all([listClients(), projectOptions()]);
  return <ContractForm clients={clients.map((c) => ({ value: c.id, label: c.name }))} projects={projects} />;
}

export default function NewContractPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance?onglet=contrats">Contrats récurrents</BackLink>
      <PageHeader
        title="Nouveau contrat récurrent"
        description="Le MRR ne compte que les contrats actifs à la date du jour."
      />
      <Card className="max-w-3xl">
        <Suspense fallback={<PageLoading />}>
          <Form />
        </Suspense>
      </Card>
    </div>
  );
}
