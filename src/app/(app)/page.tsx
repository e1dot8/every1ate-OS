import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  Gauge,
  Inbox,
  ListChecks,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { briefingStatus } from "@/features/briefing/service";
import { WokBanner } from "@/components/brand/wok-banner";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { getAvatar } from "@/features/maison/service";
import { badgeByKey } from "@/features/badges/catalog";
import { getPreferences, shareBadge, unseenBadges, updateBadge } from "@/features/badges/service";
import { EmptyState, Meta, isLate } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { BriefCard } from "@/features/brief/brief-card";
import { getBrief } from "@/features/brief/service";
import { upcomingEvents } from "@/features/calendar/service";
import { CompleteTask } from "@/features/cockpit/components/complete-task";
import { setPrioritiesAction } from "@/app/(app)/priorites/actions";
import { getDayPriorities, myActiveProjects } from "@/features/cockpit/service";
import { unreadCount } from "@/features/notifications/service";
import { formatMinutes } from "@/features/planning/rules";
import { Elapsed } from "@/features/time/components/timer";
import { getActiveTimer, userTotals } from "@/features/time/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cockpit" };

function weekdayInParis(now = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
}

const DONE = ["TERMINE", "ANNULE"];

/** Garder la suggestion telle quelle : un clic, sans passer par la page de choix. */
async function keepSuggestion(taskIds: string[], formData: FormData) {
  "use server";
  for (const id of taskIds) formData.append("taskIds", id);
  await setPrioritiesAction({ status: "idle" }, formData);
}

/** Célébration vue : le bandeau ne revient pas. */
/** Partager : le badge rejoint le fil du bureau commun, la brigade peut féliciter. */
async function shareBadges(ids: string[]) {
  "use server";
  const user = await requireUser();
  for (const id of ids) await shareBadge(user.id, id);
  revalidatePath("/");
  revalidatePath("/bureau");
}

async function markBadgesSeen(ids: string[]) {
  "use server";
  const user = await requireUser();
  for (const id of ids) await updateBadge(user.id, id, { seen: true });
  revalidatePath("/");
}

async function Priorities({ userId }: { userId: string }) {
  const { tasks, chosen } = await getDayPriorities(userId);
  const xp = new Map(
    (
      await getDb().xpTransaction.findMany({
        where: { userId, sourceType: "task", sourceId: { in: tasks.map((t) => t.id) }, kind: "task.done" },
        select: { sourceId: true, amount: true },
      })
    ).map((x) => [x.sourceId, x.amount]),
  );
  const remaining = tasks.filter((t) => !DONE.includes(t.status)).length;
  return (
    <Card className="gap-3 md:col-span-2">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight">
          <ListChecks aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardTitle>Mes priorités</CardTitle>
          <p className="text-sm text-muted-foreground">
            {chosen
              ? remaining
                ? `${remaining} sur ${tasks.length} encore à faire.`
                : "Les trois sont faites. Belle journée."
              : "Suggestion d'après la priorité et l'échéance : à confirmer."}
          </p>
        </div>
        <span className="text-3xl font-bold tabular-nums" aria-hidden="true">
          {String(tasks.length).padStart(2, "0")}
        </span>
      </div>
      {tasks.length ? (
        <ol className="flex flex-col">
          {tasks.map((t) => {
            const finished = DONE.includes(t.status);
            const late = isLate(t);
            const gained = xp.get(t.id);
            return (
              <li key={t.id} className="flex items-center gap-3 border-t py-2.5">
                <CompleteTask taskId={t.id} title={t.title} done={finished} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={`/taches/${t.id}`}
                    className={cn(
                      "font-bold hover:underline",
                      finished && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="text-[13px] text-muted-foreground">{t.project.name}</span>
                    {t.dueDate && !finished ? (
                      <Meta icon={CalendarDays} tone={late ? "danger" : undefined}>
                        {late ? "En retard · " : ""}
                        {formatDay(t.dueDate)}
                      </Meta>
                    ) : null}
                    {t.estimatedMinutes && !finished ? (
                      <Meta icon={Clock3}>{formatMinutes(t.estimatedMinutes)} prévues</Meta>
                    ) : null}
                    {finished && gained !== undefined ? (
                      <span className="text-[13px] font-bold text-success">+{gained} XP</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState title="Aucune tâche ouverte.">
          Créez une tâche avec le bouton « + » : elle pourra devenir une priorité.
        </EmptyState>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!chosen && tasks.length ? (
          <form
            action={keepSuggestion.bind(
              null,
              tasks.map((t) => t.id),
            )}
          >
            <button
              type="submit"
              className="inline-flex min-h-tap items-center rounded-lg border border-ink bg-highlight px-4 text-sm font-bold text-ink hover:bg-highlight/80"
            >
              Garder ces priorités
            </button>
          </form>
        ) : null}
        <Link
          href="/priorites"
          className="inline-flex min-h-tap items-center rounded-lg border px-4 text-sm font-bold hover:bg-muted"
        >
          {chosen ? "Changer mes priorités" : "Choisir moi-même"}
        </Link>
      </div>
    </Card>
  );
}

async function Cockpit() {
  const user = await requireUser();
  const [celebrate, look, prefs, rituals, brief, unread, active, totals, projects, events, day] =
    await Promise.all([
      unseenBadges(user.id),
      getAvatar(user.id),
      getPreferences(user.id),
      briefingStatus(user.id),
      getBrief(user.id),
      unreadCount(user.id),
      getActiveTimer(user.id),
      userTotals(user.id),
      myActiveProjects(user.id),
      upcomingEvents(user.id),
      getDayPriorities(user.id),
    ]);
  const planned = day.tasks
    .filter((t) => !DONE.includes(t.status))
    .reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
  return (
    <>
      <WokBanner className="min-h-44 md:min-h-52">
        <header className="flex min-h-44 flex-wrap items-end justify-between gap-3 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/10 p-5 text-paper md:min-h-52 md:p-7">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">
              {weekdayInParis()} · cockpit personnel
            </p>
            <h1 className="text-4xl leading-none font-bold tracking-[-0.04em] md:text-6xl">
              Bonjour {user.name}
            </h1>
            <p className="mt-1 -rotate-1 font-hand text-lg text-highlight">
              on s&apos;y met : trois priorités, pas plus.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/appartement"
              aria-label="Mon profil"
              className="rounded-full ring-2 ring-paper/70 hover:ring-highlight"
            >
              <BrigadeAvatar look={look} size={48} />
            </Link>
            <Link
              href="/cockpit"
              className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full bg-paper px-4 text-sm font-bold text-ink hover:bg-highlight"
            >
              <Gauge aria-hidden="true" className="size-4" /> Cockpit agence
            </Link>
          </div>
        </header>
      </WokBanner>

      {celebrate.length ? (
        <section
          aria-labelledby="celebration"
          className={cn(
            "flex flex-col gap-3 rounded-lg border-2 border-ink bg-highlight p-4 sm:flex-row sm:items-center sm:gap-4",
            prefs.celebrations && "animate-in fade-in zoom-in-95 duration-500",
          )}
        >
          <Award
            aria-hidden="true"
            className={cn("size-10 shrink-0", prefs.celebrations && "animate-bounce")}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="celebration" className="text-lg font-bold">
              {celebrate.length > 1 ? `${celebrate.length} nouveaux badges !` : "Nouveau badge !"}
            </h2>
            <ul className="flex flex-col text-sm">
              {celebrate.map((b) => (
                <li key={b.id}>
                  <b>« {badgeByKey(b.badgeKey)?.name ?? b.badgeKey} »</b> — {b.reason}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={shareBadges.bind(
                null,
                celebrate.map((b) => b.id),
              )}
            >
              <button
                type="submit"
                className="inline-flex min-h-tap items-center rounded-md bg-ink px-4 text-sm font-bold text-paper"
              >
                Partager avec l&apos;équipe
              </button>
            </form>
            <form
              action={markBadgesSeen.bind(
                null,
                celebrate.map((b) => b.id),
              )}
            >
              <button
                type="submit"
                className="inline-flex min-h-tap items-center rounded-md border border-ink px-4 text-sm font-bold"
              >
                Garder pour moi
              </button>
            </form>
          </div>
          <Link href="/progression" className="text-sm font-bold underline">
            Ma collection
          </Link>
        </section>
      ) : null}

      <nav aria-label="Rituels" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href="/mise-en-place"
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-2",
            rituals.dailyDone ? "border-border" : "border-ink bg-highlight/50 hover:bg-highlight",
          )}
        >
          <Coffee aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b>Briefing du jour</b>
            <span className="text-sm text-muted-foreground">
              {rituals.dailyDone ? "Faite aujourd'hui · ajuster" : "3 minutes pour lancer la journée"}
            </span>
          </span>
          {rituals.dailyDone ? <Check aria-label="Faite" className="size-4 text-success" /> : null}
        </Link>
        <Link
          href="/service"
          className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-border px-4 py-2 hover:border-ink"
        >
          <UtensilsCrossed aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b>Point hebdo</b>
            <span className="text-sm text-muted-foreground">
              {rituals.weekValidated
                ? "Validé · consulter"
                : rituals.weekOpened
                  ? "Ouvert · à valider"
                  : "Synthèse prête · à ouvrir"}
            </span>
          </span>
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Suspense
          fallback={
            <Card className="md:col-span-2">
              <PageLoading />
            </Card>
          }
        >
          <Priorities userId={user.id} />
        </Suspense>
        <Card className="gap-2">
          <div className="flex items-baseline justify-between">
            <CardTitle>Rendez-vous</CardTitle>
            <Link href="/calendrier" className="text-sm font-bold text-pen-strong hover:underline">
              Calendrier
            </Link>
          </div>
          {events.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {events.slice(0, 4).map((e) => (
                <li key={e.id} className="flex flex-col">
                  <span className="text-muted-foreground">{formatDateTime(e.startsAt)}</span>
                  <Link href={`/calendrier/${e.id}`} className="truncate font-bold hover:underline">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun rendez-vous dans les 14 jours.</p>
          )}
        </Card>
      </div>

      <BriefCard brief={brief} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/notifications"
          className="flex items-start gap-3 rounded-xl border bg-card p-5 hover:border-ink"
        >
          <Inbox aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg leading-tight font-bold">Notifications</span>
            <span className="text-sm text-muted-foreground">Mentions, demandes et changements</span>
          </span>
          <span
            className={cn(
              "inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold",
              unread ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
            )}
          >
            {unread}
            <span className="sr-only"> non lu{unread > 1 ? "s" : ""}</span>
          </span>
        </Link>

        <Card className="gap-2">
          <div className="flex items-baseline justify-between">
            <CardTitle>Le temps</CardTitle>
            <Link href="/temps" className="text-sm font-bold text-pen-strong hover:underline">
              Détail
            </Link>
          </div>
          {active ? (
            <Link
              href={`/taches/${active.taskId}`}
              className="flex min-h-tap items-center gap-2 rounded-lg border-2 border-ink bg-highlight/50 px-3 text-sm font-bold"
            >
              <Timer aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{active.task.title}</span>
              <Elapsed startedAt={active.startedAt!.toISOString()} />
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun chronomètre en cours.</p>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Suivi aujourd&apos;hui</dt>
              <dd className="text-xl font-bold">{formatMinutes(totals.today)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Prévu (priorités)</dt>
              <dd className="text-xl font-bold">{planned ? formatMinutes(planned) : "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="gap-2">
        <div className="flex items-baseline justify-between">
          <CardTitle>Mes projets</CardTitle>
          <Link href="/projets" className="text-sm font-bold text-pen-strong hover:underline">
            Tous les projets
          </Link>
        </div>
        {projects.length ? (
          <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {projects.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="border-b last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
              >
                <Link href={`/projets/${p.id}`} className="group flex min-h-14 items-center gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold group-hover:underline">{p.name}</span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {p.blocked ? (
                        <b className="text-danger">
                          {p.blocked} bloquée{p.blocked > 1 ? "s" : ""} ·{" "}
                        </b>
                      ) : null}
                      {p.next
                        ? `Prochaine échéance ${formatDay(p.next.dueDate)} : ${p.next.title}`
                        : `${p.open} tâche${p.open > 1 ? "s" : ""} ouverte${p.open > 1 ? "s" : ""}`}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aucun projet actif.">
            Les projets dont vous êtes responsable apparaîtront ici.
          </EmptyState>
        )}
      </Card>

      <Link href="/maison" className="group flex flex-col gap-2 rounded-lg bg-ink p-5 text-paper">
        <span className="flex items-center justify-between">
          <span className="text-xl font-bold">Le bâtiment</span>
          <ArrowUpRight aria-hidden="true" className="size-5 text-highlight" />
        </span>
        <span className="text-paper/80">Mon profil · Équipe · Clients · Production · Méthodes & modèles</span>
        <span className="font-bold text-highlight group-hover:underline">EXPLORER LES ESPACES →</span>
      </Link>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageLoading />}>
        <Cockpit />
      </Suspense>
    </div>
  );
}
