import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DecisionForm } from "@/features/finance/components/forms";
import { projectOptions } from "@/features/finance/page-helpers";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Demande de décision" };

async function Form() {
  await requireUser();
  return <DecisionForm projects={await projectOptions()} />;
}

export default function NewDecisionPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/gouvernance">Gouvernance</BackLink>
      <PageHeader
        title="Changement de périmètre"
        description="Les autres associés sont notifiés (application et e-mail)."
      />
      <Card className="max-w-3xl">
        <Suspense fallback={<PageLoading />}>
          <Form />
        </Suspense>
      </Card>
    </div>
  );
}
