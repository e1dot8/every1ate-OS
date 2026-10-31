"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { createTasksFromNoteAction } from "@/app/(app)/notes/actions";
import type { ActionsFormState } from "@/features/notes/rules";
import { SyntaxHelp } from "@/features/notes/components/syntax-help";

type Opt = { value: string; label: string };

export type ProposedAction = {
  line: number;
  raw: string;
  title: string;
  ownerId: string | null;
  /** AAAA-MM-JJ ou "" */
  dueDate: string;
};

const initialState: ActionsFormState = { status: "idle" };

/** Empreinte des lignes proposées : les valeurs saisies ne sont réutilisées que pour les mêmes lignes. */
const signature = (actions: ProposedAction[]) => actions.map((a) => `${a.line}:${a.raw}`).join("\n");

/**
 * « Actions détectées » : une ligne par action (cochée par défaut), titre, responsable et échéance
 * modifiables ; projet à choisir seulement si le compte rendu n'est pas rattaché à un projet en cours.
 */
export function ActionsForm({
  noteId,
  actions,
  associates,
  projects,
  alreadyCreated,
}: {
  noteId: string;
  actions: ProposedAction[];
  associates: Opt[];
  /** null : le projet du compte rendu reçoit les tâches. */
  projects: Opt[] | null;
  alreadyCreated: number;
}) {
  const [state, action] = useActionState(createTasksFromNoteAction, initialState);
  const sig = signature(actions);
  // Après une erreur, on réaffiche la saisie (le formulaire est réinitialisé après chaque envoi).
  const kept = state.status === "error" && state.values?.sig === sig ? state.values : undefined;
  const value = (i: number, field: string, fallback: string) => kept?.[`a${i}_${field}`] ?? fallback;
  return (
    <div className="flex flex-col gap-4">
      <FormMessages state={state} />
      {state.status === "success" && state.created?.length ? (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Tâches qui viennent d'être créées">
          {state.created.map((t) => (
            <li key={t.id}>
              <Link href={`/taches/${t.id}`} className="font-bold underline">
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {actions.length ? (
        <form key={sig} action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="count" value={actions.length} />
          <input type="hidden" name="sig" value={sig} />
          {projects && !projects.length ? (
            <p className="text-sm text-danger">
              Aucun projet en cours ne peut recevoir ces tâches. Créez ou réactivez un projet d&apos;abord.
            </p>
          ) : null}
          {actions.map((a, i) => (
            <fieldset key={`${a.line}:${a.raw}`} className="flex min-w-0 flex-col gap-3 border-b pb-4">
              <legend className="mb-2 text-sm font-bold">
                Action {i + 1} · ligne {a.line}
              </legend>
              <input type="hidden" name={`a${i}_line`} value={a.line} />
              <input type="hidden" name={`a${i}_raw`} value={a.raw} />
              <p className="text-[13px] break-words text-muted-foreground">« {a.raw} »</p>
              <label className="flex min-h-tap items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  name={`a${i}_selected`}
                  defaultChecked={kept ? kept[`a${i}_selected`] === "on" : true}
                  className="size-5 shrink-0 accent-[var(--ink)]"
                />
                Créer cette tâche
              </label>
              <Field
                name={`a${i}_title`}
                label="Titre"
                defaultValue={value(i, "title", a.title)}
                error={state.fieldErrors?.[`a${i}_title`]}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SelectField
                  name={`a${i}_ownerId`}
                  label="Responsable"
                  options={[{ value: "", label: "Non assigné" }, ...associates]}
                  defaultValue={value(i, "ownerId", a.ownerId ?? "")}
                  error={state.fieldErrors?.[`a${i}_ownerId`]}
                />
                <Field
                  name={`a${i}_dueDate`}
                  type="date"
                  label="Échéance"
                  required={false}
                  defaultValue={value(i, "dueDate", a.dueDate)}
                  error={state.fieldErrors?.[`a${i}_dueDate`]}
                />
                {projects ? (
                  <SelectField
                    name={`a${i}_projectId`}
                    label="Projet"
                    required
                    options={[{ value: "", label: "Choisir le projet…" }, ...projects]}
                    defaultValue={value(i, "projectId", "")}
                    error={state.fieldErrors?.[`a${i}_projectId`]}
                  />
                ) : null}
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-muted-foreground">
            Les lignes transformées en tâches sont marquées « [x] » dans le compte rendu. Une ligne décochée
            reste proposée ; pour l&apos;écarter, modifiez le compte rendu.
          </p>
          <div>
            <SubmitButton pendingLabel="Création…">
              <ListChecks aria-hidden="true" /> Créer les tâches
            </SubmitButton>
          </div>
        </form>
      ) : alreadyCreated > 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune action en attente : les actions de ce compte rendu ont été transformées en tâches.
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p className="font-bold text-foreground">Aucune action détectée dans ce compte rendu.</p>
          <SyntaxHelp />
        </div>
      )}
    </div>
  );
}
