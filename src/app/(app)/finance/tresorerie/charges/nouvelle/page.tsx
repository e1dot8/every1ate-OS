import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ChargeForm } from "@/features/finance/components/treasury-forms";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouvelle charge fixe" };

async function NewCharge() {
  await requireUser();
  return <ChargeForm />;
}

export default function NewChargePage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance/tresorerie">Trésorerie</BackLink>
      <PageHeader
        title="Nouvelle charge fixe"
        description="Loyer, salaires, abonnements : répétée à chaque échéance dans la trésorerie prévisionnelle."
      />
      <Card className="max-w-3xl">
        <Suspense fallback={<PageLoading />}>
          <NewCharge />
        </Suspense>
      </Card>
    </div>
  );
}
