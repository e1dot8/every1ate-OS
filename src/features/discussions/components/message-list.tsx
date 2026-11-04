import { Fragment } from "react";
import type { MessageWithDetails } from "@/features/discussions/queries";
import { firstUnreadIndex, groupByDay } from "@/features/discussions/rules";
import { MessageItem, type MessageContext } from "@/features/discussions/components/message-item";

/** Messages groupés par jour (heure de Paris), avec la ligne « Nouveaux messages ». */
export function MessageList({
  messages,
  ctx,
  lastReadAt,
  now,
  label,
  dayHeading: DayHeading = "h2",
}: {
  messages: MessageWithDetails[];
  ctx: MessageContext;
  lastReadAt: Date | null;
  now: Date;
  label: string;
  /** Niveau des titres de jour : h3 quand la liste est sous une section (page d'un élément, projet). */
  dayHeading?: "h2" | "h3";
}) {
  const unreadAt = firstUnreadIndex(messages, lastReadAt, ctx.viewerId);
  const firstUnreadId = unreadAt >= 0 ? messages[unreadAt].id : null;
  return (
    <div className="flex flex-col gap-1">
      {groupByDay(messages, now).map((group) => (
        <section key={group.day} aria-label={group.label} className="flex flex-col">
          <DayHeading className="sticky top-0 z-10 my-1 flex items-center gap-3 bg-background/95 py-1 text-xs font-bold text-muted-foreground backdrop-blur">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            {group.label}
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </DayHeading>
          <ul aria-label={`${label}, ${group.label.toLowerCase()}`} className="flex flex-col">
            {group.items.map(({ message, compact }) => (
              <Fragment key={message.id}>
                {message.id === firstUnreadId ? (
                  <li className="my-1 flex items-center gap-2">
                    <span className="h-px flex-1 bg-pen" aria-hidden="true" />
                    <span className="text-xs font-bold text-pen-strong">Nouveaux messages</span>
                  </li>
                ) : null}
                <MessageItem message={message} compact={compact && message.id !== firstUnreadId} ctx={ctx} />
              </Fragment>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
