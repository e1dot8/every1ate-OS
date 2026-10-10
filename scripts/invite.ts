/**
 * Crée une invitation depuis la ligne de commande (premier associé, ou secours).
 *   pnpm invite <email> <prénom>
 * Le lien est envoyé par e-mail (ou stocké dans la boîte locale en développement) et affiché ici.
 */
import "dotenv/config";
import { createInvitation } from "@/lib/auth/invitations";
import { getDb } from "@/lib/db/client";

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();
  if (!email || !name) {
    console.error("Usage : pnpm invite <email> <prénom>");
    process.exit(1);
  }
  const result = await createInvitation({ email, name, actor: null });
  if (!result.ok) {
    console.error(
      result.error === "already_member" ? "Un compte existe déjà pour cette adresse." : result.error,
    );
    process.exit(1);
  }
  console.log(`Invitation créée pour ${email}. Lien (valable 72 h) :\n${result.url}`);
}

main().finally(() => getDb().$disconnect());
