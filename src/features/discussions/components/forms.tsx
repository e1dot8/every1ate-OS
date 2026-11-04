"use client";

import { useActionState, useState } from "react";
import { CheckboxGroup, SelectField, TextareaField } from "@/components/forms/controls";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  addMemberAction,
  convertToTaskAction,
  createChannelAction,
  updateChannelAction,
} from "@/app/(app)/discussions/actions";
import { initialFormState } from "@/lib/forms";

type Opt = { value: string; label: string };

/** Nouveau salon : public (tous les associés) ou privé (membres choisis). */
export function NewChannelForm({ associates }: { associates: Opt[] }) {
  const [state, action] = useActionState(createChannelAction, initialFormState);
  const v = state.values ?? {};
  const [isPrivate, setPrivate] = useState(v.isPrivate === "on");
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <Field name="name" label="Nom du salon" defaultValue={v.name} error={state.fieldErrors?.name} />
      <TextareaField
        name="topic"
        label="Sujet (facultatif)"
        rows={2}
        defaultValue={v.topic}
        error={state.fieldErrors?.topic}
      />
      <label className="flex min-h-tap w-fit items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          name="isPrivate"
          checked={isPrivate}
          onChange={(e) => setPrivate(e.target.checked)}
          className="size-5 accent-[var(--ink)]"
        />
        Salon privé
      </label>
      {isPrivate ? (
        associates.length ? (
          <CheckboxGroup name="memberIds" label="Membres (en plus de toi)" options={associates} />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun autre associé pour l&apos;instant.</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Un salon public est visible par tous les associés.</p>
      )}
      <div>
        <SubmitButton pendingLabel="Création…">Créer le salon</SubmitButton>
      </div>
    </form>
  );
}

/** Réglages : nom (salons créés à la main), sujet, lien visio https. */
export function ChannelSettingsForm({
  channel,
  renamable,
}: {
  channel: { id: string; name: string; topic: string | null; meetUrl: string | null };
  renamable: boolean;
}) {
  const [state, action] = useActionState(updateChannelAction, initialFormState);
  const v = { name: channel.name, topic: channel.topic ?? "", meetUrl: channel.meetUrl ?? "", ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="channelId" value={channel.id} />
      {renamable ? (
        <Field name="name" label="Nom du salon" defaultValue={v.name} error={state.fieldErrors?.name} />
      ) : null}
      <TextareaField name="topic" label="Sujet" rows={2} defaultValue={v.topic} error={state.fieldErrors?.topic} />
      <Field
        name="meetUrl"
        type="url"
        label="Lien visio (Meet, Jitsi…)"
        required={false}
        defaultValue={v.meetUrl}
        hint="Adresse en https://, partagée par /huddle."
        error={state.fieldErrors?.meetUrl}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

/** Ajout d'un membre à un salon privé. */
export function AddMemberForm({ channelId, candidates }: { channelId: string; candidates: Opt[] }) {
  const [state, action] = useActionState(addMemberAction, initialFormState);
  if (!candidates.length) return null;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="channelId" value={channelId} />
      <SelectField name="userId" label="Ajouter un membre" options={candidates} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Ajout…">
          Ajouter au salon
        </SubmitButton>
      </div>
    </form>
  );
}

/** « Transformer en tâche » : formulaire prérempli à partir du message. */
export function ConvertToTaskForm({
  messageId,
  defaults,
  projects,
  associates,
}: {
  messageId: string;
  defaults: { title: string; projectId: string; ownerId: string };
  projects: Opt[];
  associates: Opt[];
}) {
  const [state, action] = useActionState(convertToTaskAction, initialFormState);
  const v = { ...defaults, dueDate: "", ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="messageId" value={messageId} />
      <Field name="title" label="Titre de la tâche" defaultValue={v.title} error={state.fieldErrors?.title} />
      <SelectField
        name="projectId"
        label="Projet"
        defaultValue={v.projectId}
        options={[{ value: "", label: "Choisir un projet…" }, ...projects]}
        error={state.fieldErrors?.projectId}
      />
      <SelectField
        name="ownerId"
        label="Responsable"
        defaultValue={v.ownerId}
        options={[{ value: "", label: "Personne pour l'instant" }, ...associates]}
      />
      <Field
        name="dueDate"
        type="date"
        label="Échéance"
        required={false}
        defaultValue={v.dueDate}
        error={state.fieldErrors?.dueDate}
      />
      <div>
        <SubmitButton pendingLabel="Création…">Créer la tâche</SubmitButton>
      </div>
    </form>
  );
}
