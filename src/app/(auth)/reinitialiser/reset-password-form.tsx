"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextLink } from "@/components/ui/text-link";
import { initialFormState } from "@/lib/forms";
import { resetPasswordAction } from "../actions";
import { PasswordRules } from "../password-rules";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, action] = useActionState(resetPasswordAction, initialFormState);

  if (!token || params.get("error")) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="danger" title="Ce lien a expiré ou a déjà servi.">
          Demandez un nouveau lien de réinitialisation.
        </FormAlert>
        <TextLink href="/mot-de-passe-oublie">Demander un nouveau lien</TextLink>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <input type="hidden" name="token" value={token} />
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
      <SubmitButton className="w-full">Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}
