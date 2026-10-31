import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/features/calendar/components/event-form";
import { eventOptions } from "@/features/calendar/options";
import { utcToLocalInput } from "@/features/calendar/rules";
import { getEvent } from "@/features/calendar/service";
import { NotesSection } from "@/features/notes/components/notes-section";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { cancelEventAction } from "../actions";

export const metadata: Metadata = { title: "Événement" };

async function EventView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const e = await getEvent(id, user.id);
  if (!e) notFound();
  if (e.busyOnly)
    return (
      <FormAlert tone="info" title="Créneau occupé">
        <Lock aria-hidden="true" className="inline size-4" /> {e.owner.name} est occupé(e) du{" "}
        {formatDateTime(e.startsAt)} au {formatDateTime(e.endsAt)}. Les détails ne sont pas partagés.
      </FormAlert>
    );
  const involved = e.ownerId === user.id || e.attendeeIds.includes(user.id);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{e.title}</h1>
        <p className="text-sm text-muted-foreground">
          {e.allDay ? "Journée entière · " : ""}
          {formatDateTime(e.startsAt)} → {formatDateTime(e.endsAt)} · organisé par {e.owner.name}
          {e.cancelledAt ? " · annulé" : ""}
        </p>
        <p className="text-sm">
          {[
            e.location,
            e.project ? (
              <Link key="p" href={`/projets/${e.project.id}`} className="underline">
                {e.project.name}
              </Link>
            ) : null,
            e.client ? (
              <Link key="c" href={`/crm/clients/${e.client.id}`} className="underline">
                {e.client.name}
              </Link>
            ) : null,
            e.opportunity ? (
              <Link key="o" href={`/crm/opportunites/${e.opportunity.id}`} className="underline">
                {e.opportunity.title}
              </Link>
            ) : null,
          ]
            .filter(Boolean)
            .map((x, i) => (
              <span key={i}>
                {i ? " · " : ""}
                {x}
              </span>
            ))}
        </p>
        {e.attendees.length ? (
          <p className="text-sm">Participants : {e.attendees.map((a) => a.user.name).join(", ")}</p>
        ) : null}
      </header>
      {e.description ? <p className="whitespace-pre-line">{e.description}</p> : null}
      <div className="max-w-3xl">
        <NotesSection
          filter={{ eventId: id }}
          newHref={`/notes/nouvelle?evenement=${id}`}
          newLabel="Rédiger le compte rendu"
        />
      </div>
      {involved && !e.cancelledAt ? (
        <Card className="max-w-3xl gap-3">
          <CardTitle>Modifier</CardTitle>
          <EventForm
            {...await eventOptions()}
            initial={{
              id,
              version: e.version,
              title: e.title,
              description: e.description ?? "",
              location: e.location ?? "",
              start: utcToLocalInput(e.startsAt),
              end: e.allDay
                ? utcToLocalInput(new Date(e.endsAt.getTime() - 86_400_000))
                : utcToLocalInput(e.endsAt),
              allDay: e.allDay,
              visibility: e.visibility,
              attendeeIds: e.attendees.map((a) => a.userId),
              projectId: e.projectId ?? "",
              clientId: e.clientId ?? "",
              opportunityId: e.opportunityId ?? "",
            }}
          />
        </Card>
      ) : null}
      {e.ownerId === user.id && !e.cancelledAt ? (
        <details className="max-w-3xl">
          <summary className="min-h-tap cursor-pointer py-2 font-bold text-danger">
            Annuler l&apos;événement
          </summary>
          <form action={cancelEventAction} className="flex flex-col gap-2">
            <input type="hidden" name="eventId" value={id} />
            <p className="text-sm">Les participants sont prévenus.</p>
            <div>
              <SubmitButton variant="destructive">Confirmer l&apos;annulation</SubmitButton>
            </div>
          </form>
        </details>
      ) : null}
    </>
  );
}

export default function EventPage({ params }: PageProps<"/calendrier/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/calendrier">Calendrier</BackLink>
      <Suspense fallback={<PageLoading />}>
        <EventView params={params} />
      </Suspense>
    </div>
  );
}
