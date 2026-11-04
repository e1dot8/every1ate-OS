"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { FormMessages } from "@/components/forms/form-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { menageAction } from "@/app/(app)/qg/actions";

function Verdict({
  value,
  variant = "outline",
  children,
}: {
  value: "TERMINE" | "EN_ATTENTE" | "BLOQUE" | "ANNULE";
  variant?: "default" | "outline" | "ghost";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="verdict" value={value} variant={variant} size="sm" disabled={pending}>
      {children}
    </Button>
  );
}

/** Verdict du grand ménage pour une tâche qui prend la poussière : une sortie en un clic. */
export function MenageForm({ taskId, title }: { taskId: string; title: string }) {
  const [state, action] = useActionState(menageAction, initialFormState);
  const uid = useId();
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2" noValidate aria-label={`Trancher « ${title} »`}>
      <FormMessages state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-motif`} className="text-xs">
          Motif (pour mettre en attente, bloquer ou annuler)
        </Label>
        <Input
          id={`${uid}-motif`}
          name="reason"
          defaultValue={state.values?.reason ?? ""}
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Verdict value="TERMINE" variant="default">
          Terminer
        </Verdict>
        <Verdict value="EN_ATTENTE">Mettre en attente</Verdict>
        <Verdict value="BLOQUE">Bloquer</Verdict>
        <Verdict value="ANNULE" variant="ghost">
          Annuler la tâche
        </Verdict>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-disabled="true"
          title="Bientôt disponible"
        >
          Découper · bientôt disponible
        </Button>
      </div>
    </form>
  );
}
