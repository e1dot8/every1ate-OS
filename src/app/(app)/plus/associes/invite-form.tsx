"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { inviteAction } from "../actions";

export function InviteForm() {
  const [state, action] = useActionState(inviteAction, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      noValidate
      key={state.status === "success" ? state.message : "form"}
    >
      {state.status === "success" && state.message ? (
        <FormAlert tone="success" title={state.message} />
      ) : null}
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <Field
        name="name"
        label="Prénom"
        autoComplete="off"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Field
        name="email"
        type="email"
        label="Adresse e-mail"
        autoComplete="off"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <div>
        <SubmitButton pendingLabel="Envoi…">Envoyer l&apos;invitation</SubmitButton>
      </div>
    </form>
  );
}
