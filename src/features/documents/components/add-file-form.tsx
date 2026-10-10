"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { addFileAction } from "@/app/(app)/documents/actions";

export function AddFileForm({
  target,
  back,
}: {
  target: { projectId?: string; taskId?: string; clientId?: string; workPackageId?: string };
  back: string;
}) {
  const [state, action] = useActionState(addFileAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      {Object.entries(target).map(([k, val]) =>
        val ? <input key={k} type="hidden" name={k} value={val} /> : null,
      )}
      <input type="hidden" name="back" value={back} />
      <Field
        name="url"
        label="Lien Google Drive (ou autre lien https)"
        defaultValue={v.url}
        error={state.fieldErrors?.url}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="title" label="Titre" defaultValue={v.title} error={state.fieldErrors?.title} />
        <SelectField
          name="kind"
          label="Type"
          defaultValue={v.kind ?? ""}
          options={[
            { value: "", label: "Détecter" },
            { value: "DOCUMENT", label: "Document" },
            { value: "DOSSIER", label: "Dossier" },
            { value: "MEDIA", label: "Média" },
            { value: "AUTRE", label: "Autre" },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="ownerLabel"
          label="Propriétaire (facultatif)"
          required={false}
          defaultValue={v.ownerLabel}
        />
        <Field
          name="documentDate"
          type="date"
          label="Date du document"
          required={false}
          defaultValue={v.documentDate}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Le fichier reste dans Drive : seule la référence est enregistrée. L&apos;accès est contrôlé par Google
        à l&apos;ouverture.
      </p>
      <div>
        <SubmitButton>Ajouter le document</SubmitButton>
      </div>
    </form>
  );
}
