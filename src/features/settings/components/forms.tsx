"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveAgencyAction, saveAssociateAction, saveDigestAction } from "@/app/(app)/plus/reglages/actions";

const euros = (cents: number | null) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(",00", "");

export function AgencyForm({
  defaultHourlyCostCents,
  defaultWeeklyHours,
}: {
  defaultHourlyCostCents: number | null;
  defaultWeeklyHours: number;
}) {
  const [state, action] = useActionState(saveAgencyAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="defaultHourlyCost"
          label="Coût horaire interne par défaut (€/h)"
          required={false}
          hint="Ce que coûte une heure de travail à l'agence (pas le prix de vente). Vide = temps non valorisé."
          defaultValue={state.values?.defaultHourlyCost ?? euros(defaultHourlyCostCents)}
          error={state.fieldErrors?.defaultHourlyCost}
        />
        <Field
          name="defaultWeeklyHours"
          type="number"
          label="Capacité par défaut (h/semaine)"
          defaultValue={state.values?.defaultWeeklyHours ?? String(defaultWeeklyHours)}
          error={state.fieldErrors?.defaultWeeklyHours}
        />
      </div>
      <div>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function AssociateRow({
  user,
}: {
  user: { id: string; name: string; hourlyCostCents: number | null; weeklyCapacityHours: number | null };
}) {
  const [state, action] = useActionState(saveAssociateAction, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-b py-3 last:border-b-0"
      noValidate
      aria-label={`Réglages de ${user.name}`}
    >
      <input type="hidden" name="userId" value={user.id} />
      <b>{user.name}</b>
      <FormMessages state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="hourlyCost"
          label="Coût horaire (€/h)"
          required={false}
          hint="Vide = taux de l'agence"
          defaultValue={state.values?.hourlyCost ?? euros(user.hourlyCostCents)}
          error={state.fieldErrors?.hourlyCost}
        />
        <Field
          name="weeklyHours"
          type="number"
          label="Capacité (h/sem.)"
          required={false}
          hint="Vide = capacité de l'agence"
          defaultValue={state.values?.weeklyHours ?? user.weeklyCapacityHours?.toString() ?? ""}
          error={state.fieldErrors?.weeklyHours}
        />
      </div>
      <div>
        <SubmitButton variant="outline">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function DigestForm({ frequency }: { frequency: string }) {
  const [state, action] = useActionState(saveDigestAction, initialFormState);
  const current = state.values?.frequency ?? frequency;
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-bold">Recevoir mon brief par e-mail</legend>
        {[
          ["AUCUN", "Non (par défaut)"],
          ["QUOTIDIEN", "Chaque matin du lundi au vendredi, vers 7 h 30"],
          ["HEBDOMADAIRE", "Le lundi matin seulement"],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-tap items-center gap-2">
            <input
              type="radio"
              name="frequency"
              value={value}
              defaultChecked={current === value}
              className="size-5 accent-ink"
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Envoyé seulement s&apos;il y a quelque chose à signaler.
      </p>
      <div>
        <SubmitButton variant="outline">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
