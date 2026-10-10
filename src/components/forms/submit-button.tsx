"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Bouton d'envoi : désactivé pendant l'envoi pour éviter les doubles soumissions. */
export function SubmitButton({
  children,
  pendingLabel = "Envoi…",
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "destructive" | "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
