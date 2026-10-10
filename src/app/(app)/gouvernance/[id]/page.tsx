import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { VoteForm } from "@/features/finance/components/forms";
import { getDecision } from "@/features/finance/governance";
import { decisionKindLabels, decisionStatusLabels, voteLabels } from "@/features/finance/labels";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatDay } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { cancelDecisionAction } from "../../finance/actions";

export const metadata: Metadata = { title: "Décision" };

function Values({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <span className="text-muted-foreground">—</span>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">
            {(
              {
                revenue: "Revenus HT",
                cost: "Coûts HT",
                plannedEndDate: "Fin prévue",
                description: "Description",
              } as Record<string, string>
            )[k] ?? k}
          </dt>
          <dd className="font-bold">
            {(k === "revenue" || k === "cost") && typeof v === "string"
              ? formatMoney(toCents(v))
              : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)
                ? formatDay(new Date(v))
                : String(v ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function DecisionView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const d = await getDecision(id);
  if (!d) notFound();
  const mine = d.votes.find((v) => v.userId === user.id);
  const pour = d.votes.filter((v) => v.choice === "POUR").length;
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{d.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusBadge
            tone={
              d.status === "APPROUVEE"
                ? "success"
                : d.status === "REFUSEE"
                  ? "danger"
                  : d.status === "OUVERTE"
                    ? "warning"
                    : "neutral"
            }
            label={decisionStatusLabels[d.status]}
          />
          <span>{decisionKindLabels[d.kind]}</span>
          <Link href={`/projets/${d.project.id}`} className="underline">
            {d.project.name}
          </Link>
          <span className="text-muted-foreground">
            demandée par {d.createdBy.name} le {formatDateTime(d.createdAt)}
          </span>
        </div>
      </header>
      <Card className="gap-3">
        <CardTitle>Changement</CardTitle>
        <p className="whitespace-pre-line">{d.explanation}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-annotation text-sm text-pen-strong">Avant</p>
            <Values value={d.before} />
          </div>
          <div>
            <p className="font-annotation text-sm text-pen-strong">Après</p>
            <Values value={d.after} />
          </div>
        </div>
        {d.consequences ? (
          <p className="text-sm">
            <b>Conséquences :</b> {d.consequences}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {pour}/{d.requiredApprovals} avis favorables requis{d.blocking ? " · bloquant" : " · informatif"}.
          Règle de majorité à confirmer par les associés.
        </p>
      </Card>
      <Card className="gap-3">
        <CardTitle>Avis</CardTitle>
        <ul className="flex flex-col gap-1.5 text-sm" aria-label="Avis enregistrés">
          {d.votes.map((v) => (
            <li key={v.id}>
              <b>{v.user.name}</b> : {voteLabels[v.choice]}{" "}
              <span className="text-muted-foreground">({formatDateTime(v.createdAt)})</span>
              {v.comment ? <span className="block text-muted-foreground">« {v.comment} »</span> : null}
            </li>
          ))}
          {!d.votes.length ? (
            <li className="text-muted-foreground">Aucun avis pour l&apos;instant.</li>
          ) : null}
        </ul>
        {d.status === "OUVERTE" ? <VoteForm decisionId={id} current={mine?.choice} /> : null}
        {d.status === "OUVERTE" && d.createdBy.id === user.id ? (
          <form action={cancelDecisionAction}>
            <input type="hidden" name="decisionId" value={id} />
            <SubmitButton variant="ghost">Retirer ma demande</SubmitButton>
          </form>
        ) : null}
      </Card>
    </>
  );
}

export default function DecisionPage({ params }: PageProps<"/gouvernance/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/gouvernance">Gouvernance</BackLink>
      <Suspense fallback={<PageLoading />}>
        <DecisionView params={params} />
      </Suspense>
    </div>
  );
}
