import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/audit";
import { sealAppSecret } from "@/lib/crypto/app-secrets";
import { getDb } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import type { ServiceResult } from "@/features/projects/service";
import { deliver, whatsappKeyContext, type DeliveryLog } from "@/features/notifications/delivery";
import { changedPrefs, parsePrefs, type ExternalChannel, type NotifyPrefs } from "@/features/notifications/prefs";
import { WHATSAPP_HOURLY_LIMIT, deviceLabel, maskPhone } from "@/features/notifications/external-rules";

/**
 * Réglages des alertes hors application (page Plus › Alertes) : appareils abonnés aux
 * notifications push, WhatsApp via CallMeBot, préférences par événement, envois d'essai.
 * Le journal d'audit ne contient jamais de numéro complet, de clé ni d'adresse d'abonnement.
 */
type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

/** Au-delà, l'abonnement le plus ancien est retiré (appareils remplacés, navigateurs réinstallés). */
const MAX_DEVICES = 10;

// ─── Lecture ───────────────────────────────────────────────────────────────────

export async function getAlertSettings(userId: string) {
  const env = getServerEnv();
  const [user, devices, deliveries] = await Promise.all([
    getDb().user.findUnique({
      where: { id: userId },
      select: { whatsappPhone: true, whatsappKey: true, notifyPrefs: true },
    }),
    getDb().pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true },
    }),
    getDb().externalDelivery.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, channel: true, title: true, status: true, error: true, createdAt: true },
    }),
  ]);
  return {
    push: {
      /** Clé publique transmise au navigateur pour s'abonner (null : notifications push non configurées). */
      publicKey: env.pushTransport !== "off" ? (env.VAPID_PUBLIC_KEY ?? null) : null,
      testMode: env.pushTransport === "outbox",
      devices: devices.map((d) => ({
        id: d.id,
        label: deviceLabel(d.userAgent),
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt,
      })),
    },
    whatsapp: {
      phone: user?.whatsappPhone ?? null,
      hasKey: Boolean(user?.whatsappKey),
      testMode: env.whatsappTransport === "outbox",
    },
    prefs: parsePrefs(user?.notifyPrefs),
    deliveries,
  };
}

export type AlertSettings = Awaited<ReturnType<typeof getAlertSettings>>;

// ─── Notifications push ────────────────────────────────────────────────────────

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

export async function isPushSubscriptionKnown(userId: string, endpoint: string): Promise<boolean> {
  const found = await getDb().pushSubscription.findFirst({ where: { userId, endpoint }, select: { id: true } });
  return Boolean(found);
}

export async function savePushSubscription(
  input: PushSubscriptionInput,
  userAgent: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  if (getServerEnv().pushTransport === "off") return failed("Notifications push non configurées.");
  const db = getDb();
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint: input.endpoint },
    select: { userId: true },
  });
  // Un même navigateur ne sert qu'un associé : l'abonnement suit la personne connectée.
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: actor.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
    update: { userId: actor.id, p256dh: input.p256dh, auth: input.auth, userAgent: userAgent?.slice(0, 300) },
  });
  const extra = await db.pushSubscription.findMany({
    where: { userId: actor.id },
    orderBy: [{ createdAt: "desc" }],
    skip: MAX_DEVICES,
    select: { id: true },
  });
  if (extra.length) await db.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
  if (existing?.userId !== actor.id) {
    await recordAudit({
      action: "notification.push_subscribed",
      actorId: actor.id,
      targetType: "user",
      targetId: actor.id,
      after: { device: deviceLabel(userAgent) },
    });
  }
  return done(null);
}

export async function removePushSubscription(
  where: { endpoint: string } | { id: string },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const found = await db.pushSubscription.findFirst({
    where: { ...where, userId: actor.id },
    select: { id: true, userAgent: true },
  });
  if (!found) return done(null); // déjà retiré : rien à faire
  await db.pushSubscription.delete({ where: { id: found.id } });
  await recordAudit({
    action: "notification.push_unsubscribed",
    actorId: actor.id,
    targetType: "user",
    targetId: actor.id,
    before: { device: deviceLabel(found.userAgent) },
  });
  return done(null);
}

// ─── WhatsApp ──────────────────────────────────────────────────────────────────

/** Numéro déjà normalisé (E.164) ; clé absente = garder la clé enregistrée. */
export async function configureWhatsapp(
  input: { phone: string; apikey: string | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { whatsappPhone: true, whatsappKey: true },
  });
  if (!user) return failed("Compte introuvable.");
  if (!input.apikey && !user.whatsappKey) return failed("Indiquez la clé API reçue de CallMeBot.");
  const data: Prisma.UserUpdateInput = { whatsappPhone: input.phone };
  if (input.apikey) data.whatsappKey = sealAppSecret(input.apikey, whatsappKeyContext(actor.id));
  await db.user.update({ where: { id: actor.id }, data });
  await recordAudit({
    action: "notification.whatsapp_configured",
    actorId: actor.id,
    targetType: "user",
    targetId: actor.id,
    before: user.whatsappPhone ? { phone: maskPhone(user.whatsappPhone) } : undefined,
    after: { phone: maskPhone(input.phone), keyChanged: Boolean(input.apikey) },
  });
  return done(null);
}

export async function removeWhatsapp(actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { whatsappPhone: true } });
  await db.user.update({ where: { id: actor.id }, data: { whatsappPhone: null, whatsappKey: null } });
  await recordAudit({
    action: "notification.whatsapp_removed",
    actorId: actor.id,
    targetType: "user",
    targetId: actor.id,
    before: user?.whatsappPhone ? { phone: maskPhone(user.whatsappPhone) } : undefined,
  });
  return done(null);
}

// ─── Préférences ───────────────────────────────────────────────────────────────

export async function saveNotifyPrefs(
  prefs: NotifyPrefs,
  actor: Actor,
  reason?: string,
): Promise<ServiceResult<{ changed: number }>> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { notifyPrefs: true } });
  if (!user) return failed("Compte introuvable.");
  const changes = changedPrefs(parsePrefs(user.notifyPrefs), prefs);
  await db.user.update({
    where: { id: actor.id },
    data: { notifyPrefs: prefs as unknown as Prisma.InputJsonObject },
  });
  if (changes.length) {
    await recordAudit({
      action: "notification.prefs_updated",
      actorId: actor.id,
      targetType: "user",
      targetId: actor.id,
      after: { changed: changes },
      reason,
    });
  }
  return done({ changed: changes.length });
}

// ─── Envoi d'essai ─────────────────────────────────────────────────────────────

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Résumé lisible d'un envoi d'essai. */
export function summarizeTest(channel: ExternalChannel, logs: DeliveryLog[]): ServiceResult<string> {
  const count = (status: DeliveryLog["status"]) => logs.filter((l) => l.status === status).length;
  const target = channel === "push" ? (n: number) => plural(n, "appareil") : () => "WhatsApp";
  if (!logs.length)
    return failed(
      channel === "push"
        ? "Aucun appareil enregistré : activez d'abord les notifications sur cet appareil."
        : "WhatsApp n'est pas configuré.",
    );
  if (count("limite")) return failed(`Limite de ${WHATSAPP_HOURLY_LIMIT} messages WhatsApp par heure atteinte.`);
  const failures = logs.filter((l) => l.status === "echec");
  const sent = count("envoye");
  const outbox = count("outbox");
  if (failures.length && !sent && !outbox) return failed(`Échec de l'envoi : ${failures[0].error ?? "erreur inconnue"}`);
  const parts: string[] = [];
  if (sent) parts.push(`Test envoyé (${target(sent)}).`);
  if (outbox) parts.push(`Mode test : envoi journalisé, rien n'est parti (${target(outbox)}).`);
  if (failures.length) parts.push(`${plural(failures.length, "échec")} : ${failures[0].error ?? "erreur"}`);
  return done(parts.join(" "));
}

export async function sendTestAlert(channel: ExternalChannel, actor: Actor): Promise<ServiceResult<string>> {
  if (channel === "push" && getServerEnv().pushTransport === "off")
    return failed("Notifications push non configurées sur le serveur.");
  const logs = await deliver(
    [actor.id],
    {
      kind: "test",
      title: "Test Every1.ate OS",
      body: "Les alertes fonctionnent sur ce canal.",
      href: "/plus/alertes",
    },
    { respectPrefs: false, respectPresence: false, channels: [channel] },
  );
  return summarizeTest(channel, logs);
}
