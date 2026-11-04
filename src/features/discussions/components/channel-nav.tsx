import Link from "next/link";
import { AtSign, Bookmark, Clock, Hash, Lock, Folder, NotebookPen, Plus, Search, List } from "lucide-react";
import type { Sidebar, SidebarChannel } from "@/features/discussions/queries";
import { NavLink } from "@/features/discussions/components/nav-link";
import { PresenceDot } from "@/features/discussions/components/presence-dot";
import { presenceLabels } from "@/features/presence/rules";
import { cn } from "@/lib/utils";

const rowClass =
  "flex min-h-tap w-full min-w-0 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground";

function UnreadBadge({ unread, mentions }: { unread: number; mentions: number }) {
  if (!unread) return null;
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-1.5 text-[11px] leading-5 font-bold tabular-nums",
        mentions ? "bg-pen text-paper" : "bg-ink text-paper",
      )}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

const unreadLabel = (unread: number, mentions: number) =>
  unread
    ? `, ${unread} non lu${unread > 1 ? "s" : ""}${mentions ? `, dont ${mentions} mention${mentions > 1 ? "s" : ""}` : ""}`
    : "";

function ChannelIcon({ channel }: { channel: SidebarChannel }) {
  const Icon = channel.kind === "PRIVE" ? Lock : channel.projectId ? Folder : Hash;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

function GroupTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-3 pb-1">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
}

/**
 * Liste des salons et des messages directs (barre latérale sur ordinateur, page d'accueil
 * des discussions sur mobile). Pastille = non lus ; rouge = au moins une mention.
 */
export function ChannelNav({ data, label }: { data: Sidebar; label: string }) {
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col">
      <ul className="flex flex-col">
        {[
          { href: "/discussions/activite", icon: AtSign, text: "Activité" },
          { href: "/discussions/plus-tard", icon: Bookmark, text: "Plus tard" },
          { href: "/discussions/programmes", icon: Clock, text: "Programmés" },
          { href: "/discussions/recherche", icon: Search, text: "Recherche" },
        ].map(({ href, icon: Icon, text }) => (
          <li key={href}>
            <NavLink href={href} className={rowClass}>
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {text}
            </NavLink>
          </li>
        ))}
      </ul>

      <GroupTitle
        action={
          <Link
            href="/discussions/nouveau"
            aria-label="Nouveau salon"
            className="inline-flex size-tap items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        Salons
      </GroupTitle>
      <ul className="flex flex-col">
        {data.channels.map((c) => (
          <li key={c.id}>
            <NavLink
              href={`/discussions/${c.slug}`}
              className={cn(rowClass, c.unread && "font-bold text-foreground")}
              label={`${c.title}${unreadLabel(c.unread, c.mentions)}`}
            >
              <ChannelIcon channel={c} />
              <span className="min-w-0 truncate">{c.title}</span>
              <UnreadBadge unread={c.unread} mentions={c.mentions} />
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink href="/discussions/salons" className={rowClass}>
            <List aria-hidden="true" className="size-4 shrink-0" />
            Tous les salons
          </NavLink>
        </li>
      </ul>

      <GroupTitle
        action={
          <Link
            href="/discussions/nouveau?vue=message"
            aria-label="Nouveau message"
            className="inline-flex size-tap items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        Messages directs
      </GroupTitle>
      <ul className="flex flex-col">
        <li>
          <NavLink
            href={data.perso.href}
            className={cn(rowClass, data.perso.unread && "font-bold text-foreground")}
            label={`Moi (notes perso)${unreadLabel(data.perso.unread, 0)}`}
          >
            <NotebookPen aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">Moi (notes perso)</span>
            <UnreadBadge unread={data.perso.unread} mentions={0} />
          </NavLink>
        </li>
        {data.directs.map((d) => (
          <li key={d.href}>
            <NavLink
              href={d.href}
              className={cn(rowClass, d.unread && "font-bold text-foreground")}
              label={`${d.title}${d.presence ? ` (${presenceLabels[d.presence.state]})` : ""}${unreadLabel(d.unread, d.mentions)}`}
            >
              {d.presence ? <PresenceDot state={d.presence.state} className="w-4 justify-center" /> : null}
              <span className="min-w-0 truncate">{d.title}</span>
              <UnreadBadge unread={d.unread} mentions={d.mentions} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
