import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageLoading } from "@/components/layout/page-header";
import { getOpportunity } from "@/features/crm/service";
import { ProjectWizard } from "@/features/projects/components/project-wizard";
import { listAssociates, listClients } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, toDateInput, todayDate } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";

export const metadata: Metadata = { title: "Convertir en projet" };

async function Convert({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [opp, associates, clients] = await Promise.all([getOpportunity(id), listAssociates(), listClients()]);
  if (!opp || opp.archivedAt) notFound();
  if (opp.project)
    return (
      <FormAlert tone="info" title="Cette opportunité a déjà été convertie.">
        <Link href={`/projets/${opp.project.id}`} className="font-bold underline">
          Ouvrir « {opp.project.name} »
        </Link>
      </FormAlert>
    );
  if (opp.stage !== "GAGNE")
    return <FormAlert tone="warning" title="Passez d'abord l'opportunité à l'étape « Gagné »." />;
  const description = [
    `Issu de l'opportunité « ${opp.title} ».`,
    opp.amount ? `Montant estimé HT : ${formatMoney(toCents(opp.amount))}.` : null,
    opp.contact
      ? `Contact : ${opp.contact.firstName} ${opp.contact.lastName}${opp.contact.email ? ` (${opp.contact.email})` : ""}.`
      : null,
    opp.expectedCloseDate ? `Clôture commerciale estimée : ${formatDay(opp.expectedCloseDate)}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <ProjectWizard
      associates={associates.map((a) => ({ value: a.id, label: a.name }))}
      clients={clients.map((c) => ({ value: c.id, label: c.name }))}
      currentUserId={user.id}
      today={toDateInput(todayDate())}
      initial={{ name: opp.title, clientId: opp.clientId, description }}
      opportunityId={id}
    />
  );
}

export default function ConvertPage({ params }: PageProps<"/crm/opportunites/[id]/convertir">) {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/crm">CRM</BackLink>
      <Suspense fallback={<PageLoading />}>
        <Convert params={params} />
      </Suspense>
    </div>
  );
}
