import { ShieldCheck } from "lucide-react";

/** Règles affichées avant la saisie (vérifiées côté serveur). */
export function PasswordRules() {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground" aria-label="Règles du mot de passe">
      {[
        "12 caractères minimum",
        "Absent des fuites de données connues",
        "Les deux saisies sont identiques",
      ].map((rule) => (
        <li key={rule} className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-success" />
          {rule}
        </li>
      ))}
    </ul>
  );
}
