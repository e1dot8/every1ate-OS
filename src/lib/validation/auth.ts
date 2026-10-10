import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Adresse e-mail invalide." }));
const newPassword = z.string().min(1, { message: "Mot de passe requis." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { message: "Mot de passe requis." }),
  next: z.string().optional(),
});

export const requestResetSchema = z.object({ email });

const confirmMatches = (data: { password: string; confirm: string }) => data.password === data.confirm;
const confirmIssue = { path: ["confirm"], message: "Les deux saisies ne sont pas identiques." };

export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password: newPassword, confirm: z.string() })
  .refine(confirmMatches, confirmIssue);

export const acceptInvitationSchema = z
  .object({ token: z.string().min(1), password: newPassword, confirm: z.string() })
  .refine(confirmMatches, confirmIssue);

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, { message: "Mot de passe actuel requis." }),
    password: newPassword,
    confirm: z.string(),
  })
  .refine(confirmMatches, confirmIssue);

export const inviteSchema = z.object({
  name: z.string().trim().min(1, { message: "Prénom requis." }).max(80),
  email,
});

/** N'autorise que des chemins internes (évite les redirections ouvertes). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
