import { connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { checkHealth } from "@/lib/health";

export async function GET() {
  // Toujours exécuté à la requête : jamais prérendu ni mis en cache.
  await connection();

  const report = await checkHealth(async () => {
    await getDb().$queryRaw`SELECT 1`;
  });

  if (report.status !== "ok") {
    console.error("[health] base de données injoignable");
  }

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
