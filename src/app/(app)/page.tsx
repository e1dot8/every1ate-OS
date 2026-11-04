import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gauge, ListChecks, Sparkles } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { NotionPage } from "@/components/notion/blocks";
import { requireUser } from "@/lib/auth/session";
import { BriefCard } from "@/features/brief/brief-card";
import { getBrief } from "@/features/brief/service";
import { UpcomingDeliverables } from "@/features/deliverables/components/upcoming";
import { effectivePresence, presenceDot, presenceText } from "@/features/presence/rules";
import { getPresence } from "@/features/presence/service";
import {
  DeskSection,
  HandoffsSection,
  QuestsSection,
  TeamSection,
  ToTakeSection,
} from "@/features/qg/components/sections";
import { listPendingHandoffs } from "@/features/qg/handoffs";
import { MorningReportBanner } from "@/features/qg/morning/components";
import { myDesk, tasksToTake, teamToday, weekQuests } from "@/features/qg/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "QG" };

function todayInParis(now: Date) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const actionClass =
  "inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-sm font-bold hover:bg-muted";

/** Le QG : ce qui compte aujourd'hui, mon bureau, les passations, l'équipe, le tas et les quêtes. */
async function Qg() {
  const user = await requireUser();
  const now = new Date();
  const [brief, presence, desk, handoffs, team, toTake, quests] = await Promise.all([
    getBrief(user.id),
    getPresence(user.id),
    myDesk(user.id),
    listPendingHandoffs(user.id),
    teamToday(user.id, now),
    tasksToTake(),
    weekQuests(now),
  ]);
  const mine = presence ? effectivePresence(presence, now, true) : null;
  return (
    <NotionPage
      icon="🏠"
      title={`Bonjour ${user.name}`}
      description={
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{todayInParis(now)}</span>
          {mine ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">·</span>
              <span aria-hidden="true" className={cn("size-2 rounded-full", presenceDot[mine.state])} />
              <span data-testid="ma-presence">{presenceText(mine)}</span>
              {!mine.shared ? <span className="text-xs">(non partagé)</span> : null}
            </span>
          ) : null}
        </p>
      }
      actions={
        <>
          <Link href="/qg/standup" className={actionClass}>
            <Sparkles aria-hidden="true" className="size-4" /> Stand-up
          </Link>
          <Link href="/qg/menage" className={actionClass}>
            <ListChecks aria-hidden="true" className="size-4" /> Grand ménage
          </Link>
          <Link href="/cockpit" className={actionClass}>
            <Gauge aria-hidden="true" className="size-4" /> Cockpit
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <MorningReportBanner />
      </Suspense>
      <BriefCard brief={brief} />
      <DeskSection desk={desk} />
      <Suspense fallback={<PageLoading />}>
        <UpcomingDeliverables userId={user.id} />
      </Suspense>
      <HandoffsSection received={handoffs.received} sent={handoffs.sent} />
      <TeamSection team={team} />
      <ToTakeSection toTake={toTake} />
      <QuestsSection {...quests} />
    </NotionPage>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Qg />
    </Suspense>
  );
}
