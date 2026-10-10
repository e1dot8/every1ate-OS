import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/features/crm/components/forms";
import { getContact } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";
import { archiveContactAction } from "../../actions";

export const metadata: Metadata = { title: "Contact" };

async function Contact({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact || contact.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/crm/clients/${contact.client.id}`}>{contact.client.name}</BackLink>
      <PageHeader title={`${contact.firstName} ${contact.lastName}`} />
      <Card className="max-w-2xl">
        <ContactForm clientId={contact.client.id} contact={contact} />
      </Card>
      <form action={archiveContactAction}>
        <input type="hidden" name="contactId" value={id} />
        <SubmitButton variant="ghost">
          <Archive aria-hidden="true" /> Archiver le contact
        </SubmitButton>
      </form>
    </>
  );
}

export default function ContactPage({ params }: PageProps<"/crm/contacts/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Contact params={params} />
      </Suspense>
    </div>
  );
}
