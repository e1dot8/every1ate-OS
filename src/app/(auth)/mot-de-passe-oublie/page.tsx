import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { TextLink } from "@/components/ui/text-link";
import { RequestResetForm } from "./request-reset-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <TextLink href="/connexion" className="w-fit">
        <ArrowLeft aria-hidden="true" className="size-4" /> Retour à la connexion
      </TextLink>
      <RequestResetForm />
    </>
  );
}
