import { connection } from "next/server";
import { feedIcs } from "@/features/calendar/service";

/**
 * Flux ICS personnel en lecture seule : https://…/api/calendrier/<jeton>.ics
 * À ajouter comme « calendrier par URL » dans Google Agenda ou Apple Calendrier.
 * Le jeton (256 bits) n'est jamais stocké en clair ; un jeton inconnu renvoie 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  await connection();
  const { file } = await params;
  const token = file.replace(/\.ics$/, "");
  if (!/^[\w-]{40,64}$/.test(token)) return new Response("Introuvable", { status: 404 });
  const ics = await feedIcs(token);
  if (!ics) return new Response("Introuvable", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="every1ate.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
