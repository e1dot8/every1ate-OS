"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveCashBalanceAction, saveChargeAction } from "@/app/(app)/finance/tresorerie/actions";
import { CHARGE_FREQUENCIES, chargeFrequencyLabels } from "@/features/finance/treasury-rules";

/** Solde bancaire saisi à la main : point de départ de la prévision. */
export function CashBalanceForm({ balance, date }: { balance: string; date: string }) {
  const [state, action] = useActionState(saveCashBalanceAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate aria-label="Solde bancaire">
      <FormMessages state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="balance"
          label="Solde bancaire (€)"
          hint="Tous comptes confondus ; signe moins si découvert."
          defaultValue={v.balance ?? balance}
          error={state.fieldErrors?.balance}
        />
        <Field
          name="balanceDate"
          type="date"
          label="au"
          defaultValue={v.balanceDate ?? date}
          error={state.fieldErrors?.balanceDate}
        />
      </div>
      <div>
        <SubmitButton>Enregistrer le solde</SubmitButton>
      </div>
    </form>
  );
}

export type ChargeValues = {
  id?: string;
  label?: string;
  category?: string;
  amount?: string;
  frequency?: string;
  nextDate?: string;
  endDate?: string;
};

/** Création ou modification d'une charge fixe récurrente. */
export function ChargeForm({ charge }: { charge?: ChargeValues }) {
  const [state, action] = useActionState(saveChargeAction, initialFormState);
  const v: ChargeValues = { ...charge, ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {charge?.id ? <input type="hidden" name="chargeId" value={charge.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="label" label="Libellé" defaultValue={v.label ?? ""} error={state.fieldErrors?.label} />
        <Field
          name="category"
          label="Catégorie (facultatif)"
          required={false}
          hint="Loyer, salaires, abonnements, assurances…"
          defaultValue={v.category ?? ""}
          error={state.fieldErrors?.category}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="amount"
          label="Montant (€)"
          hint="Montant décaissé à chaque échéance."
          defaultValue={v.amount ?? ""}
          error={state.fieldErrors?.amount}
        />
        <SelectField
          name="frequency"
          label="Fréquence"
          defaultValue={v.frequency ?? "MENSUELLE"}
          options={CHARGE_FREQUENCIES.map((f) => ({ value: f, label: chargeFrequencyLabels[f] }))}
          error={state.fieldErrors?.frequency}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="nextDate"
          type="date"
          label="Prochaine échéance"
          defaultValue={v.nextDate ?? ""}
          error={state.fieldErrors?.nextDate}
        />
        <Field
          name="endDate"
          type="date"
          label="Fin (facultatif)"
          required={false}
          hint="Vide = sans fin prévue."
          defaultValue={v.endDate ?? ""}
          error={state.fieldErrors?.endDate}
        />
      </div>
      <div>
        <SubmitButton>{charge?.id ? "Enregistrer la charge" : "Ajouter la charge"}</SubmitButton>
      </div>
    </form>
  );
}
