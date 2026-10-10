import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Nouveau mot de passe</h1>
        <p className="text-muted-foreground">Vos autres appareils seront déconnectés.</p>
      </header>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
