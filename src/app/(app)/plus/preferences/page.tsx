import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getPreferences } from "@/features/badges/service";
import { requireUser } from "@/lib/auth/session";
import { PreferencesForm } from "./prefs-form";

export const metadata: Metadata = { title: "Préférences" };

async function Prefs() {
  const user = await requireUser();
  const p = await getPreferences(user.id);
  return <PreferencesForm prefs={p} />;
}

export default function PreferencesPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/plus">Plus</BackLink>
      <PageHeader
        title="Préférences"
        description="Célébrations, partage des badges et série de régularité : c'est vous qui réglez."
      />
      <Card className="max-w-xl">
        <Suspense fallback={<PageLoading />}>
          <Prefs />
        </Suspense>
      </Card>
    </div>
  );
}
