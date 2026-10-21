"use client";

import { useActionState, useRef } from "react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { addWeeklyItemAction, saveWeekNotesAction } from "@/app/(app)/menu-semaine/actions";
import { initialFormState } from "@/lib/forms";

type Opt = { value: string; label: string };

const KIND_COPY = {
  OBJECTIF: { title: "Résultat attendu", detail: "Critère de réussite", button: "Ajouter l'objectif" },
  BLOCAGE: { title: "Le blocage", detail: "Piste ou aide nécessaire", button: "Ajouter le blocage" },
  DECISION: { title: "La décision prise", detail: "Pourquoi (facultatif)", button: "Noter la décision" },
  ACTION: { title: "L'action", detail: "Précision (facultatif)", button: "Ajouter l'action" },
} as const;

/** Ajout d'un objectif, blocage, décision ou action, avec responsable et échéance. */
export function WeeklyItemForm({
  briefingId,
  kind,
  associates,
}: {
  briefingId: string;
  kind: keyof typeof KIND_COPY;
  associates: Opt[];
}) {
  const [state, action] = useActionState(addWeeklyItemAction, initialFormState);
  const form = useRef<HTMLFormElement>(null);
  const copy = KIND_COPY[kind];
  const id = (n: string) => `${kind.toLowerCase()}-${n}`;
  return (
    <details className="group rounded-lg border border-dashed p-3">
      <summary className="min-h-tap cursor-pointer py-2 text-sm font-bold">{copy.button}</summary>
      <form ref={form} action={action} className="mt-2 flex flex-col gap-3" noValidate>
        <FormMessages state={state} />
        <input type="hidden" name="briefingId" value={briefingId} />
        <input type="hidden" name="kind" value={kind} />
        <label htmlFor={id("title")} className="text-sm font-bold">
          {copy.title}
        </label>
        <Input
          id={id("title")}
          name="title"
          maxLength={300}
          aria-invalid={state.fieldErrors?.title ? true : undefined}
        />
        {state.fieldErrors?.title ? <p className="text-sm text-danger">{state.fieldErrors.title}</p> : null}
        <label htmlFor={id("detail")} className="text-sm font-bold">
          {copy.detail}
        </label>
        <Input id={id("detail")} name="detail" maxLength={1000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={id("owner")} className="text-sm font-bold">
              Responsable
            </label>
            <select
              id={id("owner")}
              name="ownerId"
              className="min-h-tap rounded-lg border border-input bg-background px-3"
            >
              <option value="">Personne en particulier</option>
              {associates.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={id("due")} className="text-sm font-bold">
              Échéance
            </label>
            <Input id={id("due")} name="dueDate" type="date" />
          </div>
        </div>
        <div>
          <SubmitButton>{copy.button}</SubmitButton>
        </div>
      </form>
    </details>
  );
}

export function WeekNotesForm({
  briefingId,
  progressFocus,
  notes,
}: {
  briefingId: string;
  progressFocus: string;
  notes: string;
}) {
  const [state, action] = useActionState(saveWeekNotesAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="briefingId" value={briefingId} />
      <label htmlFor="champ-focus" className="text-sm font-bold">
        Ce qu&apos;on fait progresser cette semaine
      </label>
      <Input
        id="champ-focus"
        name="progressFocus"
        defaultValue={progressFocus}
        maxLength={300}
        placeholder="Une compétence, une méthode, une amélioration de l'OS…"
      />
      <label htmlFor="champ-notes" className="text-sm font-bold">
        Notes de la réunion
      </label>
      <textarea
        id="champ-notes"
        name="notes"
        rows={4}
        defaultValue={notes}
        maxLength={5000}
        className="rounded-lg border border-input px-3 py-2"
      />
      <div>
        <SubmitButton variant="outline">Enregistrer les notes</SubmitButton>
      </div>
    </form>
  );
}
