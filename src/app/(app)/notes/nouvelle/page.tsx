import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { localDay } from "@/features/calendar/rules";
import { getEvent } from "@/features/calendar/service";
import { NoteForm, type NoteFormValues } from "@/features/notes/components/note-form";
import { noteOptions } from "@/features/notes/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Nouveau compte rendu" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

async function NewNote({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const [sp, options] = await Promise.all([searchParams, noteOptions()]);
  const today = toDateInput(todayDate());
  const initial: NoteFormValues = {
    title: "",
    occurredAt: today,
    body: "",
    projectId: "",
    clientId: "",
    opportunityId: "",
    eventId: "",
  };
  const has = (list: { id: string }[], id: string | null | undefined) =>
    !!id && list.some((x) => x.id === id);

  // Depuis une réunion du calendrier : seulement si ses détails sont visibles pour cet associé.
  let eventTitle: string | undefined;
  let eventHidden = false;
  const eventId = one(sp.evenement);
  if (eventId) {
    const e = await getEvent(eventId, user.id);
    if (e && !e.busyOnly) {
      eventTitle = e.title;
      initial.eventId = e.id;
      initial.title = `Compte rendu — ${e.title}`.slice(0, 200);
      initial.occurredAt = localDay(e.startsAt);
      if (has(options.projects, e.projectId)) initial.projectId = e.projectId!;
      if (has(options.clients, e.clientId)) initial.clientId = e.clientId!;
      if (has(options.opportunities, e.opportunityId)) initial.opportunityId = e.opportunityId!;
    } else eventHidden = true;
  }
  const projectId = one(sp.projet);
  const project = options.projects.find((p) => p.id === projectId);
  if (project) {
    initial.projectId = project.id;
    if (!initial.clientId && has(options.clients, project.clientId)) initial.clientId = project.clientId!;
  }
  const clientId = one(sp.client);
  if (has(options.clients, clientId)) initial.clientId = clientId!;
  const opportunity = options.opportunities.find((o) => o.id === one(sp.opportunite));
  if (opportunity) {
    initial.opportunityId = opportunity.id;
    if (!initial.clientId && has(options.clients, opportunity.clientId))
      initial.clientId = opportunity.clientId;
  }

  return (
    <Card className="max-w-3xl">
      {eventHidden ? (
        <FormAlert tone="info" title="Réunion introuvable ou privée">
          Le compte rendu ne sera pas rattaché à cet événement.
        </FormAlert>
      ) : null}
      <NoteForm
        initial={initial}
        eventTitle={eventTitle}
        projects={options.projects.map((p) => ({ value: p.id, label: p.name }))}
        clients={options.clients.map((c) => ({ value: c.id, label: c.name }))}
        opportunities={options.opportunities.map((o) => ({ value: o.id, label: o.title }))}
        people={options.associates}
        today={today}
      />
    </Card>
  );
}

export default function NewNotePage({ searchParams }: PageProps<"/notes/nouvelle">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/notes">Comptes rendus</BackLink>
      <PageHeader
        title="Nouveau compte rendu"
        description="Notez la réunion ; les lignes d'action deviendront des tâches après confirmation."
      />
      <Suspense fallback={<PageLoading />}>
        <NewNote searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </div>
  );
}
