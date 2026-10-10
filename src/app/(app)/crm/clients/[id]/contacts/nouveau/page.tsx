import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/features/crm/components/forms";
import { getClient } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouveau contact" };

async function NewContact({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <>
      <BackLink href={`/crm/clients/${id}`}>{client.name}</BackLink>
      <PageHeader title="Nouveau contact" description="Coordonnées professionnelles uniquement." />
      <Card className="max-w-2xl">
        <ContactForm clientId={id} />
      </Card>
    </>
  );
}

export default function NewContactPage({ params }: PageProps<"/crm/clients/[id]/contacts/nouveau">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <NewContact params={params} />
      </Suspense>
    </div>
  );
}
