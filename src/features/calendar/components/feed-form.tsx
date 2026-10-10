"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rotateFeedAction, type FeedState } from "@/app/(app)/calendrier/actions";

export function FeedForm({ exists, includeTasks }: { exists: boolean; includeTasks: boolean }) {
  const [state, action] = useActionState<FeedState, FormData>(rotateFeedAction, { status: "idle" });
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {state.url ? (
        <FormAlert
          tone="success"
          title="Lien d'abonnement créé : copiez-le maintenant, il ne sera plus affiché."
        >
          <div className="mt-2 flex gap-2">
            <Input
              readOnly
              value={state.url}
              aria-label="Lien d'abonnement ICS"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copier le lien"
              onClick={async () => {
                await navigator.clipboard?.writeText(state.url!);
                setCopied(true);
              }}
            >
              <Copy aria-hidden="true" />
            </Button>
          </div>
          {copied ? <p className="mt-1 text-sm">Copié.</p> : null}
        </FormAlert>
      ) : null}
      <form action={action} className="flex flex-col gap-3">
        <label className="flex min-h-tap items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            name="includeTasks"
            defaultChecked={includeTasks}
            className="size-5 accent-ink"
          />{" "}
          Inclure mes échéances de tâches
        </label>
        <div>
          <SubmitButton>
            {exists ? "Renouveler le lien (l'ancien cesse de fonctionner)" : "Créer mon lien d'abonnement"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
