import { z } from "zod";
import { EVENT_KINDS, type EventKind } from "@/features/events/kinds";

/**
 * Préférences d'alertes hors de l'application, par type d'événement (module pur).
 * La notification dans l'app est toujours créée ; ici on choisit seulement push et WhatsApp.
 */
export type ExternalChannel = "push" | "whatsapp";
export type ChannelPrefs = { push: boolean; whatsapp: boolean };
export type NotifyPrefs = Record<EventKind, ChannelPrefs>;

/** Trop fréquents pour le téléphone : visibles dans l'app seulement, par défaut. */
export const PUSH_OFF_BY_DEFAULT: readonly EventKind[] = ["livrable.coche", "tache.terminee"];

/** WhatsApp est désactivé par défaut (opt-in) ; jeu recommandé quand on l'active. */
export const WHATSAPP_RECOMMENDED: readonly EventKind[] = [
  "livrable.livre",
  "livrable.bloque",
  "passation.demandee",
  "mention",
  "message.direct",
  "point.matin",
];

/** Réglages par défaut : push pour tout sauf les événements fréquents, WhatsApp nulle part. */
export function defaultPrefs(): NotifyPrefs {
  return Object.fromEntries(
    EVENT_KINDS.map((kind) => [kind, { push: !PUSH_OFF_BY_DEFAULT.includes(kind), whatsapp: false }]),
  ) as NotifyPrefs;
}

/** Réglages recommandés : push par défaut + WhatsApp pour les événements importants. */
export function recommendedPrefs(): NotifyPrefs {
  return Object.fromEntries(
    EVENT_KINDS.map((kind) => [
      kind,
      { push: !PUSH_OFF_BY_DEFAULT.includes(kind), whatsapp: WHATSAPP_RECOMMENDED.includes(kind) },
    ]),
  ) as NotifyPrefs;
}

const channelSchema = z
  .object({
    push: z.boolean().optional().catch(undefined),
    whatsapp: z.boolean().optional().catch(undefined),
  })
  .catch({});

/**
 * Lecture tolérante du JSON stocké : types inconnus ignorés, valeurs invalides ou absentes
 * remplacées par le défaut. Ne lève jamais.
 */
export function parsePrefs(raw: unknown): NotifyPrefs {
  const prefs = defaultPrefs();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return prefs;
  const source = raw as Record<string, unknown>;
  for (const kind of EVENT_KINDS) {
    if (!Object.hasOwn(source, kind)) continue;
    const parsed = channelSchema.parse(source[kind]);
    prefs[kind] = {
      push: parsed.push ?? prefs[kind].push,
      whatsapp: parsed.whatsapp ?? prefs[kind].whatsapp,
    };
  }
  return prefs;
}

/** Nom du champ de formulaire d'une case (ex. « push:livrable.livre »). */
export const prefField = (channel: ExternalChannel, kind: EventKind) => `${channel}:${kind}`;

/** Préférences depuis un formulaire de cases à cocher : une case absente vaut « non ». */
export function prefsFromForm(has: (field: string) => boolean): NotifyPrefs {
  return Object.fromEntries(
    EVENT_KINDS.map((kind) => [
      kind,
      { push: has(prefField("push", kind)), whatsapp: has(prefField("whatsapp", kind)) },
    ]),
  ) as NotifyPrefs;
}

export function wants(prefs: NotifyPrefs, kind: EventKind, channel: ExternalChannel): boolean {
  return prefs[kind]?.[channel] ?? false;
}

/** Cases modifiées entre deux réglages (pour le journal), ex. « mention.whatsapp ». */
export function changedPrefs(before: NotifyPrefs, after: NotifyPrefs): string[] {
  const changes: string[] = [];
  for (const kind of EVENT_KINDS) {
    for (const channel of ["push", "whatsapp"] as const) {
      if (before[kind][channel] !== after[kind][channel]) changes.push(`${kind}.${channel}`);
    }
  }
  return changes;
}
