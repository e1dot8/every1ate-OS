import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CancelImportForm, ConfirmImportForm, MappingForm } from "@/features/finance/components/forms";
import { FIELDS } from "@/features/finance/import-rules";
import { getImport, previewImport } from "@/features/finance/imports";
import { projectOptions } from "@/features/finance/page-helpers";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, parseDateInput, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Import" };

const STEPS = ["Fichier", "Type et colonnes", "Validation et doublons", "Confirmation", "Rapport"];

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs" aria-label="Étapes">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={
            i === current
              ? "rounded-full bg-ink px-3 py-1 font-bold text-paper"
              : i < current
                ? "rounded-full border border-ink px-3 py-1"
                : "rounded-full border px-3 py-1 text-muted-foreground"
          }
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}

type Report = { imported: number; skipped: { line: number; reasons: string[] }[]; matched?: number };

async function ImportView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const batch = await getImport(id);
  if (!batch) notFound();
  const headers = batch.headers as string[];
  const rows = batch.rows as string[][];
  const header = (
    <PageHeader
      title={batch.fileName}
      description={`${batch.rowCount} lignes · déposé le ${formatDateTime(batch.createdAt)} par ${batch.createdBy.name}`}
    />
  );

  if (batch.status === "ANNULE")
    return (
      <>
        {header}
        <FormAlert tone="info" title={`Import annulé le ${formatDateTime(batch.cancelledAt)}`}>
          Motif : {batch.cancelReason}. Les lignes importées ont été archivées ; l&apos;historique reste dans
          le journal.
        </FormAlert>
      </>
    );

  if (batch.status === "IMPORTE") {
    const report = (batch.report ?? { imported: 0, skipped: [] }) as Report;
    return (
      <>
        <Steps current={4} />
        {header}
        <FormAlert
          tone="success"
          title={`Import terminé : ${report.imported} ligne(s) importée(s), ${report.skipped.length} écartée(s).`}
        >
          {report.matched ? `${report.matched} encaissement(s) rapproché(s) d'une échéance. ` : ""}
          Identifiant d&apos;import : <code>{batch.id}</code>
        </FormAlert>
        {batch.projectId ? (
          <Link href={`/projets/${batch.projectId}?onglet=finance`} className="font-bold underline">
            Voir la finance du projet
          </Link>
        ) : null}
        {report.skipped.length ? (
          <Card className="gap-2">
            <CardTitle>Lignes écartées</CardTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {report.skipped.map((s) => (
                <li key={s.line}>
                  <b>Ligne {s.line}</b> : {s.reasons.join(" ")}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {batch.createdById === user.id ? (
          <details className="max-w-xl">
            <summary className="min-h-tap cursor-pointer py-2 font-bold text-danger">
              Annuler cet import
            </summary>
            <CancelImportForm importId={id} draft={false} />
          </details>
        ) : null}
      </>
    );
  }

  const ready = batch.kind && batch.projectId && batch.mapping;
  if (!ready || sp.etape !== "apercu") {
    return (
      <>
        <Steps current={1} />
        {header}
        <Card className="gap-2">
          <CardTitle>Aperçu du fichier</CardTitle>
          <div className="relative overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} scope="col" className="border-b px-2 py-1 text-left whitespace-nowrap">
                      {h || `Colonne ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {headers.map((_, j) => (
                      <td key={j} className="border-b px-2 py-1 whitespace-nowrap">
                        {r[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">5 premières lignes sur {batch.rowCount}.</p>
        </Card>
        <Card className="max-w-2xl">
          <MappingForm
            importId={id}
            kind={batch.kind}
            projectId={batch.projectId}
            headers={headers}
            sample={rows.slice(0, 1)}
            fields={FIELDS}
            mapping={(batch.mapping as Record<string, number | null>) ?? {}}
            projects={await projectOptions()}
          />
        </Card>
        <details className="max-w-xl">
          <summary className="min-h-tap cursor-pointer py-2 font-bold">Abandonner ce brouillon</summary>
          <CancelImportForm importId={id} draft />
        </details>
      </>
    );
  }

  const preview = (await previewImport(id))!;
  const { counts } = preview;
  return (
    <>
      <Steps current={2} />
      {header}
      {preview.sameFile ? (
        <FormAlert
          tone="warning"
          title={`Ce fichier a déjà été importé le ${formatDay(preview.sameFile.createdAt)}.`}
        >
          Les lignes déjà présentes sont signalées comme doublons et écartées par défaut.
        </FormAlert>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Prêtes", counts.valid, "success"],
          ["Erreurs", counts.errors, "danger"],
          ["Doublons potentiels", counts.duplicates, "warning"],
          ["Avertissements", counts.warnings, "info"],
        ].map(([k, v]) => (
          <Card key={k as string} className="gap-0.5 py-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold" data-testid={`import-${k}`}>
              {v}
            </p>
          </Card>
        ))}
      </div>
      <Link href={`/finance/imports/${id}`} className="text-sm font-bold underline">
        Modifier le type ou les colonnes
      </Link>
      <Card className="gap-0 py-1">
        <ul aria-label="Lignes du fichier">
          {preview.rows.slice(0, 300).map((r) => {
            const v = r.values;
            const tone = r.errors.length ? "danger" : r.duplicate ? "warning" : "success";
            const label = r.errors.length
              ? "Erreur"
              : r.duplicate === "base"
                ? "Déjà importée"
                : r.duplicate
                  ? "Doublon"
                  : "Prête";
            return (
              <li key={r.line} className="flex flex-col gap-1 border-b py-2.5 text-sm last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">Ligne {r.line}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {v.date ? formatDay(parseDateInput(v.date as string)) : "—"} ·{" "}
                    <b>{typeof v.amount === "number" ? formatMoney(v.amount) : "—"}</b> ·{" "}
                    {(v.description ?? v.label ?? v.reference ?? "") as string}
                    {v.supplier ? ` · ${v.supplier}` : ""}
                  </span>
                  <StatusBadge tone={tone} label={label} />
                </div>
                {r.errors.length || r.warnings.length || "match" in r ? (
                  <p className="pl-16 text-xs">
                    {r.errors.map((e) => (
                      <span key={e} className="mr-2 text-danger">
                        {e}
                      </span>
                    ))}
                    {r.warnings.map((w) => (
                      <span key={w} className="mr-2 text-warning">
                        {w}
                      </span>
                    ))}
                    {"match" in r && r.match ? (
                      <span className="text-success">Rapprochée de l&apos;échéance « {r.match.label} »</span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {preview.rows.length > 300 ? (
          <p className="py-2 text-xs text-muted-foreground">
            300 premières lignes affichées sur {preview.rows.length}.
          </p>
        ) : null}
      </Card>
      {batch.createdById === user.id ? (
        <Card className="max-w-2xl gap-2">
          <CardTitle>Confirmer</CardTitle>
          {counts.valid || counts.duplicates ? (
            <ConfirmImportForm importId={id} valid={counts.valid} duplicates={counts.duplicates} />
          ) : (
            <FormAlert
              tone="danger"
              title="Aucune ligne importable : corrigez le fichier ou la correspondance."
            />
          )}
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seul l&apos;auteur du dépôt peut confirmer cet import.
        </p>
      )}
    </>
  );
}

export default function ImportPage({ params, searchParams }: PageProps<"/finance/imports/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/finance?onglet=imports">Imports</BackLink>
      <Suspense fallback={<PageLoading />}>
        <ImportView params={params} searchParams={searchParams as Promise<{ etape?: string }>} />
      </Suspense>
    </div>
  );
}
