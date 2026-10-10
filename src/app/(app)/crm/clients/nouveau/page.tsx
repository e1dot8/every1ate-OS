import type { Metadata } from "next";
import { BackLink } from "@/components/app/bits";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ClientForm } from "@/features/crm/components/forms";

export const metadata: Metadata = { title: "Nouvelle entreprise" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/crm/clients">Entreprises</BackLink>
      <PageHeader title="Nouvelle entreprise" />
      <Card className="max-w-2xl">
        <ClientForm />
      </Card>
    </div>
  );
}
