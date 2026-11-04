"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { initialFormState } from "@/lib/forms";
import {
  answerHandoffAction,
  cancelHandoffAction,
  proposeHandoffAction,
  takeTaskAction,
} from "@/app/(app)/qg/actions";

/** Réponse à une passation reçue : accepter (client : prochaine action datée) ou refuser avec un mot. */
export function HandoffAnswerForm({
  handoffId,
  title,
  isOpportunity,
  nextAction,
  nextActionDate,
}: {
  handoffId: string;
  title: string;
  isOpportunity: boolean;
  nextAction: string;
  nextActionDate: string;
}) {
  const [state, action] = useActionState(answerHandoffAction, initialFormState);
  const uid = useId();
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2" noValidate aria-label={`Répondre pour « ${title} »`}>
      <FormMessages state={state} />
      <input type="hidden" name="handoffId" value={handoffId} />
      {isOpportunity ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-action`}>Ma prochaine action</Label>
            <Input
              id={`${uid}-action`}
              name="nextAction"
              defaultValue={state.values?.nextAction ?? nextAction}
              aria-describedby={`${uid}-aide`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-date`}>Pour le</Label>
            <Input
              id={`${uid}-date`}
              name="nextActionDate"
              type="date"
              defaultValue={state.values?.nextActionDate ?? nextActionDate}
            />
          </div>
          <p id={`${uid}-aide`} className="text-xs text-muted-foreground sm:col-span-2">
            Obligatoire pour accepter : un client ne change de main qu&apos;avec une suite datée.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-reponse`}>Réponse (obligatoire pour refuser)</Label>
        <Textarea
          id={`${uid}-reponse`}
          name="answer"
          rows={2}
          className="min-h-16"
          defaultValue={state.values?.answer ?? ""}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <DecisionButton value="accepter">Accepter</DecisionButton>
        <DecisionButton value="refuser" variant="outline">
          Refuser
        </DecisionButton>
      </div>
    </form>
  );
}

function DecisionButton({
  value,
  variant = "default",
  children,
}: {
  value: "accepter" | "refuser";
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="decision" value={value} variant={variant} disabled={pending}>
      {children}
    </Button>
  );
}

/** Annuler une proposition envoyée (auteur seulement). */
export function CancelHandoffForm({ handoffId, label = "Annuler" }: { handoffId: string; label?: string }) {
  const [state, action] = useActionState(cancelHandoffAction, initialFormState);
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-1">
      <FormMessages state={state} />
      <input type="hidden" name="handoffId" value={handoffId} />
      <div>
        <SubmitButton variant="ghost">{label}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * « Passer à… » (DONNER, par le responsable) ou « Proposer de reprendre » (REPRENDRE, par un autre
 * associé). L'élément ne change de main qu'après acceptation.
 */
export function ProposeHandoffForm({
  target,
  targetId,
  mode,
  associates,
}: {
  target: "task" | "opportunity";
  targetId: string;
  mode: "DONNER" | "REPRENDRE";
  associates?: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(proposeHandoffAction, initialFormState);
  const uid = useId();
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="mode" value={mode} />
      {mode === "DONNER" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${uid}-to`}>Passer à</Label>
          <Select
            id={`${uid}-to`}
            name="toId"
            defaultValue={state.values?.toId ?? ""}
            aria-invalid={state.fieldErrors?.toId ? true : undefined}
          >
            <option value="">Choisir un associé…</option>
            {(associates ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-note`}>Note de contexte (facultatif)</Label>
        <Textarea
          id={`${uid}-note`}
          name="note"
          rows={2}
          className="min-h-16"
          placeholder={
            mode === "DONNER"
              ? "Où j'en suis, les fichiers, la prochaine étape…"
              : "Pourquoi je peux la reprendre…"
          }
          defaultValue={state.values?.note ?? ""}
        />
      </div>
      <div>
        <SubmitButton variant="outline">
          {mode === "DONNER" ? "Proposer la passation" : "Proposer de reprendre"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Bouton seul « Proposer de reprendre » (QG : tâche non commencée d'un associé surchargé). */
export function QuickReprendreButton({ taskId, title }: { taskId: string; title: string }) {
  const [state, action] = useActionState(proposeHandoffAction, initialFormState);
  if (state.status === "success")
    return (
      <p role="status" className="text-xs text-success">
        Proposé
      </p>
    );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="target" value="task" />
      <input type="hidden" name="targetId" value={taskId} />
      <input type="hidden" name="mode" value="REPRENDRE" />
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        aria-label={`Proposer de reprendre « ${title} »`}
        className="inline-flex min-h-tap items-center rounded-lg border border-input bg-background px-3 text-xs font-bold whitespace-nowrap hover:bg-muted"
      >
        Proposer de reprendre
      </button>
    </form>
  );
}

/** « Je la prends » : une tâche sans responsable devient la mienne. */
export function TakeTaskButton({ taskId, title }: { taskId: string; title: string }) {
  const [state, action] = useActionState(takeTaskAction, initialFormState);
  if (state.status === "success")
    return (
      <p role="status" className="text-xs font-bold text-success">
        C&apos;est à vous
      </p>
    );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        title={`Prendre « ${title} »`}
        className="inline-flex min-h-tap items-center rounded-lg border-2 border-ink bg-background px-3 text-xs font-bold whitespace-nowrap hover:bg-highlight/60"
      >
        Je la prends
      </button>
    </form>
  );
}
