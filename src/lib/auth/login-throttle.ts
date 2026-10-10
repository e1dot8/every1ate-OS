import "server-only";
import { getDb } from "@/lib/db/client";

/** 5 échecs sur 15 minutes suspendent la connexion du compte pendant 15 minutes. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type ThrottleDecision = { blocked: boolean; failures: number };

/** Règle pure, testée unitairement. */
export function decideThrottle(failureCount: number, max = LOGIN_MAX_FAILURES): ThrottleDecision {
  return { blocked: failureCount >= max, failures: failureCount };
}

/** Compte les échecs récents pour une empreinte d'e-mail, à partir du journal d'audit. */
export async function checkLoginThrottle(fingerprint: string, now = new Date()): Promise<ThrottleDecision> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const lastSuccess = await getDb().auditEvent.findFirst({
    where: { action: "auth.sign_in.success", targetId: fingerprint, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const failures = await getDb().auditEvent.count({
    where: {
      action: "auth.sign_in.failure",
      targetId: fingerprint,
      createdAt: { gte: lastSuccess && lastSuccess.createdAt > since ? lastSuccess.createdAt : since },
    },
  });
  return decideThrottle(failures);
}
