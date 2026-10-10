import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SettingsForm } from "@/features/crm/components/forms";
import { getStageSettings } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Réglages CRM" };

async function Settings() {
  await requireUser();
  return <SettingsForm settings={await getStageSettings()} />;
}

export default function CrmSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/crm">CRM</BackLink>
      <PageHeader
        title="Probabilités par étape"
        description="Utilisées quand une opportunité n'a pas de probabilité saisie. Chaque modification est journalisée."
      />
      <Card className="max-w-md">
        <Suspense fallback={<PageLoading />}>
          <Settings />
        </Suspense>
      </Card>
    </div>
  );
}
