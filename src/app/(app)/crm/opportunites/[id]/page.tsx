import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive, ExternalLink, FolderKanban, Pencil, Trophy } from "lucide-react";
import { Avatar, BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityForm, NextActionForm, StageForm } from "@/features/crm/components/forms";
import { activityLabels, effectiveProbability, sourceLabels, stageLabels } from "@/features/crm/rules";
import { getOpportunity, getStageSettings } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatDay, toDateInput, todayDate } from "@/lib/dates";
import { formatMoney, percentOf, toCents } from "@/lib/money";
import { archiveOpportunityAction } from "../../actions";

export const metadata: Metadata = { title: "Opportunité" };

async function OpportunityView({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [opp, settings] = await Promise.all([getOpportunity(id), getStageSettings()]);
  if (!opp || opp.archivedAt) notFound();
  const amount = toCents(opp.amount);
  const p = effectiveProbability(opp.stage, opp.probability, settings);
  const today = todayDate();
  const late = opp.nextActionDate && opp.nextActionDate < today && !["GAGNE", "PERDU"].includes(opp.stage);
  const tone = opp.stage === "GAGNE" ? "success" : opp.stage === "PERDU" ? "danger" : "info";
  return (
    <>
      <BackLink href="/crm">CRM</BackLink>
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{opp.title}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/crm/clients/${opp.client.id}`} className="hover:underline">
              {opp.client.name}
            </Link>
            {opp.contact ? ` · ${opp.contact.firstName} ${opp.contact.lastName}` : ""}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/crm/opportunites/${id}/modifier`}>
            <Pencil aria-hidden="true" /> Modifier
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={tone} label={stageLabels[opp.stage]} />
        <span className="inline-flex items-center gap-2 text-[13px]">
          <Avatar name={opp.owner.name} /> {opp.owner.name} · responsable commercial
        </span>
      </div>

      {opp.stage === "GAGNE" && !opp.project ? (
        <FormAlert tone="success" title="Opportunité gagnée : créer le projet ?">
          <p>
            Les informations du CRM seront préremplies. Vous choisirez le modèle, le responsable global et les
            dates.
          </p>
          <Button asChild className="mt-2">
            <Link href={`/crm/opportunites/${id}/convertir`}>
              <Trophy aria-hidden="true" /> Convertir en projet
            </Link>
          </Button>
        </FormAlert>
      ) : null}
      {opp.project ? (
        <FormAlert tone="info" title="Convertie en projet">
          <Link
            href={`/projets/${opp.project.id}`}
            className="inline-flex items-center gap-1 font-bold underline"
          >
            <FolderKanban aria-hidden="true" className="size-4" /> {opp.project.name}
          </Link>
        </FormAlert>
      ) : null}
      {opp.stage === "PERDU" && opp.lossReason ? (
        <FormAlert tone="danger" title={`Perdue : ${opp.lossReason}`} />
      ) : null}

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <aside className="order-first flex w-full flex-col gap-4 md:order-last md:w-80">
          <Card className="gap-0 py-2">
            {[
              ["Montant HT", opp.amount ? formatMoney(amount) : "—"],
              [
                "Probabilité",
                `${p} %${opp.probability == null && !["GAGNE", "PERDU"].includes(opp.stage) ? " (étape)" : ""}`,
              ],
              ["Pondéré", opp.amount ? formatMoney(percentOf(amount, p)) : "—"],
              ["Clôture estimée", formatDay(opp.expectedCloseDate)],
              ["Source", opp.source ? sourceLabels[opp.source] : "—"],
              ["Prochaine action", opp.nextAction ?? "—"],
              [
                "Relance",
                opp.nextActionDate ? `${formatDay(opp.nextActionDate)}${late ? " · en retard" : ""}` : "—",
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <b className={k === "Relance" && late ? "text-right text-danger" : "text-right"}>{v}</b>
              </div>
            ))}
          </Card>
          {opp.contact ? (
            <Card className="gap-1 text-sm">
              <CardTitle>Contact</CardTitle>
              <p className="font-bold">
                {opp.contact.firstName} {opp.contact.lastName}
              </p>
              {opp.contact.role ? <p className="text-muted-foreground">{opp.contact.role}</p> : null}
              {opp.contact.email ? (
                <a href={`mailto:${opp.contact.email}`} className="underline">
                  {opp.contact.email}
                </a>
              ) : null}
              {opp.contact.phone ? (
                <a href={`tel:${opp.contact.phone}`} className="underline">
                  {opp.contact.phone}
                </a>
              ) : null}
            </Card>
          ) : null}
          <form action={archiveOpportunityAction}>
            <input type="hidden" name="opportunityId" value={id} />
            <SubmitButton variant="ghost">
              <Archive aria-hidden="true" /> Archiver
            </SubmitButton>
          </form>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card className="gap-3">
            <CardTitle>Étape du pipeline</CardTitle>
            <StageForm opportunityId={id} stage={opp.stage} />
          </Card>
          <Card className="gap-3">
            <CardTitle>Prochaine action</CardTitle>
            <NextActionForm
              opportunityId={id}
              nextAction={opp.nextAction ?? ""}
              nextActionDate={toDateInput(opp.nextActionDate)}
            />
          </Card>
          <Card className="gap-3">
            <CardTitle>Historique</CardTitle>
            <ol className="flex flex-col gap-3" aria-label="Historique de l'opportunité">
              {opp.activities.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 border-b pb-3 text-sm last:border-b-0">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(a.occurredAt)} · {a.author?.name ?? "Système"} · {activityLabels[a.kind]}
                  </span>
                  {a.kind === "ETAPE" && a.toStage ? (
                    <b>
                      {a.fromStage
                        ? `${stageLabels[a.fromStage]} → ${stageLabels[a.toStage]}`
                        : stageLabels[a.toStage]}
                    </b>
                  ) : null}
                  {a.body ? <p className="whitespace-pre-line">{a.body}</p> : null}
                  {a.fileUrl ? (
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold underline"
                    >
                      <ExternalLink aria-hidden="true" className="size-3.5" /> Proposition
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
            <details>
              <summary className="min-h-tap cursor-pointer py-2 font-bold">
                Ajouter un échange, une réunion, une note…
              </summary>
              <ActivityForm opportunityId={id} today={toDateInput(today)} />
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function OpportunityPage({ params }: PageProps<"/crm/opportunites/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <OpportunityView params={params} />
      </Suspense>
    </div>
  );
}
