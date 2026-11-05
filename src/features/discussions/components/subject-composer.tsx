"use client";

import { useActionState, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/select";
import { postSubjectCommentAction } from "@/app/(app)/discussions/actions";
import { ATTACHMENT_TITLE_MAX, MESSAGE_MAX_LENGTH } from "@/features/discussions/rules";
import type { SubjectType } from "@/features/discussions/subject-rules";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/**
 * Compositeur de la discussion d'une tâche ou d'un livrable : texte (mise en forme légère,
 * @Prénom pour prévenir un associé), lien https joint, « Aussi envoyer dans le salon du projet ».
 * Ctrl+Entrée (ou ⌘+Entrée) publie.
 */
export function SubjectComposer({ type, id }: { type: SubjectType; id: string }) {
  const [state, action, pending] = useActionState(postSubjectCommentAction, initialFormState);
  const [dismissed, setDismissed] = useState<FormState | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const shown = state !== dismissed && state.message ? state : null;
  const values = state.status === "error" ? state.values : undefined;
  const fieldErrors = state.status === "error" && state.fieldErrors ? Object.values(state.fieldErrors) : [];
  const fieldId = `commentaire-${id}`;

  return (
    <form ref={form} action={action} noValidate className="flex flex-col gap-2 border-t pt-3">
      {shown ? (
        <div
          role={shown.status === "error" ? "alert" : "status"}
          className={cn(
            "flex gap-2 rounded-lg border p-2 text-sm",
            shown.status === "error" ? "border-danger/40 bg-danger-soft" : "bg-cream/70",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn("font-bold", shown.status === "error" && "text-danger")}>{shown.message}</p>
            {fieldErrors.length ? (
              <ul className="text-danger">
                {fieldErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setDismissed(state)}
            className="inline-flex min-h-tap shrink-0 items-start rounded-md px-2 text-xs font-bold text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>
      ) : null}
      <input type="hidden" name="subjectType" value={type} />
      <input type="hidden" name="subjectId" value={id} />
      <label htmlFor={fieldId} className="text-sm font-bold">
        Ajouter un commentaire
      </label>
      <Textarea
        id={fieldId}
        name="body"
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Écrire un commentaire…"
        defaultValue={values?.body ?? ""}
        aria-describedby={`${fieldId}-aide`}
        className="min-h-20 resize-y"
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.nativeEvent.isComposing) return;
          e.preventDefault();
          form.current?.requestSubmit();
        }}
      />
      <p id={`${fieldId}-aide`} className="text-xs text-muted-foreground">
        @Prénom pour prévenir un associé · **gras**, _italique_ · les liens https sont cliquables.
      </p>
      <label className="flex min-h-tap w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="alsoInChannel"
          defaultChecked={values?.alsoInChannel === "on"}
          className="size-5 accent-[var(--ink)]"
        />
        Aussi envoyer dans le salon du projet
      </label>
      <div className="flex flex-wrap items-start gap-1">
        <details className="group" open={!!values?.attachmentUrl}>
          <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Paperclip aria-hidden="true" className="size-4" />
            Joindre un lien
          </summary>
          <div className="mt-1 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 rounded-lg border p-2">
            <label className="flex flex-col gap-1 text-sm font-bold">
              Titre du lien
              <Input
                name="attachmentTitle"
                defaultValue={values?.attachmentTitle ?? ""}
                maxLength={ATTACHMENT_TITLE_MAX}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Adresse du lien
              <Input
                name="attachmentUrl"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/…"
                defaultValue={values?.attachmentUrl ?? ""}
              />
            </label>
          </div>
        </details>
        {/* Pleine largeur sur mobile : le bouton « + » flottant ne le recouvre jamais. */}
        <Button type="submit" className="w-full sm:ml-auto sm:w-auto" disabled={pending}>
          <Send aria-hidden="true" />
          {pending ? "Publication…" : "Publier"}
        </Button>
      </div>
    </form>
  );
}
