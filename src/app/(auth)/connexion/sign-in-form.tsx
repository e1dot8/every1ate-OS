"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextLink } from "@/components/ui/text-link";
import { initialFormState } from "@/lib/forms";
import { signInAction } from "../actions";

export function SignInForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signInAction, initialFormState);

  if (state.status === "blocked") {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="warning" title="Trop de tentatives.">
          La connexion à ce compte est suspendue 15 minutes. Vous pouvez aussi réinitialiser votre mot de
          passe.
        </FormAlert>
        <TextLink href="/mot-de-passe-oublie">Réinitialiser mon mot de passe</TextLink>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {params.get("reinitialise") ? (
        <FormAlert tone="success" title="Mot de passe modifié.">
          Connectez-vous avec votre nouveau mot de passe. Vos autres appareils ont été déconnectés.
        </FormAlert>
      ) : null}
      {state.status === "error" && state.message ? (
        <FormAlert tone="danger" title={state.message}>
          Après 5 essais, la connexion est suspendue 15 minutes.
        </FormAlert>
      ) : null}
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <Field
        name="email"
        type="email"
        label="Adresse e-mail"
        autoComplete="username"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        name="password"
        type="password"
        label="Mot de passe"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <div className="flex justify-end">
        <TextLink href="/mot-de-passe-oublie">Mot de passe oublié ?</TextLink>
      </div>
      <SubmitButton className="w-full" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  );
}
