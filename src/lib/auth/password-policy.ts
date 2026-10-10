import "server-only";
import { createHash } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type BreachCheck = (password: string) => Promise<boolean>;

/**
 * Vérifie un mot de passe dans la base Have I Been Pwned par k-anonymat :
 * seuls les 5 premiers caractères de l'empreinte SHA-1 quittent le serveur.
 * En cas d'indisponibilité du service, on n'empêche pas l'utilisateur d'avancer
 * (échec ouvert, journalisé).
 */
export async function isPasswordBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch (error) {
    console.warn("[password-policy] vérification des fuites indisponible :", (error as Error).message);
    return false;
  }
}

export type PasswordProblem = "too_short" | "too_long" | "breached";

export const passwordProblemMessages: Record<PasswordProblem, string> = {
  too_short: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  too_long: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
  breached: "Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.",
};

/** Contrôle complet d'un nouveau mot de passe. */
export async function checkNewPassword(
  password: string,
  options: { breachCheck: BreachCheck | null },
): Promise<PasswordProblem | null> {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (password.length > PASSWORD_MAX_LENGTH) return "too_long";
  if (options.breachCheck && (await options.breachCheck(password))) return "breached";
  return null;
}
