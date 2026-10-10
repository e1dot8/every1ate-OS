import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/features/planning/rules";
import { journalDetail, journalLabel } from "@/features/projects/journal-labels";
import { CorrectTimeForm } from "@/features/time/components/timer";
import { entryHistory, getEntry } from "@/features/time/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, toDateInput } from "@/lib/dates";
import { deleteTimeAction } from "../actions";

export const metadata: Metadata = { title: "Corriger une saisie" };

async function EntryView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const entry = await getEntry(id, user.id);
  if (!entry || (entry.source === "TIMER" && !entry.endedAt)) notFound();
  const history = await entryHistory(id);
  const minutes = entry.durationMinutes ?? 0;
  return (
    <>
      <BackLink href="/temps">Temps</BackLink>
      <PageHeader
        title="Corriger une saisie"
        description={`${entry.task.title} · ${entry.task.project.name}`}
      />
      <Card className="max-w-2xl">
        <CorrectTimeForm
          entry={{
            id,
            date: toDateInput(entry.date),
            duration: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`,
            comment: entry.comment ?? "",
          }}
        />
      </Card>
      <Card className="max-w-2xl gap-2">
        <CardTitle>Historique des modifications</CardTitle>
        <ol className="flex flex-col gap-1.5 text-sm">
          {history.map((h) => {
            const detail = journalDetail(h.before, h.after);
            return (
              <li key={h.id}>
                <span className="text-muted-foreground">{formatDateTime(h.createdAt)} · </span>
                {journalLabel(h.action)}
                {detail ? <span className="text-muted-foreground"> ({detail})</span> : null}
                {h.reason ? <span className="text-muted-foreground"> — {h.reason}</span> : null}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground">Durée actuelle : {formatMinutes(minutes)}</p>
      </Card>
      <details className="max-w-2xl">
        <summary className="inline-flex min-h-tap cursor-pointer items-center gap-2 font-bold text-danger">
          <Trash2 aria-hidden="true" className="size-4" /> Supprimer cette saisie
        </summary>
        <form action={deleteTimeAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="entryId" value={id} />
          <p className="text-sm">
            La saisie sera retirée des totaux ; la suppression reste tracée dans le journal.
          </p>
          <div>
            <SubmitButton variant="destructive" pendingLabel="Suppression…">
              Confirmer la suppression
            </SubmitButton>
          </div>
        </form>
      </details>
    </>
  );
}

export default function EntryPage({ params }: PageProps<"/temps/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EntryView params={params} />
      </Suspense>
    </div>
  );
}
