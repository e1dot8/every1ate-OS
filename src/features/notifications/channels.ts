import "server-only";
import type { EventKind } from "@/features/events/kinds";
import { deliver } from "@/features/notifications/delivery";
import { shortError } from "@/features/notifications/external-rules";

export type ExternalPayload = {
  kind: EventKind;
  title: string;
  body?: string;
  href?: string;
  urgent?: boolean;
};

/**
 * Envoie la notification hors de l'app (push, WhatsApp) aux associés qui l'ont choisi pour ce
 * type d'événement, en respectant leur statut de présence (focus ou absence : rien, sauf urgence).
 * Chaque tentative est journalisée dans `external_delivery`. Ne lève jamais : l'action d'origine
 * n'est jamais bloquée par un service tiers.
 */
export async function deliverExternal(userIds: string[], payload: ExternalPayload): Promise<void> {
  try {
    await deliver(userIds, payload, {
      respectPrefs: true,
      respectPresence: true,
      channels: ["push", "whatsapp"],
    });
  } catch (error) {
    // Message court, sans URL (les secrets ne quittent jamais les transports).
    console.error("[alertes] envoi externe", payload.kind, shortError(String(error)));
  }
}
