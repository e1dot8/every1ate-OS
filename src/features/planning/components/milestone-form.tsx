"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveMilestoneAction } from "@/app/(app)/projets/[id]/roadmap/actions";

type Opt = { value: string; label: string };

export function MilestoneForm({
  projectId,
  lots,
  milestone,
}: {
  projectId: string;
  lots: Opt[];
  milestone?: { id: string; name: string; date: string; workPackageId: string | null; reached: boolean };
}) {
  const [state, action] = useActionState(saveMilestoneAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  const m = milestone;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      {m ? <input type="hidden" name="milestoneId" value={m.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="name"
          label="Nom du jalon"
          defaultValue={v.name ?? m?.name}
          error={state.fieldErrors?.name}
        />
        <Field
          name="date"
          type="date"
          label="Date"
          defaultValue={v.date ?? m?.date}
          error={state.fieldErrors?.date}
        />
      </div>
      <SelectField
        name="workPackageId"
        label="Lot (facultatif)"
        defaultValue={m?.workPackageId ?? ""}
        options={[{ value: "", label: "Projet entier" }, ...lots]}
      />
      {m ? (
        <label className="flex min-h-tap items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="reached" defaultChecked={m.reached} className="size-5 accent-ink" />{" "}
          Jalon atteint
        </label>
      ) : null}
      <div>
        <SubmitButton>{m ? "Enregistrer" : "Ajouter le jalon"}</SubmitButton>
      </div>
    </form>
  );
}
