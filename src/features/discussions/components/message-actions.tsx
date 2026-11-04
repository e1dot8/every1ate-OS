"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  AlarmClock,
  Bookmark,
  BookmarkMinus,
  ListTodo,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { messageMenuAction } from "@/app/(app)/discussions/actions";
import { REACTIONS, REMINDER_CHOICES } from "@/features/discussions/rules";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

const itemClass =
  "flex min-h-tap w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50";

/**
 * Menu d'un message (bouton « Actions du message ») : réagir, répondre dans un fil, épingler,
 * Plus tard, me rappeler, transformer en tâche, modifier et supprimer ses propres messages.
 * Le contenu n'est monté qu'à la première ouverture.
 */
export function MessageActions({
  messageId,
  threadHref,
  taskHref,
  editHref,
  isMine,
  pinned,
  saved,
  writable,
}: {
  messageId: string;
  threadHref: string | null;
  taskHref: string | null;
  editHref: string | null;
  isMine: boolean;
  pinned: boolean;
  saved: boolean;
  writable: boolean;
}) {
  const [state, action, pending] = useActionState(messageMenuAction, initialFormState);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Près du bas de l'écran (compositeur, barre de navigation), le menu s'ouvre vers le haut.
  const [upward, setUpward] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState<typeof state | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!state.message) return;
    const timer = setTimeout(() => setDismissed(state), 5000);
    return () => clearTimeout(timer);
  }, [state]);

  const toast = state.message && dismissed !== state ? state : null;

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label="Actions du message"
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setUpward(rect.bottom > window.innerHeight * 0.5 && rect.top > 440);
          setMounted(true);
          setConfirming(false);
          setOpen((v) => !v);
        }}
        className="inline-flex size-tap items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>
      {toast ? (
        <p
          role={toast.status === "error" ? "alert" : "status"}
          className={cn(
            "absolute top-full right-0 z-30 mt-1 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-md px-2 py-1 text-xs font-bold",
            toast.status === "error" ? "bg-danger-soft text-danger" : "bg-ink text-paper",
            open && "hidden",
          )}
        >
          {toast.message}
        </p>
      ) : null}
      {mounted ? (
        <div
          id={panelId}
          hidden={!open}
          className={cn(
            "absolute right-0 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-1.5 shadow-lg",
            upward ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col">
            <input type="hidden" name="messageId" value={messageId} />
            {writable ? (
              <div role="group" aria-label="Réagir" className="grid grid-cols-7 border-b pb-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="submit"
                    name="intent"
                    value={`react:${emoji}`}
                    aria-label={`Réagir avec ${emoji}`}
                    disabled={pending}
                    className="flex min-h-tap items-center justify-center rounded-md text-lg hover:bg-muted"
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {threadHref ? (
              <Link href={threadHref} className={itemClass}>
                <MessageSquareReply aria-hidden="true" className="size-4" />
                Répondre dans un fil
              </Link>
            ) : null}
            {writable ? (
              <button type="submit" name="intent" value="pin" disabled={pending} className={itemClass}>
                {pinned ? (
                  <PinOff aria-hidden="true" className="size-4" />
                ) : (
                  <Pin aria-hidden="true" className="size-4" />
                )}
                {pinned ? "Désépingler" : "Épingler"}
              </button>
            ) : null}
            <button type="submit" name="intent" value="save" disabled={pending} className={itemClass}>
              {saved ? (
                <BookmarkMinus aria-hidden="true" className="size-4" />
              ) : (
                <Bookmark aria-hidden="true" className="size-4" />
              )}
              {saved ? "Retirer de Plus tard" : "Plus tard"}
            </button>
            <div role="group" aria-label="Me rappeler" className="flex flex-col border-t pt-1">
              <span className="flex items-center gap-2 px-2 pt-1 text-xs font-bold text-muted-foreground">
                <AlarmClock aria-hidden="true" className="size-3.5" />
                Me rappeler
              </span>
              <div className="grid grid-cols-2 gap-1">
                {REMINDER_CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="submit"
                    name="intent"
                    value={`remind:${c.value}`}
                    disabled={pending}
                    aria-label={`Me rappeler : ${c.label.toLowerCase()}`}
                    className="min-h-tap rounded-md px-2 text-sm hover:bg-muted"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {taskHref || editHref || isMine ? <div className="mt-1 border-t" /> : null}
            {taskHref ? (
              <Link href={taskHref} className={itemClass}>
                <ListTodo aria-hidden="true" className="size-4" />
                Transformer en tâche
              </Link>
            ) : null}
            {editHref ? (
              <Link href={editHref} className={itemClass}>
                <Pencil aria-hidden="true" className="size-4" />
                Modifier
              </Link>
            ) : null}
            {isMine ? (
              confirming ? (
                <div className="flex flex-col gap-1 rounded-md bg-danger-soft p-1.5">
                  <p className="px-1 text-sm">Supprimer ce message ? Son fil reste visible.</p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="min-h-tap rounded-md border bg-background px-2 text-sm font-bold"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="delete"
                      disabled={pending}
                      className="min-h-tap rounded-md bg-destructive px-2 text-sm font-bold text-destructive-foreground"
                    >
                      Confirmer la suppression
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={cn(itemClass, "text-danger")}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Supprimer…
                </button>
              )
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
