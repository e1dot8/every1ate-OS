import Link from "next/link";
import { CheckSquare, Link2, MessageSquareText, Pin } from "lucide-react";
import { Avatar } from "@/components/app/bits";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { toggleReactionAction } from "@/app/(app)/discussions/actions";
import type { MessageWithDetails } from "@/features/discussions/queries";
import { plainExcerpt, safeHref } from "@/features/discussions/rules";
import { EditMessageForm } from "@/features/discussions/components/edit-message-form";
import { MessageActions } from "@/features/discussions/components/message-actions";
import { RichText } from "@/features/discussions/components/rich-text";

export type MessageContext = {
  slug: string;
  viewerId: string;
  /** Salon non archivé et accessible en écriture. */
  writable: boolean;
  /** Page affichée (retour après modification). */
  retour: string;
  /** Vue d'un salon (résumé des fils) ou d'un fil. */
  view: "salon" | "fil";
  editingId: string | null;
  tasks: Map<string, string>;
};

function metaHref(meta: unknown): string | null {
  return meta && typeof meta === "object" && "href" in meta
    ? safeHref((meta as { href: unknown }).href)
    : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function Reactions({ message, ctx }: { message: MessageWithDetails; ctx: MessageContext }) {
  const groups = new Map<string, { names: string[]; mine: boolean }>();
  for (const r of message.reactions) {
    const g = groups.get(r.emoji) ?? { names: [], mine: false };
    g.names.push(r.user.name);
    if (r.userId === ctx.viewerId) g.mine = true;
    groups.set(r.emoji, g);
  }
  if (!groups.size) return null;
  return (
    <ul aria-label="Réactions" className="mt-1 flex flex-wrap gap-1">
      {[...groups].map(([emoji, g]) => (
        <li key={emoji}>
          <form action={toggleReactionAction}>
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="emoji" value={emoji} />
            <button
              type="submit"
              disabled={!ctx.writable}
              aria-pressed={g.mine}
              aria-label={`Réaction ${emoji}, ${g.names.length}`}
              title={g.names.join(", ")}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-full border px-2 text-sm tabular-nums hover:bg-muted",
                g.mine && "border-ink bg-highlight/50",
              )}
            >
              <span aria-hidden="true">{emoji}</span>
              <span aria-hidden="true">{g.names.length}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

/** Ligne du QG (message automatique, sans auteur) avec son lien. */
function SystemLine({ message }: { message: MessageWithDetails }) {
  const href = metaHref(message.meta);
  return (
    <li
      id={`m-${message.id}`}
      className="flex scroll-mt-28 gap-3 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/60"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-cream text-[11px] font-bold"
      >
        QG
      </span>
      <p className="min-w-0 flex-1 break-words text-muted-foreground">
        <span className="font-bold text-foreground">QG</span>{" "}
        <time dateTime={message.createdAt.toISOString()} className="text-xs">
          {formatTime(message.createdAt)}
        </time>
        <br />
        {message.body}
        {href ? (
          <>
            {" "}
            {href.startsWith("/") ? (
              <Link
                href={href}
                className="font-bold text-foreground underline decoration-pen underline-offset-2"
              >
                Ouvrir
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-bold text-foreground underline decoration-pen underline-offset-2"
              >
                Ouvrir
              </a>
            )}
          </>
        ) : null}
      </p>
    </li>
  );
}

/** Un message : auteur, heure, texte mis en forme, liens joints, réactions, fil, tâche liée, menu. */
export function MessageItem({
  message,
  compact,
  ctx,
}: {
  message: MessageWithDetails;
  compact: boolean;
  ctx: MessageContext;
}) {
  if (!message.authorId) return <SystemLine message={message} />;
  const deleted = !!message.deletedAt;
  const isMine = message.authorId === ctx.viewerId;
  const rootId = message.parentId ?? message.id;
  const threadHref = `/discussions/${ctx.slug}/fil/${rootId}`;
  const editing = ctx.editingId === message.id && isMine && !deleted && ctx.writable;
  const replies = message._count.replies;
  const taskTitle = message.taskId ? (ctx.tasks.get(message.taskId) ?? "Tâche liée") : null;
  const name = message.author?.name ?? "Ancien associé";
  return (
    <li
      id={`m-${message.id}`}
      className={cn(
        "flex scroll-mt-28 gap-3 rounded-md px-1.5 hover:bg-muted/60",
        compact ? "py-0.5" : "pt-2 pb-1",
        message.pinnedAt && !deleted && "bg-highlight/15",
      )}
    >
      {compact ? (
        <span className="w-8 shrink-0" aria-hidden="true" />
      ) : (
        <Avatar name={name} className="mt-0.5 size-8" />
      )}
      <div className="min-w-0 flex-1">
        {compact ? (
          <span className="sr-only">
            {name}, {formatTime(message.createdAt)}
          </span>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold">{name}</span>
            <time dateTime={message.createdAt.toISOString()} className="text-xs text-muted-foreground">
              {formatTime(message.createdAt)}
            </time>
          </p>
        )}
        {message.parentId && ctx.view === "salon" ? (
          <p className="text-xs text-muted-foreground">
            A répondu dans le fil{message.parent?.author ? ` de ${message.parent.author.name}` : ""} :{" "}
            <Link href={threadHref} className="underline underline-offset-2">
              «{" "}
              {message.parent && !message.parent.deletedAt
                ? plainExcerpt(message.parent.body, 60)
                : "message supprimé"}{" "}
              »
            </Link>
          </p>
        ) : null}
        {deleted ? (
          <p className="text-sm text-muted-foreground italic">Message supprimé</p>
        ) : editing ? (
          <EditMessageForm messageId={message.id} body={message.body} retour={ctx.retour} />
        ) : (
          <>
            {message.body ? <RichText body={message.body} className="min-w-0 break-words" /> : null}
            {message.editedAt ? <span className="text-xs text-muted-foreground"> (modifié)</span> : null}
          </>
        )}
        {message.pinnedAt && !deleted ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-pen-strong">
            <Pin aria-hidden="true" className="size-3" /> Épinglé
          </p>
        ) : null}
        {message.attachments.length ? (
          <ul aria-label="Liens joints" className="mt-1 flex flex-col gap-1">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full min-h-9 items-center gap-2 rounded-md border px-2 text-sm hover:bg-muted"
                >
                  <Link2 aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate font-bold">{a.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{hostOf(a.url)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {!deleted ? <Reactions message={message} ctx={ctx} /> : null}
        {taskTitle ? (
          <Link
            href={`/taches/${message.taskId}`}
            className="mt-1 inline-flex min-h-9 max-w-full items-center gap-1.5 text-sm font-bold underline decoration-pen underline-offset-2"
          >
            <CheckSquare aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Tâche : {taskTitle}</span>
          </Link>
        ) : null}
        {ctx.view === "salon" && !message.parentId && replies > 0 ? (
          <Link
            href={threadHref}
            className="mt-1 flex min-h-9 w-fit items-center gap-1.5 text-sm font-bold text-info hover:underline"
          >
            <MessageSquareText aria-hidden="true" className="size-4" />
            {plural(replies, "réponse")}
            {message.replies[0] ? (
              <span className="font-normal text-muted-foreground">
                · dernière à {formatTime(message.replies[0].createdAt)}
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
      {deleted ? null : (
        <MessageActions
          messageId={message.id}
          threadHref={ctx.view === "salon" ? threadHref : null}
          taskHref={ctx.writable && !message.taskId ? `/discussions/${ctx.slug}/tache/${message.id}` : null}
          editHref={isMine && ctx.writable ? `${ctx.retour}?modifier=${message.id}#m-${message.id}` : null}
          isMine={isMine}
          pinned={!!message.pinnedAt}
          saved={message.saves.length > 0}
          writable={ctx.writable}
        />
      )}
    </li>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
