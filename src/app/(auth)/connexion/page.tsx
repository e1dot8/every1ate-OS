import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

export default function SignInPage() {
  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Connexion</h1>
        <p className="text-muted-foreground">Espace réservé aux associés d&apos;EVERY1.ATE.</p>
      </header>
      <Suspense>
        <SignInForm />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Session conservée 7 jours sur cet appareil. Vous pouvez la fermer à distance depuis Plus › Sécurité.
      </p>
    </>
  );
}
