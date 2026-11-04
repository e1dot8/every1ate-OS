import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, NotionPage } from "@/components/notion/blocks";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, parseDateInput, todayDate } from "@/lib/dates";
import { MorningReportView, ReportPicker } from "@/features/qg/morning/components";
import {
  getMorningReport,
  listMorningReports,
  previewMorningReport,
  todayMorningReport,
  type StoredMorningReport,
} from "@/features/qg/morning/service";

export const metadata: Metadata = { title: "Le point du matin" };

type Search = { date?: string | string[]; vue?: string | string[] };

/** « lundi 1 janvier 2001 » pour une date calendrier. */
const longDay = (day: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(day);

function Stored({ report }: { report: StoredMorningReport }) {
  if (!report.data)
    return (
      <Callout icon="⚠️" tone="warning">
        Ce point a été enregistré dans un format qui n&apos;est plus lisible.
      </Callout>
    );
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Publié le {formatDateTime(report.createdAt)}
        {report.messageId ? " dans la Salle commune" : ""}.
      </p>
      <MorningReportView report={report.data} />
    </>
  );
}

async function Preview({ now, intro }: { now: Date; intro?: React.ReactNode }) {
  const report = await previewMorningReport(now);
  return (
    <>
      {intro}
      <Callout icon="👀" tone="info">
        <p role="status">
          <b>Aperçu en direct</b> : calculé à l&apos;instant, ni enregistré ni envoyé.
        </p>
      </Callout>
      <MorningReportView report={report} />
    </>
  );
}

async function MorningPoint({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const today = todayDate(now).toISOString().slice(0, 10);
  const preview = sp.vue === "apercu";
  // Un autre jour qu'aujourd'hui (aujourd'hui : vue par défaut).
  const asked =
    !preview && typeof sp.date === "string" && sp.date !== today && parseDateInput(sp.date) ? sp.date : null;
  // D'abord le point du jour (publié ici s'il est dû et manquant), puis l'historique.
  const todays = await todayMorningReport(now);
  const history = await listMorningReports(10);
  const selected = preview ? null : asked ? await getMorningReport(asked) : todays;
  const current = preview ? "apercu" : (asked ?? (todays ? today : "apercu"));

  return (
    <>
      <ReportPicker dates={history.map((r) => r.date)} today={today} current={current} />
      {selected ? (
        <Stored report={selected} />
      ) : asked ? (
        <Callout icon="🗓️">
          Aucun point publié le {longDay(parseDateInput(asked)!)}. Les points partent à 8 h, du lundi au
          vendredi.
        </Callout>
      ) : (
        <Preview
          now={now}
          intro={
            preview ? null : (
              <Callout icon="☀️">
                <p>
                  <b>Publié à 8 h, du lundi au vendredi</b>, dans la Salle commune, avec une alerte pour
                  chacun (push et WhatsApp selon vos réglages dans Alertes).
                </p>
              </Callout>
            )
          }
        />
      )}
    </>
  );
}

export default function MorningPointPage({ searchParams }: PageProps<"/qg/point">) {
  return (
    <NotionPage
      icon="☀️"
      crumbs={[{ label: "QG", href: "/" }, { label: "Le point du matin" }]}
      title="Le point du matin"
      description="Chaque jour ouvré : ce qui a avancé depuis le dernier point, ce qui reste et ce qui coince."
      actions={
        <Link
          href="/discussions/general"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-sm font-bold hover:bg-muted"
        >
          <MessagesSquare aria-hidden="true" className="size-4" /> Salle commune
        </Link>
      }
    >
      <Suspense fallback={<PageLoading />}>
        <MorningPoint searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </NotionPage>
  );
}
