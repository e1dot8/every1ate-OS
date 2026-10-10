import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive, CalendarDays, Pencil, Plus, Users } from "lucide-react";
import { Avatar, BackLink, EmptyState, Meta, TaskRow } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getWorkPackage } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { archiveAction } from "../../../actions";

export const metadata: Metadata = { title: "Lot" };

async function Lot({ params }: { params: Promise<{ id: string; lotId: string }> }) {
  await requireUser();
  const { id, lotId } = await params;
  const lot = await getWorkPackage(id, lotId);
  if (!lot) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}?onglet=lots`}>{lot.project.name}</BackLink>
      <header className="flex flex-col gap-1">
        <p className="font-annotation text-sm text-pen-strong">Lot</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{lot.name}</h1>
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <Avatar name={lot.owner?.name} />{" "}
          {lot.owner ? `${lot.owner.name} · responsable du lot` : "Responsable à désigner"}
        </span>
        {lot.plannedStart ? (
          <Meta icon={CalendarDays}>
            {formatDay(lot.plannedStart)} → {formatDay(lot.plannedEnd)}
          </Meta>
        ) : null}
        {lot.members.length ? (
          <Meta icon={Users}>{lot.members.map((m) => m.user.name).join(", ")}</Meta>
        ) : null}
      </div>
      {lot.description ? <p className="max-w-prose">{lot.description}</p> : null}
      {lot.archivedAt ? (
        <p className="text-sm font-bold text-warning">Lot archivé.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/projets/${id}/taches/nouvelle?lot=${lotId}`}>
              <Plus aria-hidden="true" /> Tâche
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projets/${id}/lots/${lotId}/modifier`}>
              <Pencil aria-hidden="true" /> Modifier
            </Link>
          </Button>
          <form action={archiveAction}>
            <input type="hidden" name="kind" value="lot" />
            <input type="hidden" name="id" value={lotId} />
            <input type="hidden" name="archived" value="true" />
            <SubmitButton variant="ghost">
              <Archive aria-hidden="true" /> Archiver
            </SubmitButton>
          </form>
        </div>
      )}
      {lot.tasks.length ? (
        <Card className="gap-0 py-1">
          <ul aria-label="Tâches du lot">
            {lot.tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Aucune tâche dans ce lot." />
      )}
    </>
  );
}

export default function LotPage({ params }: PageProps<"/projets/[id]/lots/[lotId]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Lot params={params} />
      </Suspense>
    </div>
  );
}
