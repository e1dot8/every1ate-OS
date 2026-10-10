import type { Metadata } from "next";
import { BackLink } from "@/components/app/bits";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { UploadForm } from "@/features/finance/components/forms";

export const metadata: Metadata = { title: "Nouvel import" };

const STEPS = ["Fichier", "Type et colonnes", "Validation et doublons", "Confirmation", "Rapport"];

export default function NewImportPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance?onglet=imports">Imports</BackLink>
      <PageHeader
        title="Importer un fichier"
        description="Export Pennylane (coûts) ou Qonto (encaissements), en CSV ou Excel."
      />
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={
              i === 0
                ? "rounded-full bg-ink px-3 py-1 font-bold text-paper"
                : "rounded-full border px-3 py-1 text-muted-foreground"
            }
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Card className="max-w-2xl">
        <UploadForm />
      </Card>
    </div>
  );
}
