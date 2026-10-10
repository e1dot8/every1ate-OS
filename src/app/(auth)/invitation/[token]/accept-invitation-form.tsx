"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { acceptInvitationAction } from "../../actions";
import { PasswordRules } from "../../password-rules";

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvitationAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <input type="hidden" name="token" value={token} />
      <Field
        name="email"
        type="email"
        label="Adresse e-mail"
        defaultValue={email}
        readOnly
        autoComplete="username"
        hint="Définie par l'invitation, non modifiable."
      />
      <Field
        name="password"
        type="password"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <PasswordRules />
      <Field
        name="confirm"
        type="password"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton className="w-full" pendingLabel="Activation…">
        Activer mon compte
      </SubmitButton>
    </form>
  );
}
