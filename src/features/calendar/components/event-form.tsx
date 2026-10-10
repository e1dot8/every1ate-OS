"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { CheckboxGroup, SelectField, TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { saveEventAction, type EventFormState } from "@/app/(app)/calendrier/actions";

type Opt = { value: string; label: string };
export type EventValues = {
  id?: string;
  version?: number;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  visibility: string;
  attendeeIds: string[];
  projectId: string;
  clientId: string;
  opportunityId: string;
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

export function EventForm({
  initial,
  associates,
  projects,
  clients,
  opportunities,
}: {
  initial: EventValues;
  associates: Opt[];
  projects: Opt[];
  clients: Opt[];
  opportunities: Opt[];
}) {
  const [state, action] = useActionState<EventFormState, FormData>(saveEventAction, { status: "idle" });
  const v = { ...initial, ...(state.values ?? {}) } as Record<string, unknown>;
  const [allDay, setAllDay] = useState(state.values ? state.values.allDay === "on" : initial.allDay);
  const start = String(v.start ?? "");
  const end = String(v.end ?? "");
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && !state.concurrent ? (
        <FormAlert tone="danger" title={state.message} />
      ) : null}
      {state.concurrent ? (
        <FormAlert tone="warning" title={state.message ?? "Modification concurrente"}>
          <p>
            Version enregistrée par ailleurs ({fmt(state.concurrent.updatedAt)}) :{" "}
            <b>{state.concurrent.title}</b>, {fmt(state.concurrent.startsAt)} → {fmt(state.concurrent.endsAt)}
            {state.concurrent.location ? `, ${state.concurrent.location}` : ""}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SubmitButton>Garder ma version</SubmitButton>
            <Button asChild variant="outline">
              <Link href={initial.id ? `/calendrier/${initial.id}` : "/calendrier"}>
                Garder l&apos;autre version
              </Link>
            </Button>
          </div>
          <input type="hidden" name="force" value="true" />
        </FormAlert>
      ) : null}
      {state.conflicts?.length ? (
        <FormAlert tone="warning" title={state.message ?? "Conflits d'agenda"}>
          <ul className="list-disc pl-5">
            {state.conflicts.map((c) => (
              <li key={c.id}>
                {c.title} · {c.when}
              </li>
            ))}
          </ul>
          {state.savedId ? (
            <Link href={`/calendrier/${state.savedId}`} className="mt-2 inline-block font-bold underline">
              Voir l&apos;événement
            </Link>
          ) : null}
        </FormAlert>
      ) : null}
      {initial.id ? <input type="hidden" name="eventId" value={initial.id} /> : null}
      {initial.version != null ? (
        <input type="hidden" name="version" value={state.concurrent?.version ?? initial.version} />
      ) : null}
      <Field
        name="title"
        label="Titre"
        defaultValue={String(v.title ?? "")}
        error={state.fieldErrors?.title}
      />
      <label className="flex min-h-tap items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="size-5 accent-ink"
        />{" "}
        Journée entière
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          key={`s-${allDay}`}
          name="start"
          type={allDay ? "date" : "datetime-local"}
          label="Début (heure de Paris)"
          defaultValue={allDay ? start.slice(0, 10) : start}
          error={state.fieldErrors?.start}
        />
        <Field
          key={`e-${allDay}`}
          name="end"
          type={allDay ? "date" : "datetime-local"}
          label="Fin"
          defaultValue={allDay ? end.slice(0, 10) : end}
          error={state.fieldErrors?.end}
        />
      </div>
      <Field
        name="location"
        label="Lieu ou lien visio"
        required={false}
        defaultValue={String(v.location ?? "")}
      />
      <CheckboxGroup
        name="attendeeIds"
        label="Participants"
        options={associates}
        defaultValues={initial.attendeeIds}
      />
      <SelectField
        name="visibility"
        label="Visibilité pour les autres associés"
        defaultValue={String(v.visibility ?? "OCCUPE")}
        hint="Par défaut, les associés non invités ne voient qu'un créneau « Occupé »."
        options={[
          { value: "OCCUPE", label: "Occupé seulement (détails privés)" },
          { value: "PARTAGE", label: "Détails partagés avec l'équipe" },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          name="projectId"
          label="Projet"
          defaultValue={String(v.projectId ?? "")}
          options={[{ value: "", label: "—" }, ...projects]}
        />
        <SelectField
          name="clientId"
          label="Client"
          defaultValue={String(v.clientId ?? "")}
          options={[{ value: "", label: "—" }, ...clients]}
        />
        <SelectField
          name="opportunityId"
          label="Opportunité"
          defaultValue={String(v.opportunityId ?? "")}
          options={[{ value: "", label: "—" }, ...opportunities]}
        />
      </div>
      <TextareaField name="description" label="Notes" defaultValue={String(v.description ?? "")} />
      {!state.concurrent ? (
        <div>
          <SubmitButton>{initial.id ? "Enregistrer" : "Créer l'événement"}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
