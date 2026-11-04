import "server-only";
import { getDb } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { openAppSecret } from "@/lib/crypto/app-secrets";
import type { EventKind } from "@/features/events/kinds";
import { isQuiet, type PresenceValue } from "@/features/presence/rules";
import { parsePrefs, wants, type ExternalChannel } from "@/features/notifications/prefs";
import {
  buildPushMessage,
  buildWhatsappText,
  mapLimit,
  shortError,
  whatsappQuota,
  type DeliveryStatus,
} from "@/features/notifications/external-rules";
import { sendCallMeBot, sendWebPush, type SendOutcome } from "@/features/notifications/transports";

/**
 * Moteur des alertes hors application : choisit, pour chaque associé, les canaux à utiliser
 * (préférences, présence, configuration), envoie en parallèle borné et journalise chaque
 * tentative dans `external_delivery`.
 */
export type DeliveryRequest = {
  /** Type d'événement, ou « test » pour un envoi d'essai demandé depuis la page Alertes. */
  kind: EventKind | "test";
  title: string;
  body?: string;
  href?: string;
  urgent?: boolean;
};

export type DeliveryMode = {
  /** Respecter les préférences par événement (faux pour un test). */
  respectPrefs: boolean;
  /** Ne rien envoyer pendant un focus ou une absence, sauf urgence (faux pour un test). */
  respectPresence: boolean;
  channels: readonly ExternalChannel[];
};

export type DeliveryLog = {
  userId: string;
  channel: ExternalChannel;
  eventKind: string;
  title: string;
  status: DeliveryStatus;
  error: string | null;
};

/** Envois simultanés au plus (services push et CallMeBot). */
const CONCURRENCY = 4;

/** Clé de chiffrement de la clé CallMeBot : liée à son propriétaire. */
export const whatsappKeyContext = (userId: string) => `whatsapp-key:${userId}`;

type Job =
  | { channel: "push"; userId: string; sub: { id: string; endpoint: string; p256dh: string; auth: string } }
  | { channel: "whatsapp"; userId: string; phone: string; sealedKey: string };

export async function deliver(
  userIds: string[],
  request: DeliveryRequest,
  mode: DeliveryMode,
  now = new Date(),
): Promise<DeliveryLog[]> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return [];
  const env = getServerEnv();
  const db = getDb();
  const title = request.title.slice(0, 200);
  const log = (
    userId: string,
    channel: ExternalChannel,
    status: DeliveryStatus,
    error: string | null = null,
  ): DeliveryLog => ({ userId, channel, eventKind: request.kind, title, status, error });

  const users = await db.user.findMany({
    where: { id: { in: ids }, role: "associe" },
    select: {
      id: true,
      presenceState: true,
      presenceUntil: true,
      presenceNote: true,
      presenceShared: true,
      whatsappPhone: true,
      whatsappKey: true,
      notifyPrefs: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const logs: DeliveryLog[] = [];
  const jobs: Job[] = [];
  const whatsappCandidates: Extract<Job, { channel: "whatsapp" }>[] = [];
  for (const user of users) {
    const prefs = parsePrefs(user.notifyPrefs);
    const allowed = (channel: ExternalChannel) =>
      mode.channels.includes(channel) &&
      (!mode.respectPrefs || (request.kind !== "test" && wants(prefs, request.kind, channel)));
    const pushWanted =
      allowed("push") && env.pushTransport !== "off" && user.pushSubscriptions.length > 0;
    const whatsappWanted = allowed("whatsapp") && Boolean(user.whatsappPhone && user.whatsappKey);
    if (!pushWanted && !whatsappWanted) continue;

    const presence = {
      state: user.presenceState as PresenceValue,
      until: user.presenceUntil,
      note: user.presenceNote,
      shared: user.presenceShared,
    };
    if (mode.respectPresence && !request.urgent && isQuiet(presence, now)) {
      if (pushWanted) logs.push(log(user.id, "push", "ignore_focus"));
      if (whatsappWanted) logs.push(log(user.id, "whatsapp", "ignore_focus"));
      continue;
    }
    if (pushWanted) for (const sub of user.pushSubscriptions) jobs.push({ channel: "push", userId: user.id, sub });
    if (whatsappWanted)
      whatsappCandidates.push({
        channel: "whatsapp",
        userId: user.id,
        phone: user.whatsappPhone!,
        sealedKey: user.whatsappKey!,
      });
  }

  // Limite WhatsApp : envois réussis sur l'heure glissante, par associé.
  if (whatsappCandidates.length) {
    const recent = await db.externalDelivery.findMany({
      where: {
        userId: { in: whatsappCandidates.map((c) => c.userId) },
        channel: "whatsapp",
        status: "envoye",
        createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
      },
      select: { userId: true, createdAt: true },
    });
    for (const candidate of whatsappCandidates) {
      const sentAt = recent.filter((r) => r.userId === candidate.userId).map((r) => r.createdAt);
      if (whatsappQuota(sentAt, now).allowed) jobs.push(candidate);
      else logs.push(log(candidate.userId, "whatsapp", "limite"));
    }
  }

  const pushMessage = buildPushMessage(request);
  const whatsappText = buildWhatsappText(request, env.appUrl);
  const gone: string[] = [];
  const used: string[] = [];

  const outcomeLog = (job: Job, outcome: SendOutcome): DeliveryLog =>
    outcome.ok ? log(job.userId, job.channel, "envoye") : log(job.userId, job.channel, "echec", outcome.error);

  const results = await mapLimit(jobs, CONCURRENCY, async (job): Promise<DeliveryLog> => {
    try {
      if (job.channel === "push") {
        if (env.pushTransport !== "webpush") return log(job.userId, "push", "outbox");
        const outcome = await sendWebPush(env, job.sub, pushMessage, request.urgent);
        if (outcome.ok) used.push(job.sub.id);
        else if (outcome.gone) gone.push(job.sub.id);
        return outcomeLog(job, outcome);
      }
      if (env.whatsappTransport !== "callmebot") return log(job.userId, "whatsapp", "outbox");
      let apikey: string;
      try {
        apikey = openAppSecret(job.sealedKey, whatsappKeyContext(job.userId));
      } catch {
        return log(job.userId, "whatsapp", "echec", "Clé WhatsApp illisible : enregistrez-la de nouveau.");
      }
      return outcomeLog(job, await sendCallMeBot({ phone: job.phone, apikey, text: whatsappText }));
    } catch (error) {
      return log(job.userId, job.channel, "echec", shortError(error instanceof Error ? error.name : "Erreur"));
    }
  });
  logs.push(...results);

  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  if (used.length) await db.pushSubscription.updateMany({ where: { id: { in: used } }, data: { lastUsedAt: now } });
  if (logs.length) await db.externalDelivery.createMany({ data: logs });
  return logs;
}
