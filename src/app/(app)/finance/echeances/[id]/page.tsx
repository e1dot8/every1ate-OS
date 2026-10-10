import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { X } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { billingState, billingStateLabels } from "@/features/finance/calc";
import { BillingForm, PaymentForm } from "@/features/finance/components/forms";
import { projectLots } from "@/features/finance/page-helpers";
import { getBilling } from "@/features/finance/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, toDateInput, todayDate } from "@/lib/dates";
import { formatMoney, moneyInput, toCents } from "@/lib/money";
import { deletePaymentAction } from "../../actions";

export const metadata: Metadata = { title: "Échéance" };

async function BillingView({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const b = await getBilling(id);
  if (!b || b.archivedAt) notFound();
  const today = todayDate();
  const paid = b.payments.reduce((n, p) => n + toCents(p.amount), 0);
  const state = billingState(
    { amount: toCents(b.amount), status: b.status, plannedDate: b.plannedDate },
    paid,
    today,
  );
  return (
    <>
      <BackLink href={`/projets/${b.projectId}?onglet=finance`}>{b.project.name}</BackLink>
      <PageHeader
        title={b.label}
        description={`${formatMoney(toCents(b.amount))} HT · encaissé ${formatMoney(paid)} · reste ${formatMoney(Math.max(0, toCents(b.amount) - paid))}`}
      />
      <div>
        <StatusBadge
          tone={
            state === "ENCAISSE"
              ? "success"
              : state === "EN_RETARD"
                ? "danger"
                : state === "PARTIELLEMENT_ENCAISSE"
                  ? "warning"
                  : "info"
          }
          label={billingStateLabels[state]}
        />
      </div>
      <Card className="max-w-3xl gap-3">
        <CardTitle>Encaissements</CardTitle>
        <ul className="flex flex-col">
          {b.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0">
              <span className="flex-1">
                {formatDay(p.receivedAt)} · <b>{formatMoney(toCents(p.amount))}</b>
                {p.reference ? ` · ${p.reference}` : ""}
                {p.source === "IMPORT" ? " · importé" : ""}
              </span>
              <form action={deletePaymentAction}>
                <input type="hidden" name="paymentId" value={p.id} />
                <input type="hidden" name="back" value={`/finance/echeances/${id}`} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer l'encaissement du ${formatDay(p.receivedAt)}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
          {!b.payments.length ? <li className="text-sm text-muted-foreground">Aucun encaissement.</li> : null}
        </ul>
        {b.status !== "ANNULE" ? (
          <PaymentForm projectId={b.projectId} billingMilestoneId={id} today={toDateInput(today)} />
        ) : null}
      </Card>
      <Card className="max-w-3xl gap-3">
        <CardTitle>Modifier l&apos;échéance</CardTitle>
        <BillingForm
          projectId={b.projectId}
          lots={await projectLots(b.projectId)}
          billing={{
            id,
            label: b.label,
            kind: b.kind,
            amount: moneyInput(b.amount),
            vatAmount: moneyInput(b.vatAmount),
            plannedDate: toDateInput(b.plannedDate),
            status: b.status,
            workPackageId: b.workPackageId ?? "",
            invoicedAt: toDateInput(b.invoicedAt),
            invoiceRef: b.invoiceRef ?? "",
            invoiceUrl: b.invoiceUrl ?? "",
          }}
        />
      </Card>
    </>
  );
}

export default function BillingPage({ params }: PageProps<"/finance/echeances/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <BillingView params={params} />
      </Suspense>
    </div>
  );
}
