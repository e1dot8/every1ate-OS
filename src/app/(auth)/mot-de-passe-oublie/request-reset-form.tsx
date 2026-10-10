"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { requestResetAction } from "../actions";

export function RequestResetForm() {
  const [state, action] = useActionState(requestResetAction, initialFormState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Vérifiez vos e-mails</h1>
        <FormAlert
          tone="success"
          title="Si un compte existe pour cette adresse, un lien vient d'être envoyé."
        >
          Il expire dans 1 heure. Pensez à regarder dans les indésirables.
        </FormAlert>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Mot de passe oublié</h1>
        <p className="text-muted-foreground">
          Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.
        </p>
      </header>
      <form action={action} className="flex flex-col gap-4" noValidate>
        {state.status === "blocked" ? (
          <FormAlert tone="warning" title={state.message ?? "Trop de demandes."} />
        ) : null}
        <Field
          name="email"
          type="email"
          label="Adresse e-mail"
          autoComplete="username"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <SubmitButton className="w-full">Envoyer le lien</SubmitButton>
      </form>
    </>
  );
}
