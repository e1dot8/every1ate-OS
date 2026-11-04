import "server-only";
import {
  createSystemMessage,
  ensureGeneralChannel,
  ensureProjectChannel,
} from "@/features/discussions/channels";
import { safeHref } from "@/features/discussions/rules";

/**
 * Publie un message du QG (sans auteur) dans le salon du projet (créé si besoin),
 * ou dans la Salle commune quand l'événement n'a pas de projet. Le lien (`meta.href`)
 * s'affiche sur la ligne système. Ne lève jamais : l'action d'origine n'en dépend pas.
 */
export async function postSystemMessage(input: {
  projectId: string | null;
  text: string;
  href?: string;
}): Promise<void> {
  try {
    const text = input.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    const channel =
      (input.projectId ? await ensureProjectChannel(input.projectId, null) : null) ??
      (await ensureGeneralChannel());
    if (!channel) return;
    await createSystemMessage({ channelId: channel.id, text, href: safeHref(input.href) });
  } catch (error) {
    console.error("[discussions] message du QG non publié", error);
  }
}
