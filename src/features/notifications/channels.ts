import "server-only";
import type { EventKind } from "@/features/events/kinds";

export type ExternalPayload = {
  kind: EventKind;
  title: string;
  body?: string;
  href?: string;
  urgent?: boolean;
};

/**
 * À IMPLÉMENTER (module Automatisations) : envoie la notification hors de l'app (push, WhatsApp)
 * aux associés qui l'ont choisi pour ce type d'événement, en respectant leur statut de présence.
 */
export async function deliverExternal(userIds: string[], payload: ExternalPayload): Promise<void> {
  void userIds;
  void payload;
}
