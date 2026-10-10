"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";
import { acceptInvitation } from "@/lib/auth/invitations";
import { passwordProblemMessages, type PasswordProblem } from "@/lib/auth/password-policy";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import {
  acceptInvitationSchema,
  requestResetSchema,
  resetPasswordSchema,
  safeNextPath,
  signInSchema,
} from "@/lib/validation/auth";

function errorCode(error: unknown): string | undefined {
  return isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  try {
    await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, rememberMe: true },
      headers: await headers(),
    });
  } catch (error) {
    if (errorCode(error) === "LOGIN_THROTTLED") {
      return { status: "blocked", message: "Trop de tentatives.", values: keptValues(formData) };
    }
    if (!isAPIError(error)) throw error;
    // Message neutre : on ne révèle pas si l'adresse existe.
    return {
      status: "error",
      message: "E-mail ou mot de passe incorrect.",
      fieldErrors: { password: "Saisie conservée, sauf le mot de passe." },
      values: keptValues(formData),
    };
  }
  redirect(safeNextPath(parsed.data.next));
}

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  try {
    await getAuth().api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reinitialiser" },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    if (error.statusCode === 429) {
      return {
        status: "blocked",
        message: "Trop de demandes. Réessayez dans 15 minutes.",
        values: keptValues(formData),
      };
    }
  }
  // Même réponse que l'adresse existe ou non.
  return { status: "success" };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  try {
    await getAuth().api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    const code = errorCode(error)?.toLowerCase() as PasswordProblem | undefined;
    if (code && code in passwordProblemMessages) {
      return {
        status: "error",
        message: "Mot de passe refusé.",
        fieldErrors: { password: passwordProblemMessages[code] },
      };
    }
    return { status: "error", message: "Ce lien a expiré ou a déjà servi. Demandez un nouveau lien." };
  }
  redirect("/connexion?reinitialise=1");
}

export async function acceptInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await acceptInvitation({ token: parsed.data.token, password: parsed.data.password });
  if (!result.ok) {
    if (result.error in passwordProblemMessages) {
      return {
        status: "error",
        message: "Mot de passe refusé.",
        fieldErrors: { password: passwordProblemMessages[result.error as PasswordProblem] },
      };
    }
    return {
      status: "error",
      message:
        result.error === "already_member"
          ? "Un compte existe déjà pour cette adresse. Connectez-vous."
          : "Cette invitation a expiré ou a déjà servi. Demandez-en une nouvelle à un associé.",
    };
  }

  await getAuth().api.signInEmail({
    body: { email: result.email, password: parsed.data.password, rememberMe: true },
    headers: await headers(),
  });
  redirect("/");
}
