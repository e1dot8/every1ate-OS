"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveObjectiveAction } from "@/app/(app)/finance/analyses/actions";

export type ObjectiveValues = { revenue: string; margin: string; projectCount: string };

/** Objectifs annuels de l'agence (HT). Un champ vide = pas d'objectif sur cet indicateur. */
export function ObjectiveForm({ year, values }: { year: number; values: ObjectiveValues }) {
  const [state, action] = useActionState(saveObjectiveAction, initialFormState);
  const v: Partial<Record<string, string>> = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate aria-label="Objectifs annuels">
      <FormMessages state={state} />
      <input type="hidden" name="pageYear" value={year} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="year"
          type="number"
          label="Année"
          defaultValue={v.year ?? String(year)}
          error={state.fieldErrors?.year}
        />
        <Field
          name="projectCount"
          type="number"
          label="Nombre de projets"
          required={false}
          hint="Facultatif. Projets démarrés dans l'année."
          defaultValue={v.projectCount ?? values.projectCount}
          error={state.fieldErrors?.projectCount}
        />
        <Field
          name="revenue"
          label="CA HT objectif (€)"
          required={false}
          hint="Facultatif. Facturé dans l'année, ex. 250 000."
          defaultValue={v.revenue ?? values.revenue}
          error={state.fieldErrors?.revenue}
        />
        <Field
          name="margin"
          label="Marge HT objectif (€)"
          required={false}
          hint="Facultatif. Facturé moins coûts engagés de l'année."
          defaultValue={v.margin ?? values.margin}
          error={state.fieldErrors?.margin}
        />
      </div>
      <div>
        <SubmitButton>Enregistrer les objectifs</SubmitButton>
      </div>
    </form>
  );
}
