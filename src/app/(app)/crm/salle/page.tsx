import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, CalendarDays, SlidersHorizontal } from "lucide-react";
import { Avatar, BackLink, Chip, EmptyState, Meta, Tabs } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { priorityWord, viewDescriptions, viewLabels, type SituationView } from "@/features/crm/situations";
import { loadSituations } from "@/features/crm/situations-service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients à suivre" };

const VIEWS: { key: SituationView; param: string }[] = [
  { key: "A_RISQUE", param: "a-risque" },
  { key: "EN_ATTENTE", param: "en-attente" },
  { key: "A_ENCAISSER", param: "a-encaisser" },
  { key: "A_DEVELOPPER", param: "a-developper" },
];

async function Kitchen({ searchParams }: { searchParams: Promise<{ vue?: string; moi?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { situations, thresholds } = await loadSituations();
  const mine = sp.moi === "1";
  const visible = mine ? situations.filter((s) => s.owner?.id === user.id) : situations;
  const view = VIEWS.find((v) => v.param === sp.vue) ?? VIEWS[0];
  const list = visible.filter((s) => s.view === view.key);
  const href = (vue: string, moi: boolean) => `/crm/salle?vue=${vue}${moi ? "&moi=1" : ""}`;
  const today = todayDate();
  return (
    <>
      <Tabs
        active={view.key}
        items={VIEWS.map((v) => ({
          key: v.key,
          label: `${viewLabels[v.key]} · ${visible.filter((s) => s.view === v.key).length}`,
          href: href(v.param, mine),
        }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip href={href(view.param, false)} active={!mine}>
          Toute la brigade
        </Chip>
        <Chip href={href(view.param, true)} active={mine}>
          Les miennes
        </Chip>
      </div>
      <p className="text-sm text-muted-foreground">{viewDescriptions[view.key]}</p>

      {list.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((s) => (
            <li key={s.key}>
              <Card className="h-full gap-2 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-annotation text-xs text-pen-strong">{s.rule}</span>
                    <Link href={s.href} className="font-bold hover:underline">
                      {s.title}
                    </Link>
                    {s.client ? <span className="text-sm text-muted-foreground">{s.client}</span> : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                      s.priority === 3
                        ? "bg-danger-soft text-danger"
                        : s.priority === 2
                          ? "bg-warning-soft text-warning"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {priorityWord[s.priority]}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="sr-only">Pourquoi : </span>
                  {s.reason}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2">
                  <Avatar name={s.owner?.name ?? null} />
                  <span className="text-sm">
                    <span className="text-muted-foreground">{s.owner ? s.owner.name : "À attribuer"} · </span>
                    <b>{s.nextAction}</b>
                  </span>
                  {s.dueDate ? (
                    <Meta icon={CalendarDays} tone={s.dueDate < today ? "danger" : undefined}>
                      {formatDay(s.dueDate)}
                    </Meta>
                  ) : null}
                  <Link
                    href={s.href}
                    aria-label={`Ouvrir : ${s.title}`}
                    className="ml-auto inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
                  >
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={`Rien « ${viewLabels[view.key].toLowerCase()} » ${mine ? "pour vous" : ""}.`}>
          La cuisine est propre de ce côté.
        </EmptyState>
      )}

      <Card className="gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle>Les règles de la cuisine</CardTitle>
          <Link
            href="/crm/reglages"
            className="inline-flex items-center gap-1 text-sm font-bold text-pen-strong hover:underline"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" /> Régler les seuils
          </Link>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>
            <b>À risque</b> : prochaine action dépassée ; sinon signature attendue dépassée ; sinon aucun
            échange depuis {thresholds.silenceDays} jours ; ou projet clôturé il y a moins de 6 mois avec une
            satisfaction ≤ {thresholds.lowSatisfaction}/5.
          </li>
          <li>
            <b>En attente</b> : proposition envoyée ou négociation, relance pas encore due.
          </li>
          <li>
            <b>À encaisser</b> : facture prévue dans les {thresholds.billingHorizonDays} jours (ou en retard),
            ou facture émise non soldée (paiement attendu à {thresholds.paymentTermDays} jours).
          </li>
          <li>
            <b>À développer</b> : contrat à renouveler (≤ 60 jours), suite d&apos;un projet réussi (≤ 120
            jours), client sans activité depuis 180 jours.
          </li>
        </ul>
      </Card>
    </>
  );
}

export default function DiningRoomPage({ searchParams }: PageProps<"/crm/salle">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/crm">CRM</BackLink>
      <PageHeader
        crumb="La Salle · ce qui demande une action"
        title="Clients à suivre"
        description="Chaque entrée dit pourquoi elle est là, qui s'en charge, et la prochaine action."
      />
      <Suspense fallback={<PageLoading />}>
        <Kitchen searchParams={searchParams as Promise<{ vue?: string; moi?: string }>} />
      </Suspense>
    </div>
  );
}
