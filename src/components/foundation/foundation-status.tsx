import { connection } from "next/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDb } from "@/lib/db/client";
import { checkHealth } from "@/lib/health";

/** État réel du socle, lu à chaque requête (aucune valeur simulée). */
export async function FoundationStatus() {
  await connection();
  const report = await checkHealth(async () => {
    await getDb().$queryRaw`SELECT 1`;
  });

  return (
    <dl className="grid gap-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">Application</dt>
        <dd>
          <StatusBadge tone="success" label="En ligne" />
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">Base de données</dt>
        <dd data-testid="db-status">
          {report.checks.database === "up" ? (
            <StatusBadge tone="success" label="Connectée" />
          ) : (
            <StatusBadge tone="danger" label="Injoignable" />
          )}
        </dd>
      </div>
    </dl>
  );
}

export function FoundationStatusFallback() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Vérification de l&apos;état du socle…
    </p>
  );
}
