import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AgencyForm, AssociateRow, DigestForm } from "@/features/settings/components/forms";
import { getAgencySettings, listAssociateSettings } from "@/features/settings/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Réglages" };

async function Settings() {
  const user = await requireUser();
  const [agency, associates] = await Promise.all([getAgencySettings(), listAssociateSettings()]);
  const me = associates.find((a) => a.id === user.id);
  return (
    <>
      <Card className="max-w-2xl gap-3">
        <CardTitle>Mon brief</CardTitle>
        <DigestForm frequency={me?.digestFrequency ?? "AUCUN"} />
      </Card>
      <Card className="max-w-2xl gap-3">
        <CardTitle>Agence</CardTitle>
        <CardDescription>
          Sert à valoriser le temps passé dans les marges et à calculer la charge à venir.
        </CardDescription>
        <AgencyForm
          defaultHourlyCostCents={agency.defaultHourlyCostCents}
          defaultWeeklyHours={agency.defaultWeeklyHours}
        />
      </Card>
      <Card className="max-w-2xl gap-1">
        <CardTitle>Par associé</CardTitle>
        <CardDescription>Chaque modification est journalisée.</CardDescription>
        {associates.map((a) => (
          <AssociateRow key={a.id} user={a} />
        ))}
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/plus">Plus</BackLink>
      <PageHeader title="Réglages" description="Brief, coût du temps et capacité de travail." />
      <Suspense fallback={<PageLoading />}>
        <Settings />
      </Suspense>
    </div>
  );
}
