import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";

/** Actions journalisées. Les actions métier suivent le format « objet.verbe ». */
export type AuditAction =
  | `project.${string}`
  | `lot.${string}`
  | `task.${string}`
  | `client.${string}`
  | `time.${string}`
  | `opportunity.${string}`
  | `finance.${string}`
  | `import.${string}`
  | `governance.${string}`
  | `calendar.${string}`
  | `file.${string}`
  | `settings.${string}`
  | `progression.${string}`
  | `briefing.${string}`
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
  projectId?: string | null;
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
      projectId: entry.projectId ?? null,
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

/** Valeurs avant/après limitées aux champs réellement modifiés. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const x = before[key];
    const y = after[key];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));
    if (JSON.stringify(norm(x)) !== JSON.stringify(norm(y))) {
      b[key] = norm(x);
      a[key] = norm(y);
    }
  }
  return {
    before: b as Prisma.InputJsonObject,
    after: a as Prisma.InputJsonObject,
    changed: Object.keys(a).length > 0,
  };
}
