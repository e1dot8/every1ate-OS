import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageCircleHeart } from "lucide-react";
import { Avatar } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Section, Toggle } from "@/components/notion/blocks";
import { requireUser } from "@/lib/auth/session";
import { formatWeekday, todayDate } from "@/lib/dates";
import { StandupForm } from "@/features/qg/components/standup-form";
import { standupDraft, standupHistory } from "@/features/qg/service";
import { listStandups } from "@/features/qg/standup";

export const metadata: Metadata = { title: "Stand-up" };

type Entry = { id: string; today: string | null; blocked: string | null; user: { id: string; name: string } };

function StandupEntryView({ entry, viewerId }: { entry: Entry; viewerId: string }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border-b px-1 py-3 last:border-b-0 hover:bg-muted/60">
      <span className="inline-flex items-center gap-2 font-bold">
        <Avatar name={entry.user.name} />
        {entry.user.name}
      </span>
      {entry.today ? (
        <p className="text-sm whitespace-pre-line">
          <span className="font-bold">Aujourd&apos;hui : </span>
          {entry.today}
        </p>
      ) : null}
      {entry.blocked ? (
        <p className="text-sm whitespace-pre-line text-danger">
          <span className="font-bold">Bloqué : </span>
          {entry.blocked}
        </p>
      ) : null}
      {entry.blocked && entry.user.id !== viewerId ? (
        <div>
          <Link
            href={`/discussions/direct/${entry.user.id}`}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border-2 border-ink px-3 text-sm font-bold hover:bg-highlight/60"
          >
            <MessageCircleHeart aria-hidden="true" className="size-4" /> Proposer mon aide
          </Link>
        </div>
      ) : null}
    </li>
  );
}

async function Standup() {
  const user = await requireUser();
  const now = new Date();
  const today = todayDate(now);
  const [entries, draft, history] = await Promise.all([
    listStandups(today),
    standupDraft(user.id, now),
    standupHistory(now),
  ]);
  const mine = entries.find((e) => e.userId === user.id);
  return (
    <>
      <Section id="mon-standup" title="Mon stand-up">
        <StandupForm
          today={mine ? (mine.today ?? "") : draft.today}
          blocked={mine ? (mine.blocked ?? "") : draft.blocked}
          published={!!mine}
        />
      </Section>
      <Section id="du-jour" title="Stand-ups du jour" count={entries.length}>
        {entries.length ? (
          <ul className="flex flex-col">
            {entries.map((e) => (
              <StandupEntryView key={e.id} entry={e} viewerId={user.id} />
            ))}
          </ul>
        ) : (
          <EmptyLine>Personne n&apos;a encore publié aujourd&apos;hui.</EmptyLine>
        )}
      </Section>
      <Section id="historique" title="7 derniers jours">
        {history.length ? (
          <div className="flex flex-col">
            {history.map((day) => (
              <Toggle
                key={day.date.toISOString()}
                title={formatWeekday(day.date)}
                meta={`${day.entries.length} stand-up${day.entries.length > 1 ? "s" : ""}`}
              >
                <ul className="flex flex-col">
                  {day.entries.map((e) => (
                    <StandupEntryView key={e.id} entry={e} viewerId={user.id} />
                  ))}
                </ul>
              </Toggle>
            ))}
          </div>
        ) : (
          <EmptyLine>Aucun stand-up les 7 derniers jours.</EmptyLine>
        )}
      </Section>
    </>
  );
}

export default function StandupPage() {
  return (
    <NotionPage
      icon="☀️"
      crumbs={[{ label: "QG", href: "/" }, { label: "Stand-up" }]}
      title="Stand-up"
      description="Trente secondes par jour : ce que je fais, ce qui me bloque. Un blocage devient une demande d'aide."
    >
      <Callout icon="📝">
        Le brouillon reprend vos tâches en cours et celles à rendre aujourd&apos;hui, et les motifs de vos
        tâches bloquées. Les stand-ups du jour sont visibles des trois associés.
      </Callout>
      <Suspense fallback={<PageLoading />}>
        <Standup />
      </Suspense>
    </NotionPage>
  );
}
