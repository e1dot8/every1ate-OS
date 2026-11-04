"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { CalendarClock, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/select";
import { sendMessageAction } from "@/app/(app)/discussions/actions";
import { MESSAGE_MAX_LENGTH, type ComposerState } from "@/features/discussions/rules";
import { cn } from "@/lib/utils";

const initial: ComposerState = { status: "idle" };
const summaryClass =
  "inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden";

/**
 * Compositeur (bas de page) : texte avec mise en forme légère et commandes (/aide), lien joint,
 * envoi programmé. Les réponses des commandes s'affichent ici, visibles par l'auteur seul.
 * Sur ordinateur, Entrée envoie et Maj+Entrée va à la ligne.
 */
export function Composer({
  channelId,
  parentId,
  placeholder,
  defaultSendAt,
  focusEndLabel,
}: {
  channelId: string;
  parentId?: string | null;
  placeholder: string;
  /** Valeur par défaut du champ date-heure (heure de Paris, « AAAA-MM-JJTHH:MM »). */
  defaultSendAt: string;
  /** Message direct : fin du focus de l'autre associé (« 15 h »), pour programmer à ce moment. */
  focusEndLabel?: string | null;
}) {
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const [dismissed, setDismissed] = useState<ComposerState | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const send = useRef<HTMLButtonElement>(null);
  const shown = state !== dismissed && (state.message || state.lines?.length) ? state : null;
  const fieldErrors = shown?.fieldErrors ? Object.values(shown.fieldErrors) : [];
  const values = state.status === "error" ? state.values : undefined;
  const id = parentId ? `composer-${parentId}` : "composer";

  return (
    <div className="sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-20 mt-2 border-t bg-background pt-2 pb-2 shadow-[0_-10px_12px_-12px_rgba(0,0,0,0.25)] md:bottom-0 md:pb-4">
      {shown ? (
        <div
          role={shown.status === "error" ? "alert" : "status"}
          className={cn(
            "mb-2 flex gap-2 rounded-lg border p-2 text-sm",
            shown.status === "error" ? "border-danger/40 bg-danger-soft" : "bg-cream/70",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Visible par toi seul</p>
            {shown.message ? (
              <p className={cn("font-bold", shown.status === "error" && "text-danger")}>{shown.message}</p>
            ) : null}
            {fieldErrors.length ? (
              <ul className="text-danger">
                {fieldErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            {shown.lines?.length ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {shown.lines.map((line, i) => (
                  <li key={`${line.text}-${i}`} className="break-words">
                    {line.href ? (
                      <Link href={line.href} className="underline decoration-pen underline-offset-2">
                        {line.text}
                      </Link>
                    ) : (
                      line.text
                    )}
                  </li>
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
      <form ref={form} action={action} noValidate className="flex flex-col gap-2">
        <input type="hidden" name="channelId" value={channelId} />
        {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
        <label htmlFor={id} className="sr-only">
          {parentId ? "Réponse" : "Message"}
        </label>
        <Textarea
          id={id}
          name="body"
          rows={2}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={placeholder}
          defaultValue={values?.body ?? ""}
          aria-describedby={`${id}-aide`}
          className="min-h-16 resize-y"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            if (!window.matchMedia("(pointer: fine)").matches) return;
            e.preventDefault();
            form.current?.requestSubmit(send.current);
          }}
        />
        <p id={`${id}-aide`} className="sr-only">
          **gras**, _italique_, `code`, @Prénom pour mentionner, /aide pour les commandes.
        </p>
        {parentId ? (
          <label className="flex min-h-tap w-fit items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="alsoInChannel"
              defaultChecked={values?.alsoInChannel === "on"}
              className="size-5 accent-[var(--ink)]"
            />
            Aussi envoyer dans le salon
          </label>
        ) : null}
        <div className="flex flex-wrap items-start gap-1">
          <details className="group" open={!!values?.attachmentUrl}>
            <summary className={summaryClass}>
              <Paperclip aria-hidden="true" className="size-4" />
              Joindre
            </summary>
            <div className="mt-1 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 rounded-lg border p-2">
              <label className="flex flex-col gap-1 text-sm font-bold">
                Titre du lien
                <Input name="attachmentTitle" defaultValue={values?.attachmentTitle ?? ""} maxLength={120} />
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
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="min-h-tap cursor-not-allowed rounded-lg border px-3 text-sm font-bold opacity-50"
                >
                  Envoyer un fichier
                </button>
                Bientôt disponible : partage un lien Drive en attendant.
              </p>
            </div>
          </details>
          <details className="group" open={!!values?.sendAt}>
            <summary className={summaryClass}>
              <CalendarClock aria-hidden="true" className="size-4" />
              Programmer
            </summary>
            <div className="mt-1 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 rounded-lg border p-2">
              <label className="flex flex-col gap-1 text-sm font-bold">
                Date et heure d&apos;envoi
                <Input type="datetime-local" name="sendAt" defaultValue={values?.sendAt ?? defaultSendAt} />
              </label>
              <Button type="submit" name="intent" value="programmer" variant="outline" disabled={pending}>
                Programmer l&apos;envoi
              </Button>
              <div className="flex flex-wrap gap-1">
                <Button type="submit" name="intent" value="demain9" variant="ghost" size="sm" disabled={pending}>
                  Demain 9 h
                </Button>
                <Button type="submit" name="intent" value="lundi9" variant="ghost" size="sm" disabled={pending}>
                  Lundi 9 h
                </Button>
                {focusEndLabel ? (
                  <Button type="submit" name="intent" value="finfocus" variant="ghost" size="sm" disabled={pending}>
                    À la fin de son focus ({focusEndLabel})
                  </Button>
                ) : null}
              </div>
            </div>
          </details>
          <Button ref={send} type="submit" name="intent" value="envoyer" className="ml-auto" disabled={pending}>
            <Send aria-hidden="true" />
            {pending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
