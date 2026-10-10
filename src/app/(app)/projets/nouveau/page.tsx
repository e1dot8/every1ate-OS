import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { ProjectWizard } from "@/features/projects/components/project-wizard";
import { listAssociates, listClients } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Nouveau projet" };

async function Wizard() {
  const user = await requireUser();
  const [associates, clients] = await Promise.all([listAssociates(), listClients()]);
  return (
    <ProjectWizard
      associates={associates.map((a) => ({ value: a.id, label: a.name }))}
      clients={clients.map((c) => ({ value: c.id, label: c.name }))}
      currentUserId={user.id}
      today={toDateInput(todayDate())}
    />
  );
}

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/projets">Projets</BackLink>
      <Suspense fallback={<PageLoading />}>
        <Wizard />
      </Suspense>
    </div>
  );
}
