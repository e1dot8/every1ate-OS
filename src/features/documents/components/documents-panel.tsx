import { Archive, ExternalLink, FileText, Folder, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AddFileForm } from "@/features/documents/components/add-file-form";
import { listFiles, type FileTarget } from "@/features/documents/service";
import { formatDateTime, formatDay } from "@/lib/dates";
import { archiveFileAction, checkFileAction } from "@/app/(app)/documents/actions";

const statusTone = {
  NON_VERIFIE: "neutral",
  OK: "success",
  INTROUVABLE: "danger",
  ERREUR: "warning",
} as const;
const statusLabel = {
  NON_VERIFIE: "Non vérifié",
  OK: "Accessible",
  INTROUVABLE: "Lien supprimé ou expiré",
  ERREUR: "Vérification échouée",
} as const;

/** Documents rattachés (références Drive) avec ajout, vérification du lien et archivage. */
export async function DocumentsPanel({
  target,
  back,
  readOnly,
}: {
  target: FileTarget;
  back: string;
  readOnly?: boolean;
}) {
  const files = await listFiles(target);
  return (
    <Card className="gap-3" id="documents">
      <CardTitle>Documents</CardTitle>
      <ul className="flex flex-col" aria-label="Documents rattachés">
        {files.map((f) => {
          const Icon = f.kind === "DOSSIER" ? Folder : FileText;
          return (
            <li key={f.id} className="flex flex-col gap-1 border-b py-2.5 text-sm last:border-b-0">
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center gap-1 font-bold hover:underline"
                >
                  {f.title} <ExternalLink aria-hidden="true" className="size-3" />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
                <StatusBadge tone={statusTone[f.status]} label={statusLabel[f.status]} />
              </div>
              <span className="text-xs text-muted-foreground">
                {f.provider === "google_drive" ? "Google Drive" : "Lien"} · ajouté par {f.addedBy.name} le{" "}
                {formatDay(f.createdAt)}
                {f.ownerLabel ? ` · ${f.ownerLabel}` : ""}
                {f.task && !target.taskId ? ` · tâche « ${f.task.title} »` : ""}
                {f.lastCheckedAt ? ` · vérifié ${formatDateTime(f.lastCheckedAt)}` : ""}
                {f.statusDetail && f.status !== "OK" ? ` · ${f.statusDetail}` : ""}
              </span>
              {!readOnly ? (
                <div className="flex gap-1">
                  {f.provider === "google_drive" ? (
                    <form action={checkFileAction}>
                      <input type="hidden" name="fileId" value={f.id} />
                      <input type="hidden" name="back" value={back} />
                      <Button type="submit" variant="ghost" size="sm">
                        <RefreshCw aria-hidden="true" />{" "}
                        {f.status === "ERREUR" ? "Réessayer" : "Vérifier le lien"}
                      </Button>
                    </form>
                  ) : null}
                  <form action={archiveFileAction}>
                    <input type="hidden" name="fileId" value={f.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Retirer la référence ${f.title}`}
                    >
                      <Archive aria-hidden="true" /> Retirer
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
        {!files.length ? <li className="text-sm text-muted-foreground">Aucun document.</li> : null}
      </ul>
      {!readOnly ? (
        <details>
          <summary className="min-h-tap cursor-pointer py-2 font-bold">Ajouter un document</summary>
          <AddFileForm
            target={Object.fromEntries(Object.entries(target).filter(([, v]) => v)) as Record<string, string>}
            back={back}
          />
        </details>
      ) : null}
    </Card>
  );
}
