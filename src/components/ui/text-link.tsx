import Link from "next/link";
import { cn } from "@/lib/utils";

/** Lien texte souligné, cible tactile confortable. */
export function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-tap items-center gap-1.5 text-sm font-bold underline underline-offset-4 decoration-pen hover:decoration-2",
        className,
      )}
      {...props}
    />
  );
}
