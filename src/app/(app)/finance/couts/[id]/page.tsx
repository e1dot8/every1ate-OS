import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CostForm } from "@/features/finance/components/forms";
import { projectLots } from "@/features/finance/page-helpers";
import { getCost } from "@/features/finance/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { moneyInput } from "@/lib/money";
import { archiveCostAction } from "../../actions";

export const metadata: Metadata = { title: "Coût" };

async function EditCost({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = await getCost(id);
  if (!c || c.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/projets/${c.projectId}?onglet=finance`}>{c.project.name}</BackLink>
      <PageHeader
        title="Modifier le coût"
        description={
          c.source === "IMPORT"
            ? "Ligne importée : toute modification est journalisée."
            : "Les modifications sont journalisées."
        }
      />
      <Card className="max-w-3xl">
        <CostForm
          projectId={c.projectId}
          lots={await projectLots(c.projectId)}
          cost={{
            id,
            description: c.description,
            supplier: c.supplier ?? "",
            category: c.category ?? "",
            workPackageId: c.workPackageId ?? "",
            pricingMode: c.pricingMode,
            quantity: c.quantity?.toString() ?? "",
            unit: c.unit ?? "",
            unitRate: moneyInput(c.unitRate),
            amount: moneyInput(c.amount),
            vatAmount: moneyInput(c.vatAmount),
            amountTTC: moneyInput(c.amountTTC),
            status: c.status,
            committedAt: toDateInput(c.committedAt),
            invoiceDate: toDateInput(c.invoiceDate),
            dueDate: toDateInput(c.dueDate),
            paidAt: toDateInput(c.paidAt),
            documentRef: c.documentRef ?? "",
            rebillable: c.rebillable,
          }}
        />
      </Card>
      <details className="max-w-3xl">
        <summary className="inline-flex min-h-tap cursor-pointer items-center gap-2 font-bold">
          <Archive aria-hidden="true" className="size-4" /> Archiver ce coût
        </summary>
        <form action={archiveCostAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="costId" value={id} />
          <p className="text-sm">Le coût sort des calculs ; il reste consultable dans le journal.</p>
          <div>
            <SubmitButton variant="destructive">Confirmer l&apos;archivage</SubmitButton>
          </div>
        </form>
      </details>
    </>
  );
}

export default function CostPage({ params }: PageProps<"/finance/couts/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EditCost params={params} />
      </Suspense>
    </div>
  );
}
