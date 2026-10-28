import Link from "next/link";
import { Bell, Flame, Plus, Search, Timer } from "lucide-react";
import { QuickAdd } from "@/components/app/quick-add";
import { userStreak } from "@/features/badges/service";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { avatarsOf } from "@/features/maison/service";
import { listAssociates } from "@/features/projects/service";
import { Elapsed } from "@/features/time/components/timer";
import { unreadCount } from "@/features/notifications/service";
import { getActiveTimer, getPausedTimer } from "@/features/time/service";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Barre d'état : chronomètre en cours, la brigade (vers le bureau commun), la série de
 * régularité, la recherche, « Créer » et le courrier (lot G8, maquette).
 */
export async function TopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [active, paused, unread, associates, streak] = await Promise.all([
    getActiveTimer(user.id),
    getPausedTimer(user.id),
    unreadCount(user.id),
    listAssociates(),
    userStreak(user.id),
  ]);
  const looks = await avatarsOf(associates.map((a) => a.id));
  return (
    <div className="mb-4 flex items-center justify-end gap-2.5">
      {active ? (
        <Link
          href={`/taches/${active.taskId}`}
          className="mr-auto inline-flex min-h-tap max-w-[70%] items-center gap-2 rounded-full border-2 border-ink bg-highlight/60 px-3 text-sm font-bold"
        >
          <Timer aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{active.task.title}</span>
          <Elapsed startedAt={active.startedAt!.toISOString()} />
        </Link>
      ) : paused ? (
        <Link
          href={`/taches/${paused.taskId}`}
          className="mr-auto inline-flex min-h-tap max-w-[70%] items-center gap-2 rounded-full border-2 border-dashed border-ink px-3 text-sm font-bold"
        >
          <Timer aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">En pause · {paused.task.title}</span>
        </Link>
      ) : null}
      <Link
        href="/bureau"
        aria-label={`La brigade : ${associates.map((a) => a.name).join(", ")} — ouvrir le bureau commun`}
        className="hidden items-center rounded-full py-1 pr-1 hover:bg-paper/70 lg:inline-flex"
      >
        <span className="flex -space-x-2">
          {associates.map((a) => (
            <BrigadeAvatar key={a.id} look={looks.get(a.id)!} size={34} className="ring-2 ring-background" />
          ))}
        </span>
        <span className="ml-1 inline-flex size-8 items-center justify-center rounded-full border border-ink/15 bg-paper">
          <Plus aria-hidden="true" className="size-4" />
        </span>
      </Link>
      {streak?.weeks ? (
        <Link
          href="/progression"
          className="hidden h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-4 text-[13px] sm:inline-flex"
        >
          Série
          <Flame aria-hidden="true" className="size-4 text-pen" />
          <b>
            {streak.weeks} semaine{streak.weeks > 1 ? "s" : ""}
          </b>
        </Link>
      ) : null}
      <Link
        href="/recherche"
        aria-label="Rechercher"
        className="inline-flex size-tap items-center justify-center rounded-full border border-ink/10 bg-paper hover:bg-muted"
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
