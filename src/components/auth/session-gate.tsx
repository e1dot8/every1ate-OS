import { requireUser } from "@/lib/auth/session";

/**
 * Garde de session pour toute la zone protégée : sans session valide d'associé, redirection
 * vers la connexion. Doublon volontaire des contrôles faits par chaque page et chaque action
 * (défense en profondeur) : une page qui oublierait le sien reste fermée.
 */
export async function SessionGate() {
  await requireUser();
  return null;
}
