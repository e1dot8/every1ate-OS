"use client";

import { useActionState } from "react";
import { TextareaField } from "@/components/forms/controls";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveStandupAction } from "@/app/(app)/qg/actions";

/** Stand-up du jour, prérempli à partir de mes tâches ; modifiable jusqu'à minuit. */
export function StandupForm({
  today,
  blocked,
  published,
}: {
  today: string;
  blocked: string;
  published: boolean;
}) {
  const [state, action] = useActionState(saveStandupAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <TextareaField
        name="today"
        label="Aujourd'hui"
        rows={4}
        hint="Prérempli avec vos tâches en cours et celles à rendre aujourd'hui : corrigez librement."
        defaultValue={state.values?.today ?? today}
        error={state.fieldErrors?.today}
      />
      <TextareaField
        name="blocked"
        label="Bloqué"
        rows={2}
        hint="Un blocage devient une demande d'aide visible des associés."
        defaultValue={state.values?.blocked ?? blocked}
        error={state.fieldErrors?.blocked}
      />
      <div>
        <SubmitButton>{published ? "Mettre à jour mon stand-up" : "Publier mon stand-up"}</SubmitButton>
      </div>
    </form>
  );
}
