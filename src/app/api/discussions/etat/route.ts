import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { activityMarker } from "@/features/discussions/queries";
import { processDueDiscussions } from "@/features/discussions/scan";

const headers = { "Cache-Control": "no-store" };

/**
 * GET /api/discussions/etat : marqueur d'activité des salons accessibles au lecteur et total
 * des non-lus. Interrogé toutes les 20 s par l'onglet visible ; traite au passage les rappels
 * et messages programmés échus. Session d'associé exigée.
 */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401, headers });
  if (user.role !== "associe")
    return Response.json({ error: "Accès réservé aux associés." }, { status: 403, headers });
  await processDueDiscussions(new Date()).catch((error) => {
    console.error("[discussions] échéances", error);
  });
  const { marker, unread } = await activityMarker(user.id);
  return Response.json({ marker, unread }, { headers });
}
