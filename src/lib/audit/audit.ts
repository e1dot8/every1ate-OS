import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";

/** Actions journalisées. Toute nouvelle action sensible s'ajoute ici. */
export type AuditAction =
  | "auth.sign_in.success"
  | "auth.sign_in.failure"
  | "auth.sign_in.blocked"
  | "auth.sign_out"
  | "auth.password_reset.requested"
  | "auth.password_reset.completed"
  | "auth.password.changed"
  | "auth.session.revoked"
  | "auth.sessions.revoked_others"
  | "invitation.created"
  | "invitation.resent"
  | "invitation.accepted";

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Identifiant stable d'une adresse e-mail sans la stocker en clair dans le journal.
 * Sert aussi à compter les échecs de connexion par compte.
 */
export function emailFingerprint(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** Écrit une entrée. Ne doit jamais recevoir de mot de passe, jeton ou secret. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await getDb().auditEvent.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent?.slice(0, 300) ?? null,
    },
  });
}
