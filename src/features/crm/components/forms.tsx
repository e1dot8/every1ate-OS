"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField, TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/lib/forms";
import {
  addActivityAction,
  changeStageAction,
  saveClientAction,
  saveContactAction,
  saveOpportunityAction,
  saveSettingsAction,
  setNextActionAction,
} from "@/app/(app)/crm/actions";
import { STAGES, activityLabels, sourceLabels, stageLabels, type Stage } from "@/features/crm/rules";

type Opt = { value: string; label: string };

export function ClientForm({
  client,
}: {
  client?: {
    id: string;
    name: string;
    website: string | null;
    sector: string | null;
    address: string | null;
    notes: string | null;
  };
}) {
  const [state, action] = useActionState(saveClientAction, initialFormState);
  const v = { ...client, ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
      <Field name="name" label="Entreprise" defaultValue={v.name ?? ""} error={state.fieldErrors?.name} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="sector" label="Secteur" required={false} defaultValue={v.sector ?? ""} />
        <Field
          name="website"
          label="Site web"
          required={false}
          defaultValue={v.website ?? ""}
          error={state.fieldErrors?.website}
        />
      </div>
      <Field name="address" label="Adresse professionnelle" required={false} defaultValue={v.address ?? ""} />
      <TextareaField name="notes" label="Notes" defaultValue={v.notes ?? ""} />
      <div>
        <SubmitButton>{client ? "Enregistrer" : "Créer l'entreprise"}</SubmitButton>
      </div>
    </form>
  );
}

export function ContactForm({
  clientId,
  contact,
}: {
  clientId: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}) {
  const [state, action] = useActionState(saveContactAction, initialFormState);
  const v = { ...contact, ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="clientId" value={clientId} />
      {contact ? <input type="hidden" name="contactId" value={contact.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="firstName"
          label="Prénom"
          defaultValue={v.firstName ?? ""}
          error={state.fieldErrors?.firstName}
        />
        <Field
          name="lastName"
          label="Nom"
          defaultValue={v.lastName ?? ""}
          error={state.fieldErrors?.lastName}
        />
      </div>
      <Field name="role" label="Fonction" required={false} defaultValue={v.role ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="email"
          type="email"
          label="E-mail professionnel"
          required={false}
          defaultValue={v.email ?? ""}
          error={state.fieldErrors?.email}
        />
        <Field
          name="phone"
          type="tel"
          label="Téléphone professionnel"
          required={false}
          defaultValue={v.phone ?? ""}
        />
      </div>
      <TextareaField name="notes" label="Notes" defaultValue={v.notes ?? ""} />
      <div>
        <SubmitButton>{contact ? "Enregistrer" : "Ajouter le contact"}</SubmitButton>
      </div>
    </form>
  );
}

export function OpportunityForm(props: {
  clients: (Opt & { contacts: Opt[] })[];
  associates: Opt[];
  currentUserId: string;
  defaultClientId?: string;
  settings: Record<Stage, number>;
  opportunity?: {
    id: string;
    title: string;
    clientId: string;
    contactId: string | null;
    ownerId: string;
    source: string | null;
    amount: string;
    probability: string;
    expectedCloseDate: string;
    nextAction: string;
    nextActionDate: string;
    stage: Stage;
  };
}) {
  const [state, action] = useActionState(saveOpportunityAction, initialFormState);
  const o = props.opportunity;
  const v = { ...o, ...state.values } as Record<string, string | undefined>;
  const [clientId, setClientId] = useState(v.clientId ?? props.defaultClientId ?? "");
  const contacts = props.clients.find((c) => c.value === clientId)?.contacts ?? [];
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {o ? <input type="hidden" name="opportunityId" value={o.id} /> : null}
      <Field name="title" label="Intitulé" defaultValue={v.title ?? ""} error={state.fieldErrors?.title} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="champ-clientId">Entreprise</Label>
          <Select
            id="champ-clientId"
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-invalid={state.fieldErrors?.clientId ? true : undefined}
          >
            <option value="">Choisir…</option>
            {props.clients.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          {state.fieldErrors?.clientId ? (
            <p className="text-sm text-danger">{state.fieldErrors.clientId}</p>
          ) : null}
        </div>
        <SelectField
          key={clientId}
          name="contactId"
          label="Contact"
          defaultValue={v.contactId ?? ""}
          options={[
            { value: "", label: contacts.length ? "Aucun" : "Aucun contact enregistré" },
            ...contacts,
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          name="ownerId"
          label="Responsable commercial"
          defaultValue={v.ownerId ?? props.currentUserId}
          options={props.associates}
        />
        <SelectField
          name="source"
          label="Source"
          defaultValue={v.source ?? ""}
          options={[
            { value: "", label: "Non renseignée" },
            ...Object.entries(sourceLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          name="amount"
          label="Montant estimé HT (€)"
          required={false}
          defaultValue={v.amount}
          error={state.fieldErrors?.amount}
        />
        <Field
          name="probability"
          label="Probabilité (%)"
          required={false}
          hint={
            o
              ? `Vide = ${props.settings[o.stage]} % (étape ${stageLabels[o.stage]})`
              : "Vide = probabilité de l'étape"
          }
          defaultValue={v.probability}
          error={state.fieldErrors?.probability}
        />
        <Field
          name="expectedCloseDate"
          type="date"
          label="Clôture estimée"
          required={false}
          defaultValue={v.expectedCloseDate}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Field name="nextAction" label="Prochaine action" required={false} defaultValue={v.nextAction} />
        <Field
          name="nextActionDate"
          type="date"
          label="Date de relance"
          required={false}
          defaultValue={v.nextActionDate}
        />
      </div>
      <div>
        <SubmitButton>{o ? "Enregistrer" : "Créer l'opportunité"}</SubmitButton>
      </div>
    </form>
  );
}

export function StageForm({ opportunityId, stage }: { opportunityId: string; stage: Stage }) {
  const [state, action] = useActionState(changeStageAction, initialFormState);
  const [to, setTo] = useState<Stage>((state.values?.stage as Stage) ?? stage);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="stage" value={to} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="etape">Étape</Label>
        <Select id="etape" value={to} onChange={(e) => setTo(e.target.value as Stage)}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabels[s]}
            </option>
          ))}
        </Select>
      </div>
      {to === "PERDU" ? (
        <TextareaField
          name="lossReason"
          label="Motif de perte (facultatif)"
          defaultValue={state.values?.lossReason ?? ""}
        />
      ) : null}
      <Field name="note" label="Note (facultatif)" required={false} defaultValue={state.values?.note} />
      <div>
        <SubmitButton>Changer l&apos;étape</SubmitButton>
      </div>
    </form>
  );
}

export function NextActionForm({
  opportunityId,
  nextAction,
  nextActionDate,
}: {
  opportunityId: string;
  nextAction: string;
  nextActionDate: string;
}) {
  const [state, action] = useActionState(setNextActionAction, initialFormState);
  const v = { nextAction, nextActionDate, ...state.values };
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Field name="nextAction" label="Prochaine action" required={false} defaultValue={v.nextAction} />
      <Field
        name="nextActionDate"
        type="date"
        label="Date de relance"
        required={false}
        defaultValue={v.nextActionDate}
        error={state.fieldErrors?.nextActionDate}
      />
      <div>
        <SubmitButton variant="outline">Enregistrer la relance</SubmitButton>
      </div>
    </form>
  );
}

export function ActivityForm({ opportunityId, today }: { opportunityId: string; today: string }) {
  const [state, action] = useActionState(addActivityAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="kind"
          label="Type"
          defaultValue={v.kind ?? "ECHANGE"}
          options={Object.entries(activityLabels)
            .filter(([k]) => k !== "ETAPE")
            .map(([value, label]) => ({ value, label }))}
        />
        <Field name="occurredAt" type="date" label="Date" defaultValue={v.occurredAt ?? today} />
      </div>
      <TextareaField
        name="body"
        label="Compte rendu"
        defaultValue={v.body ?? ""}
        error={state.fieldErrors?.body}
      />
      <Field
        name="fileUrl"
        label="Lien vers la proposition (facultatif)"
        required={false}
        hint="Lien Google Drive ou autre ; le fichier n'est pas copié."
        defaultValue={v.fileUrl}
        error={state.fieldErrors?.fileUrl}
      />
      <div>
        <SubmitButton>Ajouter à l&apos;historique</SubmitButton>
      </div>
    </form>
  );
}

export function SettingsForm({ settings }: { settings: Record<Stage, number> }) {
  const [state, action] = useActionState(saveSettingsAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      {STAGES.map((s) => (
        <div key={s} className="flex items-center gap-3">
          <Label htmlFor={`proba-${s}`} className="flex-1">
            {stageLabels[s]}
          </Label>
          <input
            id={`proba-${s}`}
            name={s}
            type="number"
            min={0}
            max={100}
            disabled={s === "GAGNE" || s === "PERDU"}
            defaultValue={state.values?.[s] ?? settings[s]}
            className="min-h-tap w-24 rounded-lg border border-input bg-background px-3 text-right"
          />
          <span aria-hidden="true">%</span>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">« Gagné » vaut toujours 100 % et « Perdu » 0 %.</p>
      <div>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
