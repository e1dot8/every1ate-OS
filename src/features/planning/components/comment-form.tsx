"use client";

import { useActionState } from "react";
import { FormMessages } from "@/components/forms/form-messages";
import { TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { addCommentAction } from "@/app/(app)/projets/actions";

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState(addCommentAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      <TextareaField
        name="body"
        label="Ajouter un commentaire"
        defaultValue={state.status === "error" ? state.values?.body : ""}
        error={state.fieldErrors?.body}
      />
      <div>
        <SubmitButton pendingLabel="Publication…">Publier</SubmitButton>
      </div>
    </form>
  );
}
