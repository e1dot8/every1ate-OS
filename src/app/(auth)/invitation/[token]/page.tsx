import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { TextLink } from "@/components/ui/text-link";
import { findValidInvitation } from "@/lib/auth/invitations";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const metadata: Metadata = { title: "Activer mon compte" };

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  await connection(); // lecture à la requête : l'expiration dépend de l'heure courante
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  if (!invitation) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Invitation indisponible</h1>
        <FormAlert tone="danger" title="Cette invitation a expiré ou a déjà servi.">
          Demandez à un associé de vous en renvoyer une depuis Plus › Associés.
        </FormAlert>
        <TextLink href="/connexion">Aller à la connexion</TextLink>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Bienvenue, {invitation.name}</h1>
        <p className="text-muted-foreground">
          {invitation.invitedBy ? `${invitation.invitedBy.name} vous a invité(e)` : "Vous êtes invité(e)"} sur
          Every1.ate OS. Choisissez votre mot de passe pour activer votre compte.
        </p>
      </header>
      <AcceptInvitationForm token={token} email={invitation.email} />
    </>
  );
}

export default function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-muted-foreground">
          Vérification de l&apos;invitation…
        </p>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}
