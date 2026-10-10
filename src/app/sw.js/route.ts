import { connection } from "next/server";
import { SW_SOURCE } from "@/components/pwa/sw-source";

/** Service worker : toujours relu depuis le serveur (jamais mis en cache), portée « / ». */
export async function GET() {
  await connection();
  return new Response(SW_SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
