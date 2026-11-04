"use client";

import { useActionState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { EVENT_KINDS, eventLabels } from "@/features/events/kinds";
import { prefField, type NotifyPrefs } from "@/features/notifications/prefs";
import { initialFormState } from "@/lib/forms";
import { removeWhatsappAction, savePrefsAction, saveWhatsappAction, sendTestAction } from "./actions";

/** « Envoyer un test » sur un canal (push : tous mes appareils ; WhatsApp : mon numéro). */
export function TestSendForm({ channel }: { channel: "push" | "whatsapp" }) {
  const [state, action] = useActionState(sendTestAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="channel" value={channel} />
      <FormMessages state={state} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Envoi du test…">
          <Send aria-hidden="true" /> Envoyer un test
        </SubmitButton>
      </div>
    </form>
  );
}

export function WhatsappForm({ phone, hasKey }: { phone: string | null; hasKey: boolean }) {
  const [state, action] = useActionState(saveWhatsappAction, initialFormState);
  return (
    <form
      action={action}
      className="flex max-w-xl flex-col gap-3"
      noValidate
      aria-label="Numéro et clé WhatsApp"
    >
      <FormMessages state={state} />
      <Field
        name="phone"
        type="tel"
        label="Numéro WhatsApp"
        autoComplete="tel"
        hint="Format international, ex. +33 6 12 34 56 78."
        defaultValue={state.values?.phone ?? phone ?? ""}
        error={state.fieldErrors?.phone}
      />
      <Field
        name="apikey"
        type="password"
        label="Clé API CallMeBot"
        autoComplete="off"
        required={!hasKey}
        hint={
          hasKey
            ? "Une clé est déjà enregistrée : laissez vide pour la conserver."
            : "Reçue sur WhatsApp à l'étape 3."
        }
        error={state.fieldErrors?.apikey}
      />
      {hasKey ? (
        <p role="status" className="text-sm font-bold text-success">
          Clé enregistrée ✓
        </p>
      ) : null}
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

/** Toujours monté : la confirmation reste affichée une fois le numéro supprimé. */
export function RemoveWhatsappForm({ configured }: { configured: boolean }) {
  const [state, action] = useActionState(removeWhatsappAction, initialFormState);
  if (!configured && state.status === "idle") return null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessages state={state} />
      {configured ? (
        <div>
          <SubmitButton variant="ghost" pendingLabel="Suppression…">
            <Trash2 aria-hidden="true" /> Supprimer
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function ChannelBox({
  name,
  label,
  checked,
  disabled,
}: {
  name?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex size-tap cursor-pointer items-center justify-center rounded-md hover:bg-muted has-disabled:cursor-not-allowed">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={disabled}
        aria-label={label}
        className="size-5 accent-ink"
      />
    </label>
  );
}

/** Tableau « Que recevoir ? » : une ligne par type d'événement, une colonne par canal. */
export function PrefsForm({
  prefs,
  pushReady,
  whatsappReady,
}: {
  prefs: NotifyPrefs;
  pushReady: boolean;
  whatsappReady: boolean;
}) {
  const [state, action, pending] = useActionState(savePrefsAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" aria-label="Que recevoir ?">
      <FormMessages state={state} />
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Canaux d&apos;alerte par type d&apos;événement</caption>
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-2 text-left font-bold">
                Événement
              </th>
              <th scope="col" className="w-14 px-0.5 text-center font-bold">
                Dans l&apos;app
              </th>
              <th scope="col" className="w-14 px-0.5 text-center font-bold">
                Push
              </th>
              <th scope="col" className="w-16 px-0.5 text-center font-bold">
                WhatsApp
              </th>
            </tr>
          </thead>
          {/* Clé : après « Rétablir », les cases reprennent les valeurs enregistrées. */}
          <tbody key={JSON.stringify(prefs)}>
            {EVENT_KINDS.map((kind) => (
              <tr key={kind} className="border-b last:border-b-0 hover:bg-muted/60">
                <th scope="row" className="py-1 pr-2 text-left font-normal break-words">
                  {eventLabels[kind]}
                </th>
                <td className="text-center">
                  <ChannelBox label={`Dans l'app (toujours) : ${eventLabels[kind]}`} checked disabled />
                </td>
                <td className="text-center">
                  <ChannelBox
                    name={prefField("push", kind)}
                    label={`Push : ${eventLabels[kind]}`}
                    checked={prefs[kind].push}
                  />
                </td>
                <td className="text-center">
                  <ChannelBox
                    name={prefField("whatsapp", kind)}
                    label={`WhatsApp : ${eventLabels[kind]}`}
                    checked={prefs[kind].whatsapp}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!pushReady || !whatsappReady ? (
        <p className="text-xs text-muted-foreground">
          {!pushReady ? "Aucun appareil n'est encore activé pour le push. " : ""}
          {!whatsappReady ? "WhatsApp n'est pas encore configuré. " : ""}
          Vos choix s&apos;appliqueront dès que le canal sera prêt.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="save" disabled={pending} aria-disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="reset"
          variant="outline"
          disabled={pending}
          aria-disabled={pending}
        >
          Rétablir les réglages recommandés
        </Button>
      </div>
    </form>
  );
}
