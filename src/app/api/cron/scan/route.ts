import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runScheduledScan } from "@/features/notifications/service";
import { getServerEnv } from "@/lib/env";

/**
 * Passe planifiée : retards, escalades 48 h, recalcul des priorités non verrouillées.
 * Appelée par la fonction Netlify `scheduled-scan` avec `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  await connection();
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return Response.json({ error: "non autorisé" }, { status: 401 });
  const counts = await runScheduledScan();
  return Response.json({ status: "ok", ...counts }, { headers: { "Cache-Control": "no-store" } });
}
