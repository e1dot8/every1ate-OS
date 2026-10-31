import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OpportunityForm } from "@/features/crm/components/forms";
import { clientOptions } from "@/features/crm/options";
import { getStageSettings } from "@/features/crm/service";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouvelle opportunité" };

async function NewOpportunity({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requireUser();
  const [sp, clients, associates, settings] = await Promise.all([
    searchParams,
    clientOptions(),
    listAssociates(),
    getStageSettings(),
  ]);
  return (
    <Card className="max-w-2xl">
      {!clients.length ? (
        <p className="text-sm">
          Aucune entreprise :{" "}
          <Link href="/crm/clients/nouveau" className="font-bold underline">
            créez-en une d&apos;abord
          </Link>
          .
        </p>
      ) : null}
      <OpportunityForm
        clients={clients}
        associates={associates.map((a) => ({ value: a.id, label: a.name }))}
        currentUserId={user.id}
        // ?client=<id> (depuis une fiche ou une opportunité détectée) : ignoré si l'entreprise n'est plus listée.
        defaultClientId={clients.some((c) => c.value === sp.client) ? sp.client : undefined}
        settings={settings}
      />
    </Card>
  );
}

export default function NewOpportunityPage({ searchParams }: PageProps<"/crm/opportunites/nouvelle">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/crm">CRM</BackLink>
      <PageHeader title="Nouvelle opportunité" description="Elle démarre à l'étape « À contacter »." />
      <Suspense fallback={<PageLoading />}>
        <NewOpportunity searchParams={searchParams as Promise<{ client?: string }>} />
      </Suspense>
    </div>
  );
}
