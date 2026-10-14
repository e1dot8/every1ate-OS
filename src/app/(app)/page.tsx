import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gauge } from "lucide-react";
import { EmptyState, TaskRow, isLate } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { comparePriority, formatMinutes, isDueSoon } from "@/features/planning/rules";
import { listTasksForUser } from "@/features/projects/service";
import { userTotals } from "@/features/time/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, todayDate } from "@/lib/dates";
import { upcomingEvents } from "@/features/calendar/service";
import { BriefCard } from "@/features/brief/brief-card";
import { getBrief } from "@/features/brief/service";

export const metadata: Metadata = { title: "Mon espace" };

function todayInParis(now = new Date()) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Section({ title, children, href }: { title: string; children: React.ReactNode; href?: string }) {
  return (
    <Card className="gap-2">
      <div className="flex items-baseline justify-between">
        <CardTitle>{title}</CardTitle>
        {href ? (
          <Link href={href} className="text-sm font-bold text-pen-strong hover:underline">
            Tout voir
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const today = todayDate();
  const [tasks, totals, events, brief] = await Promise.all([
    listTasksForUser(user.id),
    userTotals(user.id),
    upcomingEvents(user.id),
    getBrief(user.id),
  ]);
  const late = tasks.filter((t) => isLate(t));
  const soon = tasks.filter((t) => isDueSoon(t.dueDate, today));
  const stuck = tasks.filter((t) => t.status === "BLOQUE" || t.status === "EN_ATTENTE");
  const priority = [...tasks]
    .filter((t) => !stuck.includes(t))
    .sort(
      (a, b) =>
        comparePriority(b.priority, a.priority) ||
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    )
    .slice(0, 5);
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <PageHeader title={`Bonjour ${user.name}`} description={todayInParis()} />
        <Link href="/cockpit" className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold hover:bg-muted">
          <Gauge aria-hidden="true" className="size-4" /> Cockpit
        </Link>
      </div>
      <BriefCard brief={brief} />
      <div className="grid grid-cols-3 gap-3">
        <Card className="gap-0.5 py-3">
          <p className="text-xs text-muted-foreground">En retard</p>
          <p className={late.length ? "text-2xl font-bold text-danger" : "text-2xl font-bold"}>
            {late.length}
          </p>
        </Card>
        <Card className="gap-0.5 py-3">
          <p className="text-xs text-muted-foreground">Aujourd&apos;hui</p>
          <p className="text-2xl font-bold">{formatMinutes(totals.today)}</p>
        </Card>
        <Card className="gap-0.5 py-3">
          <p className="text-xs text-muted-foreground">Semaine</p>
          <p className="text-2xl font-bold">{formatMinutes(totals.week)}</p>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Mes tâches prioritaires" href="/taches">
          {priority.length ? (
            <ul className="flex flex-col">
              {priority.map((t) => (
                <TaskRow key={t.id} task={t} showProject />
              ))}
            </ul>
          ) : (
            <EmptyState title="Rien de prioritaire.">
              Les tâches qui vous sont assignées apparaîtront ici.
            </EmptyState>
          )}
        </Section>
        <Section title="Échéances en retard et à venir">
          {late.length || soon.length ? (
            <ul className="flex flex-col">
              {[...late, ...soon.filter((t) => !late.includes(t))].map((t) => (
                <TaskRow key={t.id} task={t} showProject />
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucune échéance proche." />
          )}
        </Section>
        <Section title="Bloquées ou en attente">
          {stuck.length ? (
            <ul className="flex flex-col">
              {stuck.map((t) => (
                <TaskRow key={t.id} task={t} showProject />
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucune tâche bloquée." />
          )}
        </Section>
        <Section title="Prochains rendez-vous" href="/calendrier">
          {events.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="text-muted-foreground">{formatDateTime(e.startsAt)} · </span>
                  <Link href={`/calendrier/${e.id}`} className="font-bold hover:underline">
                    {e.title}
                  </Link>
                  {e.location ? <span className="text-muted-foreground"> · {e.location}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun rendez-vous dans les 14 jours." />
          )}
        </Section>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageLoading />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
