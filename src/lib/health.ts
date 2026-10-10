export type HealthStatus = "ok" | "degraded";

export type HealthReport = {
  status: HealthStatus;
  checks: { database: "up" | "down" };
  checkedAt: string;
};

/**
 * Vérifie l'état du service. La sonde base de données est injectée pour
 * rester testable ; aucun message d'erreur interne n'est renvoyé au client.
 */
export async function checkHealth(
  pingDatabase: () => Promise<void>,
  now: () => Date = () => new Date(),
): Promise<HealthReport> {
  let database: "up" | "down" = "up";
  try {
    await pingDatabase();
  } catch {
    database = "down";
  }
  return {
    status: database === "up" ? "ok" : "degraded",
    checks: { database },
    checkedAt: now().toISOString(),
  };
}
