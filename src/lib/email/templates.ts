import type { EmailMessage } from "@/lib/email/send";

const signature = "\n\n— Every1.ate OS\nCet e-mail est automatique, merci de ne pas y répondre.";

export function invitationEmail(input: {
  to: string;
  name: string;
  inviterName: string | null;
  url: string;
}): EmailMessage {
  const from = input.inviterName ? `${input.inviterName} vous invite` : "Vous êtes invité(e)";
  return {
    to: input.to,
    subject: "Votre accès à Every1.ate OS",
    text:
      `Bonjour ${input.name},\n\n${from} à rejoindre Every1.ate OS, l'outil de pilotage de l'agence.\n\n` +
      `Choisissez votre mot de passe pour activer votre compte :\n${input.url}\n\n` +
      `Ce lien est valable 72 heures et ne peut servir qu'une fois.` +
      signature,
  };
}

export function resetPasswordEmail(input: { to: string; name: string; url: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Réinitialiser votre mot de passe",
    text:
      `Bonjour ${input.name},\n\nUne réinitialisation de mot de passe a été demandée pour votre compte.\n\n` +
      `Choisissez un nouveau mot de passe :\n${input.url}\n\n` +
      `Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : ` +
      `votre mot de passe actuel reste valable.` +
      signature,
  };
}
