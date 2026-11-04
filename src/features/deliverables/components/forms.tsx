"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/forms";
import { CHANNEL_SUGGESTIONS, FORMATS, formatEmojis, formatLabels } from "@/features/deliverables/rules";
import {
  blockDeliverableAction,
  createDeliverableAction,
  saveNotesAction,
  updateDeliverableAction,
} from "@/app/(app)/livrables/actions";

type Opt = { value: string; label: string };

export type DeliverableFormValues = {
  projectId: string;
  workPackageId: string;
  title: string;
  format: string;
  channel: string;
  ownerId: string;
  dueDate: string;
  publishDate: string;
  link: string;
  notes: string;
};

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-erreur`} className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** Création ou modification d'un livrable. Les lots proposés suivent le projet choisi. */
export function DeliverableForm({
  deliverableId,
  initial,
  projects,
  lots,
  associates,
}: {
  deliverableId?: string;
  initial: DeliverableFormValues;
  projects: Opt[];
  lots: { id: string; name: string; projectId: string }[];
  associates: Opt[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    deliverableId ? updateDeliverableAction : createDeliverableAction,
    initialFormState,
  );
  const v = { ...initial, ...state.values } as DeliverableFormValues;
  const errors = state.fieldErrors ?? {};
  const [projectId, setProjectId] = useState(v.projectId);
  const projectLots = lots.filter((l) => l.projectId === projectId);
  const described = (name: string) => (errors[name] ? `champ-${name}-erreur` : undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {deliverableId ? <input type="hidden" name="deliverableId" value={deliverableId} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-projectId">Projet</Label>
        <Select
          id="champ-projectId"
          name="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          aria-invalid={errors.projectId ? true : undefined}
          aria-describedby={described("projectId")}
        >
          <option value="">Choisir un projet…</option>
          {projects.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <ErrorText id="champ-projectId" error={errors.projectId} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-workPackageId">Lot (facultatif)</Label>
        <Select
          // Remonté quand le projet change : le lot choisi appartient toujours au projet.
          key={projectId}
          id="champ-workPackageId"
          name="workPackageId"
          defaultValue={projectLots.some((l) => l.id === v.workPackageId) ? v.workPackageId : ""}
          disabled={!projectLots.length}
          aria-describedby="champ-workPackageId-aide"
        >
          <option value="">Aucun lot</option>
          {projectLots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <p id="champ-workPackageId-aide" className="text-sm text-muted-foreground">
          {projectId
            ? projectLots.length
              ? "Lots du projet choisi."
              : "Ce projet n'a pas de lot."
            : "Choisissez d'abord un projet."}
        </p>
      </div>
      <Field name="title" label="Titre" defaultValue={v.title} error={errors.title} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="champ-format">Format</Label>
          <Select id="champ-format" name="format" defaultValue={v.format || "VIDEO"}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatEmojis[f]} {formatLabels[f]}
              </option>
            ))}
          </Select>
          {deliverableId ? (
            <p className="text-sm text-muted-foreground">Changer le format ne modifie pas la checklist.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              La checklist type du format est créée avec le livrable.
            </p>
          )}
          <ErrorText id="champ-format" error={errors.format} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="champ-channel">Canal</Label>
          <Input
            id="champ-channel"
            name="channel"
            list="canaux-livrable"
            defaultValue={v.channel}
            maxLength={80}
            placeholder="Instagram, YouTube, site…"
            aria-invalid={errors.channel ? true : undefined}
            aria-describedby={described("channel")}
          />
          <datalist id="canaux-livrable">
            {CHANNEL_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <ErrorText id="champ-channel" error={errors.channel} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-ownerId">Responsable</Label>
        <Select id="champ-ownerId" name="ownerId" defaultValue={v.ownerId}>
          <option value="">Personne pour l&apos;instant</option>
          {associates.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="dueDate"
          type="date"
          label="Échéance (livraison au client)"
          required={false}
          defaultValue={v.dueDate}
          error={errors.dueDate}
        />
        <Field
          name="publishDate"
          type="date"
          label="Date de publication"
          required={false}
          defaultValue={v.publishDate}
          error={errors.publishDate}
        />
      </div>
      <Field
        name="link"
        type="url"
        label="Lien vers les fichiers"
        required={false}
        defaultValue={v.link}
        hint="Drive, Frame.io, WeTransfer… (https://)"
        error={errors.link}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-notes">Notes</Label>
        <Textarea id="champ-notes" name="notes" rows={4} defaultValue={v.notes} maxLength={10000} />
      </div>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {deliverableId ? "Enregistrer" : "Créer le livrable"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Bloquer avec un motif (3 caractères minimum) : l'équipe est prévenue en urgent. */
export function BlockForm({ deliverableId }: { deliverableId: string }) {
  const [state, action] = useActionState<FormState, FormData>(blockDeliverableAction, initialFormState);
  const error = state.fieldErrors?.reason;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state.status === "error" && error ? { status: "idle" } : state} />
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="champ-reason">Motif du blocage</Label>
        <Textarea
          id="champ-reason"
          name="reason"
          rows={2}
          maxLength={500}
          defaultValue={state.status === "error" ? state.values?.reason : ""}
          placeholder="Ex. : en attente des rushes du client"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "champ-reason-erreur" : "champ-reason-aide"}
        />
        {error ? (
          <p id="champ-reason-erreur" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p id="champ-reason-aide" className="text-sm text-muted-foreground">
            L&apos;équipe est prévenue tout de suite, même en focus.
          </p>
        )}
      </div>
      <div>
        <SubmitButton variant="outline">Bloquer le livrable</SubmitButton>
      </div>
    </form>
  );
}

export function NotesForm({ deliverableId, notes }: { deliverableId: string; notes: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveNotesAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessages state={state} />
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <Textarea
        name="notes"
        rows={4}
        maxLength={10000}
        aria-label="Notes du livrable"
        placeholder="Contraintes, contacts, versions, remarques du client…"
        defaultValue={state.values?.notes ?? notes}
      />
      <div>
        <SubmitButton variant="outline" pendingLabel="Enregistrement…">
          Enregistrer les notes
        </SubmitButton>
      </div>
    </form>
  );
}
