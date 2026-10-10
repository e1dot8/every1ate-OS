"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth/auth";
import { createInvitation } from "@/lib/auth/invitations";
import { passwordProblemMessages, type PasswordProblem } from "@/lib/auth/password-policy";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { changePasswordSchema, inviteSchema } from "@/lib/validation/auth";

export async function signOutAction() {
  await requireUser();
  await getAuth().api.signOut({ headers: await headers() });
  // « deconnecte » déclenche la purge des caches (en-tête Clear-Site-Data + nettoyage côté client).
  redirect("/connexion?deconnecte=1");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: parsed.data.current,
        newPassword: parsed.data.password,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    const code = (error.body as { code?: string } | undefined)?.code?.toLowerCase() as
      PasswordProblem | undefined;
    if (code && code in passwordProblemMessages) {
      return {
        status: "error",
        message: "Mot de passe refusé.",
        fieldErrors: { password: passwordProblemMessages[code] },
      };
    }
    return {
      status: "error",
      message: "Mot de passe actuel incorrect.",
      fieldErrors: { current: "Vérifiez votre saisie." },
    };
  }
  revalidatePath("/plus/securite");
  return { status: "success", message: "Mot de passe mis à jour. Vos autres appareils ont été déconnectés." };
}

const sessionIdSchema = z.object({ sessionId: z.string().min(1) });

/** Déconnecte un appareil. Le jeton de session n'est jamais exposé au navigateur : on passe par l'identifiant. */
export async function revokeSessionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const session = await getDb().session.findFirst({
    where: { id: parsed.data.sessionId, userId: user.id },
    select: { token: true },
  });
  if (!session) return; // session d'un autre utilisateur ou déjà fermée : rien à faire
  await getAuth().api.revokeSession({ body: { token: session.token }, headers: await headers() });
  revalidatePath("/plus/securite");
}

export async function revokeOtherSessionsAction() {
  await requireUser();
  await getAuth().api.revokeOtherSessions({ headers: await headers() });
  revalidatePath("/plus/securite");
}

export async function inviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await createInvitation({ ...parsed.data, actor: { id: user.id, name: user.name } });
  if (!result.ok) {
    return {
      status: "error",
      message: "Invitation impossible.",
      fieldErrors: { email: "Un compte existe déjà pour cette adresse." },
      values: keptValues(formData),
    };
  }
  revalidatePath("/plus/associes");
  return { status: "success", message: `Invitation envoyée à ${parsed.data.email}.` };
}

const invitationIdSchema = z.object({ invitationId: z.string().min(1) });

export async function resendInvitationAction(formData: FormData) {
  const user = await requireUser();
  const parsed = invitationIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const invitation = await getDb().invitation.findFirst({
    where: { id: parsed.data.invitationId, acceptedAt: null },
    select: { email: true, name: true },
  });
  if (!invitation) return;
  await createInvitation({ ...invitation, actor: { id: user.id, name: user.name }, resend: true });
  revalidatePath("/plus/associes");
}
