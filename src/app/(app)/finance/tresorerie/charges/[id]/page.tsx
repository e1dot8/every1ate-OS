import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ChargeForm } from "@/features/finance/components/treasury-forms";
import { getCharge } from "@/features/finance/treasury";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { moneyInput } from "@/lib/money";
import { archiveChargeAction } from "../../actions";

export const metadata: Metadata = { title: "Charge fixe" };

async function EditCharge({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = await getCharge(id);
  if (!c || c.archivedAt) notFound();
  return (
    <>
      <PageHeader
        title={c.label}
        description="Charge fixe récurrente. Les modifications sont journalisées."
      />
      <Card className="max-w-3xl">
        <ChargeForm
          charge={{
            id,
            label: c.label,
            category: c.category ?? "",
            amount: moneyInput(c.amount),
            frequency: c.frequency,
            nextDate: toDateInput(c.nextDate),
            endDate: toDateInput(c.endDate),
          }}
        />
      </Card>
      <details className="max-w-3xl">
        <summary className="inline-flex min-h-tap cursor-pointer items-center gap-2 font-bold">
          <Archive aria-hidden="true" className="size-4" /> Archiver cette charge
        </summary>
        <form action={archiveChargeAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="chargeId" value={id} />
          <p className="text-sm">
            La charge sort de la trésorerie prévisionnelle ; elle reste consultable dans le journal.
          </p>
          <div>
            <SubmitButton variant="destructive">Confirmer l&apos;archivage</SubmitButton>
          </div>
        </form>
      </details>
    </>
  );
}

export default function ChargePage({ params }: PageProps<"/finance/tresorerie/charges/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance/tresorerie">Trésorerie</BackLink>
      <Suspense fallback={<PageLoading />}>
        <EditCharge params={params} />
      </Suspense>
    </div>
  );
}
