import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { Avatar, Meta, TaskStatusBadge } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Section } from "@/components/notion/blocks";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { MenageForm } from "@/features/qg/components/menage-row";
import { DUST_DAYS, dustyTasks } from "@/features/qg/service";

export const metadata: Metadata = { title: "Grand ménage" };

function isFridayInParis(now: Date) {
  return (
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(now) === "Fri"
  );
}

async function Menage() {
  await requireUser();
  const now = new Date();
  const tasks = await dustyTasks(now);
  return (
    <>
      <Callout icon="🧹" tone={isFridayInParis(now) ? "warning" : "neutral"}>
        <p className="font-bold">
          {isFridayInParis(now) ? "C'est vendredi : grand ménage aujourd'hui !" : "Grand ménage du vendredi"}
        </p>
        <p>
          Vingt minutes ensemble, le vendredi après-midi, pour trancher chaque tâche qui prend la poussière :
          la terminer, la mettre en attente ou la bloquer avec un motif, la découper ou l&apos;annuler.
        </p>
      </Callout>
      <Section id="poussiere" title="Prennent la poussière" count={tasks.length}>
        {tasks.length ? (
          <ul className="flex flex-col">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-md border-b px-1 py-3 last:border-b-0 hover:bg-muted/60"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/taches/${t.id}`} className="min-w-0 font-bold break-words hover:underline">
                    {t.title}
                  </Link>
                  <TaskStatusBadge status={t.status} />
                  <span className="text-[13px] text-muted-foreground">{t.project.name}</span>
                  {t.dueDate ? <Meta icon={CalendarDays}>{formatDay(t.dueDate)}</Meta> : null}
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <Avatar name={t.owner?.name} className="size-6" />
                    {t.owner?.name ?? "Sans responsable"}
                  </span>
                </div>
                <p className="font-annotation text-sm text-pen-strong">
                  Sans activité depuis {t.idleDays} jours
                </p>
                <MenageForm taskId={t.id} title={t.title} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>
            Rien ne prend la poussière : aucune tâche ouverte sans activité depuis {DUST_DAYS} jours.
          </EmptyLine>
        )}
      </Section>
    </>
  );
}

export default function MenagePage() {
  return (
    <NotionPage
      icon="🧹"
      crumbs={[{ label: "QG", href: "/" }, { label: "Grand ménage" }]}
      title="Grand ménage"
      description={`Les tâches ouvertes sans aucune activité (modification, temps saisi, commentaire) depuis ${DUST_DAYS} jours ou plus.`}
    >
      <Suspense fallback={<PageLoading />}>
        <Menage />
      </Suspense>
    </NotionPage>
  );
}
