"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "success" && state.message ? (
        <FormAlert tone="success" title={state.message} />
      ) : null}
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <Field
        name="current"
        type="password"
        label="Mot de passe actuel"
        autoComplete="current-password"
        error={state.fieldErrors?.current}
      />
      <Field
        name="password"
        type="password"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint="12 caractères minimum, absent des fuites connues."
        error={state.fieldErrors?.password}
      />
      <Field
        name="confirm"
        type="password"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />
      <div>
        <SubmitButton>Mettre à jour</SubmitButton>
      </div>
    </form>
  );
}
