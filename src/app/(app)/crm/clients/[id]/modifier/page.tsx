import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ClientForm } from "@/features/crm/components/forms";
import { getClient } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Modifier l'entreprise" };

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <>
      <BackLink href={`/crm/clients/${id}`}>{client.name}</BackLink>
      <PageHeader title="Modifier l'entreprise" />
      <Card className="max-w-2xl">
        <ClientForm client={client} />
      </Card>
    </>
  );
}

export default function EditClientPage({ params }: PageProps<"/crm/clients/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}
