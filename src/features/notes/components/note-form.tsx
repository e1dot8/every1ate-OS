"use client";

import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/select";
import { formatDay, parseDateInput } from "@/lib/dates";
import { initialFormState } from "@/lib/forms";
import { saveNoteAction } from "@/app/(app)/notes/actions";
import { SYNTAX_HINT } from "@/features/notes/labels";
import { normalizeNoteBody, parseActions, type Person } from "@/features/notes/parse";

type Opt = { value: string; label: string };

export type NoteFormValues = {
  title: string;
  occurredAt: string;
  body: string;
  projectId: string;
  clientId: string;
  opportunityId: string;
  eventId: string;
};

const none = (label: string): Opt => ({ value: "", label });

/** Aperçu en direct des actions détectées (analyse locale, sans IA ni appel réseau). */
function ActionsPreview({ body, people, today }: { body: string; people: Person[]; today: string }) {
  const deferred = useDeferredValue(body);
  const day = useMemo(() => parseDateInput(today) ?? new Date(), [today]);
  // Même lecture que le serveur après l'enregistrement (texte normalisé).
  const actions = useMemo(
    () => parseActions(normalizeNoteBody(deferred), people, day),
    [deferred, people, day],
  );
  const n = actions.length;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
      <p role="status" className="font-bold">
        {n === 0
          ? "Aucune action détectée pour l'instant."
          : n === 1
            ? "1 action détectée"
            : `${n} actions détectées`}
      </p>
      {n ? (
        <ul className="flex flex-col gap-1" aria-label="Aperçu des actions détectées">
          {actions.map((a) => (
            <li key={a.line} className="break-words">
              <b>{a.title}</b>
              <span className="text-muted-foreground">
                {" "}
                · {a.ownerName ?? "non assigné"} · {a.dueDate ? formatDay(a.dueDate) : "sans échéance"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Rien n&apos;est créé sans votre confirmation : vous validerez chaque tâche après
        l&apos;enregistrement.
      </p>
    </div>
  );
}

export function NoteForm({
  noteId,
  version,
  initial,
  projects,
  clients,
  opportunities,
  people,
  today,
  eventTitle,
}: {
  noteId?: string;
  /** Modification : `updatedAt` (ISO) lu à l'ouverture, pour refuser un enregistrement périmé. */
  version?: string;
  initial: NoteFormValues;
  projects: Opt[];
  clients: Opt[];
  opportunities: Opt[];
  people: Person[];
  /** Aujourd'hui (Paris), AAAA-MM-JJ : référence de « demain », « vendredi »… */
  today: string;
  /** Réunion du calendrier d'origine (création uniquement). */
  eventTitle?: string;
}) {
  const [state, action] = useActionState(saveNoteAction, initialFormState);
  const v = { ...initial, ...state.values };
  const [body, setBody] = useState(initial.body);
  const bodyError = state.fieldErrors?.body;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      {noteId && version ? <input type="hidden" name="version" value={version} /> : null}
      {!noteId && initial.eventId ? <input type="hidden" name="eventId" value={initial.eventId} /> : null}
      {eventTitle ? (
        <p className="text-sm text-muted-foreground">
          Réunion du calendrier : <b className="text-foreground">{eventTitle}</b>
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <Field name="title" label="Titre" defaultValue={v.title} error={state.fieldErrors?.title} />
        <Field
          name="occurredAt"
          type="date"
          label="Date"
          defaultValue={v.occurredAt}
          error={state.fieldErrors?.occurredAt}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-body">Compte rendu</Label>
        <Textarea
          id="champ-body"
          name="body"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={bodyError ? "champ-body-erreur champ-body-aide" : "champ-body-aide"}
        />
        {bodyError ? (
          <p id="champ-body-erreur" className="text-sm text-danger">
            {bodyError}
          </p>
        ) : null}
        <p id="champ-body-aide" className="text-sm text-muted-foreground">
          {SYNTAX_HINT}
        </p>
      </div>
      <ActionsPreview body={body} people={people} today={today} />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          name="projectId"
          label="Projet (facultatif)"
          options={[none("Aucun projet"), ...projects]}
          defaultValue={v.projectId}
          error={state.fieldErrors?.projectId}
        />
        <SelectField
          name="clientId"
          label="Entreprise (facultatif)"
          options={[none("Aucune entreprise"), ...clients]}
          defaultValue={v.clientId}
          error={state.fieldErrors?.clientId}
        />
        <SelectField
          name="opportunityId"
          label="Opportunité (facultatif)"
          options={[none("Aucune opportunité"), ...opportunities]}
          defaultValue={v.opportunityId}
          error={state.fieldErrors?.opportunityId}
          hint={noteId ? undefined : "Une réunion est ajoutée à son historique."}
        />
      </div>
      <div>
        <SubmitButton>{noteId ? "Enregistrer" : "Enregistrer le compte rendu"}</SubmitButton>
      </div>
    </form>
  );
}
