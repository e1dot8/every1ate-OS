import "server-only";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import { digestEmail } from "@/lib/email/templates";
import { getServerEnv } from "@/lib/env";
import { getBrief } from "@/features/brief/service";

/** Heure et jour de la semaine à Paris (0 = dimanche). */
function parisClock(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      hourCycle: "h23",
      hour: "2-digit",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { hour: Number(parts.hour), weekday: days.indexOf(parts.weekday) };
}

/** Est-ce l'heure d'envoyer le récapitulatif choisi ? (fenêtre 7 h – 11 h, heure de Paris) */
export function digestDue(
  frequency: "AUCUN" | "QUOTIDIEN" | "HEBDOMADAIRE",
  now: Date,
  lastSentOn: Date | null,
) {
  if (frequency === "AUCUN") return false;
  const { hour, weekday } = parisClock(now);
  if (hour < 7 || hour > 11) return false;
  if (frequency === "QUOTIDIEN" && (weekday === 0 || weekday === 6)) return false;
  if (frequency === "HEBDOMADAIRE" && weekday !== 1) return false;
  return !lastSentOn || lastSentOn.getTime() !== todayDate(now).getTime();
}

/**
 * Récapitulatifs e-mail (opt-in). Marque le jour comme traité même s'il n'y avait rien à dire :
 * un seul envoi par jour au maximum, jamais de message vide.
 */
export async function sendDigests(now = new Date()) {
  const db = getDb();
  const users = await db.user.findMany({
    where: { role: "associe", digestFrequency: { not: "AUCUN" } },
    select: { id: true, name: true, email: true, digestFrequency: true, lastDigestOn: true },
  });
  let sent = 0;
  for (const u of users) {
    if (!digestDue(u.digestFrequency, now, u.lastDigestOn)) continue;
    // Réserve le jour avant l'envoi : deux passes simultanées n'envoient pas deux e-mails.
    const claimed = await db.user.updateMany({
      where: { id: u.id, OR: [{ lastDigestOn: null }, { lastDigestOn: { not: todayDate(now) } }] },
      data: { lastDigestOn: todayDate(now) },
    });
    if (!claimed.count) continue;
    const brief = await getBrief(u.id, now);
    if (!brief.items.length) continue;
    try {
      await sendEmail(
        digestEmail({
          to: u.email,
          name: u.name,
          summary: brief.summary,
          items: brief.items,
          appUrl: getServerEnv().appUrl,
          weekly: u.digestFrequency === "HEBDOMADAIRE",
        }),
      );
      sent++;
    } catch (error) {
      console.error("[digest] envoi impossible", error);
    }
  }
  return sent;
}
