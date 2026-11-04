"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/select";
import { editMessageAction } from "@/app/(app)/discussions/actions";
import { MESSAGE_MAX_LENGTH } from "@/features/discussions/rules";
import { initialFormState } from "@/lib/forms";

/** Modification d'un de ses messages, à la place du message. */
export function EditMessageForm({
  messageId,
  body,
  retour,
}: {
  messageId: string;
  body: string;
  retour: string;
}) {
  const [state, action] = useActionState(editMessageAction, initialFormState);
  const id = `modifier-${messageId}`;
  // Une modification réussie referme le formulaire ; s'il reste ouvert, c'est pour un avertissement
  // (mention ambiguë) : la modification est déjà enregistrée.
  const saved = state.status === "success";
  return (
    <form action={action} className="flex flex-col gap-2 py-1" noValidate>
      {saved && state.message ? (
        <FormAlert tone="warning" title={state.message}>
          Visible par toi seul.
        </FormAlert>
      ) : (
        <FormMessages state={state} />
      )}
      <input type="hidden" name="messageId" value={messageId} />
      <input type="hidden" name="retour" value={retour} />
      <label htmlFor={id} className="sr-only">
        Modifier le message
      </label>
      <Textarea
        id={id}
        name="body"
        rows={3}
        autoFocus
        maxLength={MESSAGE_MAX_LENGTH}
        defaultValue={state.values?.body ?? body}
        className="min-h-20"
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        <Link
          href={`${retour}#m-${messageId}`}
          className="inline-flex min-h-tap items-center rounded-lg border border-input px-4 text-sm font-bold hover:bg-muted"
        >
          {saved ? "Fermer" : "Annuler"}
        </Link>
      </div>
    </form>
  );
}
