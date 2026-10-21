"use client";

import { useActionState } from "react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { savePreferencesAction } from "./actions";

type Prefs = { celebrations: boolean; streakEnabled: boolean; streakDays: number; badgesPublic: boolean };

const row = "flex min-h-tap items-start gap-3 text-sm";

export function PreferencesForm({ prefs }: { prefs: Prefs }) {
  const [state, action] = useActionState(savePreferencesAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} />
      <label className={row}>
        <input
          type="checkbox"
          name="celebrations"
          defaultChecked={prefs.celebrations}
          className="mt-0.5 size-5 accent-[var(--ink)]"
        />
        <span>
          <b>Animations de célébration</b>
          <br />
          <span className="text-muted-foreground">Sinon, un simple message sans animation.</span>
        </span>
      </label>
      <label className={row}>
        <input
          type="checkbox"
          name="badgesPublic"
          defaultChecked={prefs.badgesPublic}
          className="mt-0.5 size-5 accent-[var(--ink)]"
        />
        <span>
          <b>Partager mes nouveaux badges avec la brigade</b>
          <br />
          <span className="text-muted-foreground">
            Chaque badge reste masquable ensuite dans Ma progression.
          </span>
        </span>
      </label>
      <label className={row}>
        <input
          type="checkbox"
          name="streakEnabled"
          defaultChecked={prefs.streakEnabled}
          className="mt-0.5 size-5 accent-[var(--ink)]"
        />
        <span>
          <b>Afficher ma série de régularité</b>
          <br />
          <span className="text-muted-foreground">
            Par semaine : les week-ends et les semaines en pause ne cassent rien.
          </span>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Jours actifs pour qu&apos;une semaine compte
        <select
          name="streakDays"
          defaultValue={String(prefs.streakDays)}
          className="min-h-tap max-w-40 rounded-lg border border-input bg-background px-3 font-normal"
        >
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} jours
            </option>
          ))}
        </select>
      </label>
      <div>
        <SubmitButton>Enregistrer mes préférences</SubmitButton>
      </div>
    </form>
  );
}
