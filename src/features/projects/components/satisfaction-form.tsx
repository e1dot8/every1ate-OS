"use client";

import { useActionState } from "react";
import { FormMessages } from "@/components/forms/form-messages";
import { TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveSatisfactionAction } from "@/app/(app)/projets/actions";

const LABELS = ["", "Très déçu", "Déçu", "Correct", "Satisfait", "Enchanté"];

export function SatisfactionForm({
  projectId,
  score,
  note,
}: {
  projectId: string;
  score: number | null;
  note: string | null;
}) {
  const [state, action] = useActionState(saveSatisfactionAction, initialFormState);
  const current = state.values?.score ?? (score ? String(score) : "");
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-bold">Ce que le client en a pensé</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex min-h-tap cursor-pointer items-center gap-2 rounded-full border px-3 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
          >
            <input
              type="radio"
              name="score"
              value={n}
              defaultChecked={current === String(n)}
              className="sr-only"
            />
            <b>{n}</b> <span className="text-sm">{LABELS[n]}</span>
          </label>
        ))}
      </fieldset>
      <TextareaField
        name="note"
        label="Ses mots (facultatif)"
        defaultValue={state.values?.note ?? note ?? ""}
      />
      <div>
        <SubmitButton variant="outline">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
