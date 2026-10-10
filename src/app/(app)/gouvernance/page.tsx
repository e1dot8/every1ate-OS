import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { GovernanceForm } from "@/features/finance/components/forms";
import { getGovernance, listDecisions } from "@/features/finance/governance";
import { decisionKindLabels, decisionStatusLabels } from "@/features/finance/labels";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Gouvernance" };

async function Governance() {
  const user = await requireUser();
  const [rules, decisions, associates] = await Promise.all([
    getGovernance(),
    listDecisions(),
    getDb().user.count({ where: { role: "associe" } }),
  ]);
  const unset = rules.budgetOverrunPct == null && rules.delayPct == null && rules.delayMinDays == null;
  return (
    <>
      {unset ? (
        <FormAlert tone="warning" title="Seuils non définis">
          Aucune validation collective n&apos;est déclenchée automatiquement tant que les associés n&apos;ont
          pas fixé les seuils. La règle de majorité/quorum reste à confirmer.
        </FormAlert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>Décisions</CardTitle>
          <ul className="flex flex-col">
            {decisions.map((d) => {
              const mine = d.votes.find((v) => v.userId === user.id);
              return (
                <li key={d.id} className="flex flex-col gap-1 border-b py-2.5 text-sm last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/gouvernance/${d.id}`} className="flex-1 font-bold hover:underline">
                      {d.title}
                    </Link>
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
                  </div>
                  <span className="text-muted-foreground">
                    {decisionKindLabels[d.kind]} · {d.project.name} · {formatDay(d.createdAt)} ·{" "}
                    {d.votes.filter((v) => v.choice === "POUR").length}/{d.requiredApprovals} avis favorables
                    {d.status === "OUVERTE" && !mine ? " · votre avis est attendu" : ""}
                  </span>
                </li>
              );
            })}
            {!decisions.length ? (
              <li className="text-sm text-muted-foreground">Aucune demande de décision.</li>
            ) : null}
          </ul>
        </Card>
        <Card className="gap-3">
          <CardTitle>Seuils et règles</CardTitle>
          <GovernanceForm rules={rules} associates={associates} />
        </Card>
      </div>
    </>
  );
}

export default function GovernancePage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance">Finance</BackLink>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Gouvernance"
          description="Validation collective des changements significatifs (budget, planning, périmètre)."
        />
        <Button asChild>
          <Link href="/gouvernance/nouvelle">
            <Plus aria-hidden="true" /> Demande de décision
          </Link>
        </Button>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Governance />
      </Suspense>
    </div>
  );
}
