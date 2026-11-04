import { randomBytes } from "node:crypto";
import { withDb } from "./db";

/** Aides des tests « Alertes » (push, WhatsApp) : accès direct à la base de test. */

export type DeliveryRow = { channel: string; eventKind: string; title: string; status: string };

export async function deliveriesFor(email: string): Promise<DeliveryRow[]> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select d.channel, d."eventKind", d.title, d.status from external_delivery d
       join "user" u on u.id = d."userId"
       -- Le point du matin (diffusé à tous en semaine après 8 h) peut tomber pendant la série.
       where u.email = $1 and d."eventKind" <> 'point.matin' order by d."createdAt"`,
      [email],
    );
    return rows as DeliveryRow[];
  });
}

/**
 * Abonnement push fictif (jamais contacté : les tests tournent avec PUSH_TRANSPORT=outbox),
 * rattaché à la session la plus récente de l'associé (sans session valide, rien n'est envoyé).
 * `withSession: false` : abonnement orphelin (appareil d'une session fermée ou d'avant V1.2).
 */
export async function insertPushSubscription(
  email: string,
  { withSession = true }: { withSession?: boolean } = {},
): Promise<string> {
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${randomBytes(12).toString("hex")}`;
  await withDb((c) =>
    c.query(
      `insert into push_subscription (id, "userId", endpoint, p256dh, auth, "userAgent", "sessionId", "createdAt")
       select $1, u.id, $2, $3, $4, $5,
              case when $7::boolean
                then (select s.id from "session" s where s."userId" = u.id order by s."createdAt" desc limit 1)
              end,
              now()
       from "user" u where u.email = $6`,
      [
        `ps_${randomBytes(8).toString("hex")}`,
        endpoint,
        randomBytes(65).toString("base64url"),
        randomBytes(16).toString("base64url"),
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
        email,
        withSession,
      ],
    ),
  );
  return endpoint;
}

export async function pushSubscriptionCount(email: string): Promise<number> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select count(*)::int n from push_subscription p join "user" u on u.id = p."userId" where u.email = $1`,
      [email],
    );
    return rows[0].n as number;
  });
}

export async function whatsappColumns(email: string): Promise<{ phone: string | null; key: string | null }> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select "whatsappPhone" phone, "whatsappKey" key from "user" where email = $1`,
      [email],
    );
    return rows[0];
  });
}

/** Journal d'audit de l'associé (action + valeurs après), pour vérifier l'absence de secrets. */
export async function auditTrail(email: string): Promise<{ action: string; data: string }[]> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select a.action, coalesce(a.before::text, '') || coalesce(a.after::text, '') data
       from audit_event a join "user" u on u.id = a."actorId" where u.email = $1 order by a."createdAt"`,
      [email],
    );
    return rows;
  });
}
