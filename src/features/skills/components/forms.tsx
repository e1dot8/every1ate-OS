"use client";

import { useActionState } from "react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { addEvidenceAction, endorseAction } from "@/app/(app)/competences/actions";
import { initialFormState } from "@/lib/forms";

export function EvidenceForm({ skillKey }: { skillKey: string }) {
  const [state, action] = useActionState(addEvidenceAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessages state={state} />
      <input type="hidden" name="skillKey" value={skillKey} />
      <label className="flex flex-col gap-1 text-sm font-bold">
        Une preuve
        <Input name="text" maxLength={500} placeholder="Ex. deck présenté à Dior, validé du premier coup" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Lien (facultatif)
        <Input name="url" type="url" maxLength={500} placeholder="https://" />
      </label>
      <div>
        <SubmitButton variant="outline">Ajouter la preuve</SubmitButton>
      </div>
    </form>
  );
}

export function EndorseForm({ userId, skillKey, name }: { userId: string; skillKey: string; name: string }) {
  const [state, action] = useActionState(endorseAction, initialFormState);
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessages state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="skillKey" value={skillKey} />
      <label className="flex flex-col gap-1 text-sm font-bold">
        Un mot pour {name} (facultatif)
        <Input name="note" maxLength={300} placeholder="Ce que vous avez vu, concrètement" />
      </label>
      <div>
        <SubmitButton>Reconnaître cette compétence</SubmitButton>
      </div>
    </form>
  );
}
