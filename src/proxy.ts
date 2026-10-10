import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Contrôle optimiste : sans cookie de session, redirige vers la connexion avant tout rendu.
 * La vérification réelle (validité, expiration, rôle) reste faite côté serveur par requireUser().
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/connexion", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Tout sauf : API, fichiers Next, ressources publiques et écrans d'authentification.
    "/((?!api|_next/static|_next/image|brand|icons|icon.png|apple-icon.png|manifest.webmanifest|sw.js|hors-ligne.html|robots.txt|connexion|mot-de-passe-oublie|reinitialiser|invitation).*)",
  ],
};
