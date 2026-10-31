import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { BackLink, TaskRow } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getEvent } from "@/features/calendar/service";
import { ActionsForm } from "@/features/notes/components/actions-form";
import { parseActions } from "@/features/notes/parse";
import { canReceiveTasks, tasksCreatedLabel } from "@/features/notes/rules";
import { getNote, noteOptions, tasksFromNote } from "@/features/notes/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, toDateInput, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Compte rendu" };

async function NoteView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  const [options, created, event] = await Promise.all([
    noteOptions(),
    tasksFromNote(id),
    note.eventId ? getEvent(note.eventId, user.id) : null,
  ]);
  const archived = !!note.archivedAt;
  const detected = archived ? [] : parseActions(note.body, options.associates, todayDate());
  const projectOpen = note.project ? canReceiveTasks(note.project) : false;
  const visibleTasks = created.filter((t) => !t.archivedAt);

  const links = [
    note.project ? (
      <Link key="p" href={`/projets/${note.project.id}`} className="underline">
        Projet : {note.project.name}
      </Link>
    ) : null,
    note.client ? (
      <Link key="c" href={`/crm/clients/${note.client.id}`} className="underline">
        Entreprise : {note.client.name}
      </Link>
    ) : null,
    note.opportunity ? (
      <Link key="o" href={`/crm/opportunites/${note.opportunity.id}`} className="underline">
        Opportunité : {note.opportunity.title}
      </Link>
    ) : null,
    event ? (
      <Link key="e" href={`/calendrier/${event.id}`} className="underline">
        Réunion : {event.busyOnly ? "créneau privé" : event.title}
      </Link>
    ) : null,
  ].filter(Boolean);

  return (
    <>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl leading-tight font-bold tracking-tight break-words md:text-4xl">
            {note.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDay(note.occurredAt)} · rédigé par {note.author.name} ·{" "}
            {tasksCreatedLabel(note.createdTasks)}
          </p>
          {links.length ? <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{links}</p> : null}
        </div>
        {!archived ? (
          <Button asChild variant="outline">
            <Link href={`/notes/${id}/modifier`}>
              <Pencil aria-hidden="true" /> Modifier
            </Link>
          </Button>
        ) : null}
      </header>

      {archived ? (
        <FormAlert tone="info" title="Compte rendu archivé">
          Il reste consultable ; aucune tâche ne peut plus en être créée.
        </FormAlert>
      ) : null}

      <Card className="gap-3">
        <CardTitle>Compte rendu</CardTitle>
        <p className="text-sm break-words whitespace-pre-line">{note.body}</p>
      </Card>

      {!archived ? (
        <Card className="gap-3" id="actions">
          <CardTitle>Actions détectées</CardTitle>
          {note.project && !projectOpen && detected.length ? (
            <FormAlert tone="warning" title={`Le projet « ${note.project.name} » est terminé ou archivé.`}>
              Choisissez un projet en cours pour chaque tâche.
            </FormAlert>
          ) : null}
          <ActionsForm
            noteId={id}
            actions={detected.map((a) => ({
              line: a.line,
              raw: a.raw,
              title: a.title,
              ownerId: a.ownerId,
              dueDate: toDateInput(a.dueDate),
            }))}
            associates={options.associates.map((a) => ({ value: a.id, label: a.name }))}
            projects={projectOpen ? null : options.openProjects.map((p) => ({ value: p.id, label: p.name }))}
            alreadyCreated={note.createdTasks}
          />
        </Card>
      ) : null}

      {visibleTasks.length ? (
        <Card className="gap-1">
          <CardTitle>Tâches créées depuis ce compte rendu</CardTitle>
          <ul aria-label="Tâches créées depuis ce compte rendu">
            {visibleTasks.map((t) => (
              <TaskRow key={t.id} task={t} showProject />
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export default function NotePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/notes">Comptes rendus</BackLink>
      <Suspense fallback={<PageLoading />}>
        <NoteView params={params} />
      </Suspense>
    </div>
  );
}
