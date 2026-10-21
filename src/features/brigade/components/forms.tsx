"use client";

import { useActionState, useState } from "react";
import { PartyPopper } from "lucide-react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cheerAction, peerBadgeAction } from "@/app/(app)/bureau/actions";
import { initialFormState } from "@/lib/forms";

/** Féliciter une réussite, avec un mot facultatif. Une fois par réussite. */
export function CheerForm({ eventId, title }: { eventId: string; title: string }) {
  const [state, action] = useActionState(cheerAction, initialFormState);
  const [open, setOpen] = useState(false);
  if (state.status === "success") return <span className="text-sm font-bold text-success">Bravo envoyé</span>;
  if (!open)
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Féliciter : ${title}`}
      >
        <PartyPopper aria-hidden="true" /> Féliciter
      </Button>
    );
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <FormMessages state={state} />
      <input type="hidden" name="eventId" value={eventId} />
      <Input
        name="message"
        maxLength={300}
        placeholder="Un mot (facultatif)"
        aria-label="Votre mot de félicitations"
      />
      <div>
        <SubmitButton>Envoyer le bravo</SubmitButton>
      </div>
    </form>
  );
}

type Opt = { value: string; label: string };

/** Reconnaître un associé : un badge de brigade, avec la raison. */
export function PeerBadgeForm({ associates, badges }: { associates: Opt[]; badges: Opt[] }) {
  const [state, action] = useActionState(peerBadgeAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Pour qui ?
          <select
            name="targetId"
            className="min-h-tap rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">Choisir…</option>
            {associates.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Quel badge ?
          <select
            name="badgeKey"
            className="min-h-tap rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">Choisir…</option>
            {badges.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Pourquoi ?
        <Input name="message" maxLength={300} placeholder="Ex. a débloqué le tournage samedi" />
      </label>
      <div>
        <SubmitButton>Décerner le badge</SubmitButton>
      </div>
    </form>
  );
}
