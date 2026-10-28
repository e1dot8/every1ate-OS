"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveThresholdsAction } from "@/app/(app)/crm/reglages/actions";
import type { Thresholds } from "@/features/crm/situations";
import { initialFormState } from "@/lib/forms";

/** Seuils des vues de La Salle. Chaque changement est journalisé. */
export function ThresholdsForm({ thresholds }: { thresholds: Thresholds }) {
  const [state, action] = useActionState(saveThresholdsAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  const value = (k: keyof Thresholds) => v[k] ?? String(thresholds[k]);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <Field
        name="silenceDays"
        type="number"
        label="À risque après un silence de (jours)"
        defaultValue={value("silenceDays")}
        error={state.fieldErrors?.silenceDays}
      />
      <Field
        name="lowSatisfaction"
        type="number"
        label="À risque si la satisfaction est au plus de (sur 5)"
        defaultValue={value("lowSatisfaction")}
        error={state.fieldErrors?.lowSatisfaction}
      />
      <Field
        name="billingHorizonDays"
        type="number"
        label="Facture à émettre affichée (jours avant)"
        defaultValue={value("billingHorizonDays")}
        error={state.fieldErrors?.billingHorizonDays}
      />
      <Field
        name="paymentTermDays"
        type="number"
        label="Délai de paiement attendu (jours)"
        defaultValue={value("paymentTermDays")}
        error={state.fieldErrors?.paymentTermDays}
      />
      <div>
        <SubmitButton>Appliquer les seuils</SubmitButton>
      </div>
    </form>
  );
}
