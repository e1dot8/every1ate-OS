import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContractForm } from "@/features/finance/components/forms";
import { projectOptions } from "@/features/finance/page-helpers";
import { getContract } from "@/features/finance/service";
import { listClients } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { moneyInput } from "@/lib/money";

export const metadata: Metadata = { title: "Contrat récurrent" };

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [c, clients, projects] = await Promise.all([getContract(id), listClients(), projectOptions()]);
  if (!c) notFound();
  return (
    <>
      <PageHeader title={c.label} />
      <Card className="max-w-3xl">
        <ContractForm
          clients={clients.map((x) => ({ value: x.id, label: x.name }))}
          projects={projects}
          contract={{
            id,
            label: c.label,
            clientId: c.clientId,
            projectId: c.projectId ?? "",
            monthlyAmount: moneyInput(c.monthlyAmount),
            status: c.status,
            durationMonths: c.durationMonths?.toString() ?? "",
            startDate: toDateInput(c.startDate),
            endDate: toDateInput(c.endDate),
            renewalDate: toDateInput(c.renewalDate),
            noticeDays: c.noticeDays?.toString() ?? "",
            notes: c.notes ?? "",
          }}
        />
      </Card>
    </>
  );
}

export default function ContractPage({ params }: PageProps<"/finance/contrats/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance?onglet=contrats">Contrats récurrents</BackLink>
      <Suspense fallback={<PageLoading />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}
