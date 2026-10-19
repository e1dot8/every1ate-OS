"use client";

import { useActionState, useState } from "react";
import { CheckboxGroup, SelectField, TextareaField } from "@/components/forms/controls";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { recurrenceOptions } from "@/features/projects/recurrence";
import { initialFormState, type FormState } from "@/lib/forms";
import {
  addDependencyAction,
  changeOwnerAction,
  changeProjectStatusAction,
  changeTaskStatusAction,
  saveLotAction,
  saveTaskAction,
  updateProjectAction,
} from "@/app/(app)/projets/actions";
import {
  PHASES,
  impactLabels,
  priorityLabels,
  projectStatusLabels,
  taskStatusLabels,
} from "@/features/projects/labels";

type Opt = { value: string; label: string };
type Action = (prev: FormState, data: FormData) => Promise<FormState>;

function useForm(action: Action) {
  return useActionState(action, initialFormState);
}

function Messages({ state }: { state: FormState }) {
  if (state.status === "error" && state.message) return <FormAlert tone="danger" title={state.message} />;
  if (state.status === "success" && state.message) return <FormAlert tone="success" title={state.message} />;
  return null;
}

export function ProjectForm(props: {
  project: {
    id: string;
    name: string;
    description: string | null;
    clientId: string | null;
    phase: string;
    startDate: string;
    plannedEndDate: string;
  };
  clients: Opt[];
}) {
  const [state, action] = useForm(updateProjectAction);
  const v = { ...props.project, ...state.values };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <input type="hidden" name="projectId" value={props.project.id} />
      <Field name="name" label="Nom du projet" defaultValue={v.name} error={state.fieldErrors?.name} />
      <SelectField
        name="clientId"
        label="Client"
        defaultValue={v.clientId ?? ""}
        options={[{ value: "", label: "Aucun client" }, ...props.clients]}
      />
      <SelectField
        name="phase"
        label="Phase"
        defaultValue={v.phase}
        options={PHASES.map((p, i) => ({ value: p.value, label: `${i + 1}. ${p.label}` }))}
        hint="La phase est indépendante du statut opérationnel."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="startDate"
          type="date"
          label="Date de début"
          required={false}
          defaultValue={v.startDate}
          error={state.fieldErrors?.startDate}
        />
        <Field
          name="plannedEndDate"
          type="date"
          label="Fin prévue"
          required={false}
          defaultValue={v.plannedEndDate}
          error={state.fieldErrors?.plannedEndDate}
        />
      </div>
      <TextareaField name="description" label="Description" defaultValue={v.description ?? ""} />
      <div>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

const ALLOWED: Record<string, string[]> = {
  A_PREPARER: ["ACTIF", "EN_ATTENTE", "BLOQUE"],
  ACTIF: ["EN_ATTENTE", "BLOQUE", "TERMINE"],
  EN_ATTENTE: ["ACTIF", "BLOQUE"],
  BLOQUE: ["ACTIF", "EN_ATTENTE"],
  TERMINE: ["ACTIF", "ARCHIVE"],
  ARCHIVE: ["TERMINE"],
};

export function ProjectStatusForm({ projectId, status }: { projectId: string; status: string }) {
  const [state, action] = useForm(changeProjectStatusAction);
  const options = ALLOWED[status] ?? [];
  const [to, setTo] = useState(options[0] ?? "");
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="status" value={to} />
      <label className="flex flex-col gap-2 text-sm font-bold" htmlFor="champ-status">
        Nouveau statut
        <select
          id="champ-status"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-h-tap rounded-lg border border-input bg-background px-3 text-base font-normal"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {projectStatusLabels[s as keyof typeof projectStatusLabels]}
              {s === "TERMINE" ? " (checklist complète requise)" : ""}
            </option>
          ))}
        </select>
      </label>
      {to === "BLOQUE" || to === "EN_ATTENTE" ? (
        <TextareaField name="reason" label="Raison" error={state.fieldErrors?.reason} rows={2} />
      ) : null}
      <div>
        <SubmitButton variant="outline">Changer le statut</SubmitButton>
      </div>
    </form>
  );
}

export function OwnerForm({
  projectId,
  ownerId,
  associates,
}: {
  projectId: string;
  ownerId: string;
  associates: Opt[];
}) {
  const [state, action] = useForm(changeOwnerAction);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      <SelectField name="ownerId" label="Responsable global" defaultValue={ownerId} options={associates} />
      <TextareaField
        name="reason"
        label="Motif"
        rows={2}
        hint="Obligatoire, visible dans le journal du projet."
        error={state.fieldErrors?.reason}
      />
      <div>
        <SubmitButton variant="outline">Changer le responsable</SubmitButton>
      </div>
    </form>
  );
}

export function LotForm(props: {
  projectId: string;
  lot?: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string | null;
    plannedStart: string;
    plannedEnd: string;
    memberIds: string[];
  };
  associates: Opt[];
}) {
  const [state, action] = useForm(saveLotAction);
  const lot = props.lot;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <input type="hidden" name="projectId" value={props.projectId} />
      {lot ? <input type="hidden" name="lotId" value={lot.id} /> : null}
      <Field
        name="name"
        label="Nom du lot"
        defaultValue={state.values?.name ?? lot?.name}
        error={state.fieldErrors?.name}
      />
      <SelectField
        name="ownerId"
        label="Responsable du lot"
        defaultValue={lot?.ownerId ?? ""}
        options={[{ value: "", label: "À désigner" }, ...props.associates]}
      />
      <CheckboxGroup
        name="memberIds"
        label="Personnes affectées"
        options={props.associates}
        defaultValues={lot?.memberIds}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="plannedStart"
          type="date"
          label="Début prévu"
          required={false}
          defaultValue={lot?.plannedStart}
        />
        <Field
          name="plannedEnd"
          type="date"
          label="Fin prévue"
          required={false}
          defaultValue={lot?.plannedEnd}
          error={state.fieldErrors?.plannedEnd}
        />
      </div>
      <TextareaField name="description" label="Description" defaultValue={lot?.description ?? ""} />
      <div>
        <SubmitButton>{lot ? "Enregistrer" : "Créer le lot"}</SubmitButton>
      </div>
    </form>
  );
}

export function TaskForm(props: {
  projectId: string;
  lots: Opt[];
  associates: Opt[];
  defaultLotId?: string;
  task?: {
    id: string;
    title: string;
    description: string | null;
    workPackageId: string | null;
    ownerId: string | null;
    contributorIds: string[];
    priority: string;
    priorityLocked: boolean;
    impact: string;
    startDate: string;
    dueDate: string;
    estimatedHours: string;
    recurrence: string;
    recurrenceUntil: string;
  };
}) {
  const [state, action] = useForm(saveTaskAction);
  const t = props.task;
  // Après une erreur, les champs sont recréés avec la saisie renvoyée par le serveur :
  // React réinitialise le formulaire après chaque envoi, ce qui effacerait sinon les listes.
  const v = state.status === "error" ? state.values : undefined;
  const [recurrence, setRecurrence] = useState(v?.recurrence ?? t?.recurrence ?? "AUCUNE");
  // Les cases cochées ne tiennent pas dans les valeurs renvoyées (une seule par clé) : suivies ici.
  const [contributors, setContributors] = useState<string[]>(t?.contributorIds ?? []);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <input type="hidden" name="projectId" value={props.projectId} />
      {t ? <input type="hidden" name="taskId" value={t.id} /> : null}
      <div key={v ? JSON.stringify(v) : "initial"} className="flex flex-col gap-4">
        <Field
          name="title"
          label="Titre"
          defaultValue={v?.title ?? t?.title}
          error={state.fieldErrors?.title}
        />
        <SelectField
          name="workPackageId"
          label="Lot"
          defaultValue={v?.workPackageId ?? t?.workPackageId ?? props.defaultLotId ?? ""}
          options={[{ value: "", label: "Aucun lot" }, ...props.lots]}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            name="ownerId"
            label="Responsable"
            defaultValue={v?.ownerId ?? t?.ownerId ?? ""}
            options={[{ value: "", label: "Non assignée" }, ...props.associates]}
          />
          <SelectField
            name="impact"
            label="Impact"
            defaultValue={v?.impact ?? t?.impact ?? "MOYEN"}
            options={Object.entries(impactLabels).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <SelectField
          name="priority"
          label="Priorité"
          hint="Automatique : calculée selon l'impact, l'échéance, le retard et les tâches bloquées. Une valeur choisie est verrouillée."
          defaultValue={v?.priority ?? (t ? (t.priorityLocked ? t.priority : "AUTO") : "AUTO")}
          options={[
            { value: "AUTO", label: "Automatique (suggérée)" },
            ...Object.entries(priorityLabels).map(([value, label]) => ({
              value,
              label: `${label} (verrouillée)`,
            })),
          ]}
        />
        <div
          onChange={(e) => {
            if ((e.target as HTMLInputElement).name !== "contributorIds") return;
            setContributors(
              Array.from(
                e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="contributorIds"]:checked'),
                (box) => box.value,
              ),
            );
          }}
        >
          <CheckboxGroup
            name="contributorIds"
            label="Contributeurs"
            options={props.associates}
            defaultValues={contributors}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            name="startDate"
            type="date"
            label="Début"
            required={false}
            defaultValue={v?.startDate ?? t?.startDate}
            error={state.fieldErrors?.startDate}
          />
          <Field
            name="dueDate"
            type="date"
            label="Échéance"
            required={false}
            defaultValue={v?.dueDate ?? t?.dueDate}
            error={state.fieldErrors?.dueDate}
          />
          <Field
            name="estimatedHours"
            label="Durée estimée (h)"
            required={false}
            defaultValue={v?.estimatedHours ?? t?.estimatedHours}
            error={state.fieldErrors?.estimatedHours}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="champ-recurrence">Répétition</Label>
            <Select
              id="champ-recurrence"
              name="recurrence"
              defaultValue={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              aria-invalid={state.fieldErrors?.recurrence ? true : undefined}
              aria-describedby={
                state.fieldErrors?.recurrence ? "champ-recurrence-erreur" : "champ-recurrence-aide"
              }
            >
              {recurrenceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {state.fieldErrors?.recurrence ? (
              <p id="champ-recurrence-erreur" className="text-sm text-danger">
                {state.fieldErrors.recurrence}
              </p>
            ) : (
              <p id="champ-recurrence-aide" className="text-sm text-muted-foreground">
                Quand la tâche passe à « Terminé », la suivante est créée avec l&apos;échéance décalée.
              </p>
            )}
          </div>
          {recurrence !== "AUCUNE" ? (
            <Field
              name="recurrenceUntil"
              type="date"
              label="Jusqu'au"
              required={false}
              hint="Facultatif : sans date, la tâche se répète sans fin."
              defaultValue={v?.recurrenceUntil ?? t?.recurrenceUntil}
              error={state.fieldErrors?.recurrenceUntil}
            />
          ) : null}
        </div>
        <TextareaField
          name="description"
          label="Description"
          defaultValue={v?.description ?? t?.description ?? ""}
        />
      </div>
      <div>
        <SubmitButton>{t ? "Enregistrer" : "Créer la tâche"}</SubmitButton>
      </div>
    </form>
  );
}

export function TaskStatusForm({ taskId, status }: { taskId: string; status: string }) {
  const [state, action] = useForm(changeTaskStatusAction);
  const [to, setTo] = useState(status);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      {/* Le statut choisi est transmis par ce champ : React réinitialise les radios après chaque envoi. */}
      <input type="hidden" name="status" value={to} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Statut</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(taskStatusLabels).map(([value, label]) => (
            <label
              key={value}
              className="has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper flex min-h-tap cursor-pointer items-center rounded-full border border-input px-3 text-[13px] font-bold"
            >
              <input
                type="radio"
                name="statusChoice"
                value={value}
                checked={to === value}
                onChange={() => setTo(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {to === "BLOQUE" ? (
        <>
          <TextareaField name="reason" label="Raison du blocage" rows={2} error={state.fieldErrors?.reason} />
          <Field name="nextAction" label="Prochaine action (facultatif)" required={false} />
          <Field name="reviewDate" type="date" label="Date de réexamen (facultatif)" required={false} />
        </>
      ) : null}
      {to === "ANNULE" ? (
        <TextareaField name="reason" label="Pourquoi annuler ?" rows={2} error={state.fieldErrors?.reason} />
      ) : null}
      <div>
        <SubmitButton variant={to === "BLOQUE" ? "destructive" : "default"}>
          {to === "BLOQUE" ? "Bloquer la tâche" : "Mettre à jour"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DependencyForm({ taskId, candidates }: { taskId: string; candidates: Opt[] }) {
  const [state, action] = useForm(addDependencyAction);
  if (!candidates.length)
    return <p className="text-sm text-muted-foreground">Aucune autre tâche dans ce projet.</p>;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      <SelectField
        name="dependsOnId"
        label="Cette tâche attend"
        options={[{ value: "", label: "Choisir une tâche…" }, ...candidates]}
        error={state.fieldErrors?.dependsOnId}
      />
      <div>
        <SubmitButton variant="outline">Ajouter la dépendance</SubmitButton>
      </div>
    </form>
  );
}
