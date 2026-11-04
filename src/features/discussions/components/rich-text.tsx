import { Fragment } from "react";
import { parseInline, type InlineNode } from "@/features/discussions/rules";

/**
 * Corps d'un message : mise en forme légère rendue en éléments React (jamais de HTML injecté).
 * Les liens https s'ouvrent dans un nouvel onglet, sans transmettre l'origine.
 */
function render(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.text}</Fragment>;
      case "break":
        return <br key={key} />;
      case "code":
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] break-words">
            {node.text}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline decoration-pen underline-offset-2 hover:decoration-2"
          >
            {node.text}
          </a>
        );
      case "mention":
        return (
          <span key={key} className="rounded bg-highlight/60 px-0.5 font-bold">
            {node.text}
          </span>
        );
      case "bold":
        return <strong key={key}>{render(node.children, `${key}-`)}</strong>;
      case "italic":
        return <em key={key}>{render(node.children, `${key}-`)}</em>;
    }
  });
}

export function RichText({ body, className }: { body: string; className?: string }) {
  return (
    <div className={className ?? "min-w-0 break-words whitespace-normal"}>
      {render(parseInline(body), "n")}
    </div>
  );
}
