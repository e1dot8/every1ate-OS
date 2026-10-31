import { SYNTAX_EXAMPLE, SYNTAX_HINT } from "@/features/notes/labels";

/** Rappel de la syntaxe des actions, avec un exemple à recopier. */
export function SyntaxHelp() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{SYNTAX_HINT}</p>
      <p className="font-bold text-foreground">Exemple :</p>
      <pre className="rounded-lg border bg-muted/50 p-3 font-mono text-[13px] whitespace-pre-wrap text-foreground">
        {SYNTAX_EXAMPLE}
      </pre>
    </div>
  );
}
