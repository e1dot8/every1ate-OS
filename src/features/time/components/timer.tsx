"use client";

import { useActionState, useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField, TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";
import {
  addTimeAction,
  correctTimeAction,
  startTimerAction,
  stopTimerAction,
  type TimerState,
} from "@/app/(app)/temps/actions";

function format(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Durée écoulée, mise à jour chaque seconde côté client. */
export function Elapsed({ startedAt }: { startedAt: string }) {
  const start = new Date(startedAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono tabular-nums" aria-live="off">
      {now == null ? "–:––:––" : format(Math.max(0, Math.floor((now - start) / 1000)))}
    </span>
  );
}

const idle: TimerState = { status: "idle" };

/**
 * Démarrer / arrêter le chronomètre d'une tâche. Si un autre tourne, une confirmation
 * explicite est demandée avant de l'arrêter (§8).
 */
export function TimerControl({ taskId, startedAt }: { taskId: string; startedAt: string | null }) {
  const [state, action] = useActionState(startTimerAction, idle);
  if (startedAt)
    return (
      <form action={stopTimerAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="taskId" value={taskId} />
        <span className="inline-flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-danger" />
          <Elapsed startedAt={startedAt} />
        </span>
        <SubmitButton variant="destructive" pendingLabel="Arrêt…">
          <Square aria-hidden="true" /> Arrêter
        </SubmitButton>
      </form>
    );
  return (
    <div className="flex flex-col gap-3">
      {state.status === "error" ? <FormAlert tone="danger" title={state.message ?? "Erreur"} /> : null}
      {state.status === "conflict" ? (
        <FormAlert tone="warning" title={state.message ?? "Un chronomètre tourne déjà."}>
          Il sera arrêté et son temps enregistré.
          <form action={action} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="force" value="true" />
            <SubmitButton pendingLabel="Bascule…">Arrêter l&apos;autre et démarrer ici</SubmitButton>
          </form>
        </FormAlert>
      ) : (
        <form action={action}>
          <input type="hidden" name="taskId" value={taskId} />
          <SubmitButton pendingLabel="Démarrage…">
            <Play aria-hidden="true" /> Démarrer le chronomètre
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

type Opt = { value: string; label: string };

export function ManualTimeForm({ taskId, tasks, today }: { taskId?: string; tasks?: Opt[]; today: string }) {
  const [state, action] = useActionState(addTimeAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {taskId ? (
        <input type="hidden" name="taskId" value={taskId} />
      ) : (
        <SelectField
          name="taskId"
          label="Tâche"
          defaultValue={v.taskId ?? ""}
          error={state.fieldErrors?.taskId}
          options={[{ value: "", label: "Choisir une tâche…" }, ...(tasks ?? [])]}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="date"
          type="date"
          label="Date"
          defaultValue={v.date ?? today}
          error={state.fieldErrors?.date}
        />
        <Field
          name="duration"
          label="Durée"
          hint="Ex. 1h30, 1:30, 45 (minutes), 2 (heures)"
          defaultValue={v.duration}
          error={state.fieldErrors?.duration}
        />
      </div>
      <Field name="comment" label="Commentaire (facultatif)" required={false} defaultValue={v.comment} />
      <div>
        <SubmitButton>Ajouter le temps</SubmitButton>
      </div>
    </form>
  );
}

export function CorrectTimeForm({
  entry,
}: {
  entry: { id: string; date: string; duration: string; comment: string };
}) {
  const [state, action] = useActionState(correctTimeAction, initialFormState);
  const v = { ...entry, ...(state.values ?? {}) };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="entryId" value={entry.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="date" type="date" label="Date" defaultValue={v.date} error={state.fieldErrors?.date} />
        <Field name="duration" label="Durée" defaultValue={v.duration} error={state.fieldErrors?.duration} />
      </div>
      <Field name="comment" label="Commentaire" required={false} defaultValue={v.comment} />
      <TextareaField
        name="reason"
        label="Motif de la correction (facultatif)"
        defaultValue={state.values?.reason ?? ""}
      />
      <div className="flex gap-3">
        <SubmitButton>Enregistrer la correction</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
