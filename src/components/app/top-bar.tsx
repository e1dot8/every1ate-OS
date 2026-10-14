import Link from "next/link";
import { Bell, Search, Timer } from "lucide-react";
import { QuickAdd } from "@/components/app/quick-add";
import { Elapsed } from "@/features/time/components/timer";
import { unreadCount } from "@/features/notifications/service";
import { getActiveTimer } from "@/features/time/service";
import { getCurrentUser } from "@/lib/auth/session";

/** Barre d'état : chronomètre en cours et cloche des notifications. */
export async function TopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [active, unread] = await Promise.all([getActiveTimer(user.id), unreadCount(user.id)]);
  return (
    <div className="mb-4 flex items-center justify-end gap-2">
      {active ? (
        <Link
          href={`/taches/${active.taskId}`}
          className="mr-auto inline-flex min-h-tap max-w-[70%] items-center gap-2 rounded-full border-2 border-ink bg-highlight/60 px-3 text-sm font-bold"
        >
          <Timer aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{active.task.title}</span>
          <Elapsed startedAt={active.startedAt!.toISOString()} />
        </Link>
      ) : null}
      <Link
        href="/recherche"
        aria-label="Rechercher"
        className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
      >
        <Search aria-hidden="true" className="size-5" />
      </Link>
      <QuickAdd />
      <Link
        href="/notifications"
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
        className="relative inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
