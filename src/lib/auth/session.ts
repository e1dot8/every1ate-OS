import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";

export type CurrentUser = { id: string; name: string; email: string; role: string; sessionId: string };

/** Lit la session de la requête en cours (null si absente ou expirée). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Les cookies écrits pendant une Server Action (nouvelle session après changement de mot de passe)
  // sont visibles via cookies(), pas via l'en-tête d'origine : on reconstruit l'en-tête.
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: string };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? "associe",
    sessionId: session.session.id,
  };
}

/**
 * Garde serveur : à appeler dans chaque page protégée et chaque Server Action.
 * V1 : seuls les associés accèdent à l'application.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "associe") redirect("/connexion");
  return user;
}
