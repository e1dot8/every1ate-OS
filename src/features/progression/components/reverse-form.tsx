"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { reverseXpAction } from "@/app/(app)/progression/actions";
import { initialFormState } from "@/lib/forms";

/** Corriger une attribution erronée : ouvre un petit formulaire avec la raison (journalisée). */
export function ReverseXpForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reverseXpAction, initialFormState);
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Corriger
      </Button>
    );
  return (
    <form action={action} className="flex w-full flex-col gap-2 rounded-lg border p-3">
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm font-bold">
        Pourquoi corriger ?
        <input
          name="reason"
          required
          maxLength={300}
          className="min-h-tap rounded-lg border border-input px-3 font-normal"
          placeholder="Ex. tâche fermée par erreur"
        />
      </label>
      <div className="flex gap-2">
        <SubmitButton variant="outline">Annuler ces XP</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}
