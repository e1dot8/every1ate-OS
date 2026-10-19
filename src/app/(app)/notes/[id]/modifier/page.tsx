import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { NoteForm } from "@/features/notes/components/note-form";
import { getNote, noteOptions } from "@/features/notes/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput, todayDate } from "@/lib/dates";
import { archiveNoteAction } from "../../actions";

export const metadata: Metadata = { title: "Modifier le compte rendu" };

type Opt = { value: string; label: string };
/** Garde le lien actuel sélectionnable même si la fiche liée a été archivée depuis. */
const withCurrent = (list: Opt[], current: Opt | null) =>
  current && !list.some((o) => o.value === current.value) ? [current, ...list] : list;

async function EditNote({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [note, options] = await Promise.all([getNote(id), noteOptions()]);
  if (!note || note.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/notes/${id}`}>Compte rendu</BackLink>
      <PageHeader title="Modifier le compte rendu" />
      <Card className="max-w-3xl">
        <NoteForm
          noteId={id}
          version={note.updatedAt.toISOString()}
          initial={{
            title: note.title,
            occurredAt: toDateInput(note.occurredAt),
            body: note.body,
            projectId: note.projectId ?? "",
            clientId: note.clientId ?? "",
            opportunityId: note.opportunityId ?? "",
            eventId: note.eventId ?? "",
          }}
          projects={withCurrent(
            options.projects.map((p) => ({ value: p.id, label: p.name })),
            note.project ? { value: note.project.id, label: note.project.name } : null,
          )}
          clients={withCurrent(
            options.clients.map((c) => ({ value: c.id, label: c.name })),
            note.client ? { value: note.client.id, label: note.client.name } : null,
          )}
          opportunities={withCurrent(
            options.opportunities.map((o) => ({ value: o.id, label: o.title })),
            note.opportunity ? { value: note.opportunity.id, label: note.opportunity.title } : null,
          )}
          people={options.associates}
          today={toDateInput(todayDate())}
        />
      </Card>
      <details className="max-w-3xl">
        <summary className="min-h-tap cursor-pointer py-2 font-bold text-danger">
          Archiver le compte rendu
        </summary>
        <form action={archiveNoteAction} className="flex flex-col gap-2">
          <input type="hidden" name="noteId" value={id} />
          <p className="text-sm">
            Il disparaît des listes ; les tâches déjà créées depuis ce compte rendu sont conservées.
          </p>
          <div>
            <SubmitButton variant="destructive">
              <Archive aria-hidden="true" /> Confirmer l&apos;archivage
            </SubmitButton>
          </div>
        </form>
      </details>
    </>
  );
}

export default function EditNotePage({ params }: PageProps<"/notes/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EditNote params={params} />
      </Suspense>
    </div>
  );
}
