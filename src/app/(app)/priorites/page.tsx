import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PriorityPicker } from "@/features/cockpit/components/priority-picker";
import { MAX_PRIORITIES, getDayPriorities, openTasksFor } from "@/features/cockpit/service";
import { taskStatusLabels } from "@/features/projects/labels";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Mes priorités" };

async function Picker() {
  const user = await requireUser();
  const [open, current] = await Promise.all([openTasksFor(user.id), getDayPriorities(user.id)]);
  if (!open.length)
    return (
      <EmptyState title="Aucune tâche ouverte.">
        Les tâches dont vous êtes responsable ou contributeur apparaîtront ici.
      </EmptyState>
    );
  const selected = current.chosen
    ? current.tasks.filter((t) => open.some((o) => o.id === t.id)).map((t) => t.id)
    : [];
  return (
    <Card>
      <PriorityPicker
        max={MAX_PRIORITIES}
        selected={selected}
        options={open.map((t) => ({
          id: t.id,
          title: t.title,
          detail: [
            t.project.name,
            taskStatusLabels[t.status],
            t.dueDate ? `échéance ${formatDay(t.dueDate)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
    </Card>
  );
}

export default function PrioritiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/">Cockpit</BackLink>
      <PageHeader
        crumb="Briefing du jour"
        title="Mes priorités du jour"
        description="Trois au plus. Le reste attend demain, et ce n'est pas grave."
      />
      <Suspense fallback={<PageLoading />}>
        <Picker />
      </Suspense>
    </div>
  );
}
