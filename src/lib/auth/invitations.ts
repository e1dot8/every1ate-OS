import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { recordAudit } from "@/lib/audit/audit";
import { getAuth } from "@/lib/auth/auth";
import { checkNewPassword, isPasswordBreached, type PasswordProblem } from "@/lib/auth/password-policy";
import { getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { invitationEmail } from "@/lib/email/templates";
import { getServerEnv } from "@/lib/env";

export const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitationError = "already_member" | "invalid_or_expired" | PasswordProblem;

type Actor = { id: string; name: string } | null;

/** Crée (ou remplace) l'invitation d'une adresse et envoie l'e-mail. Le jeton n'existe qu'en mémoire et dans l'e-mail. */
export async function createInvitation(input: {
  email: string;
  name: string;
  actor: Actor;
  resend?: boolean;
}): Promise<{ ok: true; url: string } | { ok: false; error: InvitationError }> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "already_member" };
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return tx.invitation.create({
      data: {
        email,
        name: input.name.trim(),
        tokenHash: hashInvitationToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        invitedById: input.actor?.id ?? null,
      },
    });
  });

  const url = `${getServerEnv().appUrl}/invitation/${token}`;
  await sendEmail(
    invitationEmail({ to: email, name: invitation.name, inviterName: input.actor?.name ?? null, url }),
  );
  await recordAudit({
    action: input.resend ? "invitation.resent" : "invitation.created",
    actorId: input.actor?.id ?? null,
    targetType: "invitation",
    targetId: invitation.id,
    after: { name: invitation.name, expiresAt: invitation.expiresAt.toISOString() },
  });
  return { ok: true, url };
}

/** Invitation encore utilisable pour ce jeton, ou null. */
export async function findValidInvitation(token: string, now = new Date()) {
  return getDb().invitation.findFirst({
    where: {
      tokenHash: hashInvitationToken(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, email: true, name: true, invitedBy: { select: { name: true } } },
  });
}

/**
 * Active un compte à partir d'une invitation. L'invitation est « réservée » de façon atomique
 * avant la création du compte : deux envois simultanés ne créent jamais deux comptes.
 */
export async function acceptInvitation(input: {
  token: string;
  password: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: InvitationError }> {
  const env = getServerEnv();
  const problem = await checkNewPassword(input.password, {
    breachCheck: env.PASSWORD_BREACH_CHECK === "on" ? isPasswordBreached : null,
  });
  if (problem) return { ok: false, error: problem };

  const db = getDb();
  const invitation = await findValidInvitation(input.token);
  if (!invitation) return { ok: false, error: "invalid_or_expired" };

  const claimed = await db.invitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, error: "invalid_or_expired" };

  try {
    if (await db.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) {
      return { ok: false, error: "already_member" };
    }
    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.createUser(
      {
        email: invitation.email,
        name: invitation.name,
        emailVerified: true,
        role: "associe",
      },
      { method: "invitation" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(input.password),
    });
    await recordAudit({
      action: "invitation.accepted",
      actorId: user.id,
      targetType: "invitation",
      targetId: invitation.id,
    });
    return { ok: true, email: invitation.email };
  } catch (error) {
    await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: null } });
    throw error;
  }
}
