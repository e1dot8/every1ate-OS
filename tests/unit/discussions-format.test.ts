import { describe, expect, it } from "vitest";
import {
  extractMentionTokens,
  parseInline,
  resolveMentions,
  type InlineNode,
} from "@/features/discussions/rules";

/** Représentation compacte des nœuds pour comparer facilement. */
function show(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.text;
        case "break":
          return "⏎";
        case "code":
          return `<code>${n.text}</code>`;
        case "link":
          return `<a ${n.href}>`;
        case "mention":
          return `<@${n.text.slice(1)}>`;
        case "bold":
          return `<b>${show(n.children)}</b>`;
        case "italic":
          return `<i>${show(n.children)}</i>`;
      }
    })
    .join("");
}
const md = (s: string) => show(parseInline(s));

describe("mise en forme légère", () => {
  it("gras, italique, code et retours à la ligne", () => {
    expect(md("**gras** et *aussi* puis _penché_ et `code`")).toBe(
      "<b>gras</b> et <b>aussi</b> puis <i>penché</i> et <code>code</code>",
    );
    expect(md("ligne 1\nligne 2")).toBe("ligne 1⏎ligne 2");
    expect(md("**_gras penché_**")).toBe("<b><i>gras penché</i></b>");
  });

  it("ne transforme pas les noms à tirets bas ni les étoiles isolées", () => {
    expect(md("fichier_final_v2.mp4")).toBe("fichier_final_v2.mp4");
    expect(md("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(md("**ouvert sans fin")).toBe("**ouvert sans fin");
    expect(md("_pas\nfermé_")).toBe("_pas⏎fermé_");
  });

  it("le code n'est jamais interprété", () => {
    expect(md("`**pas gras** @Pierre https://x.fr`")).toBe("<code>**pas gras** @Pierre https://x.fr</code>");
  });

  it("liens https automatiques, ponctuation finale exclue", () => {
    expect(md("Voir https://drive.google.com/x?id=1.")).toBe("Voir <a https://drive.google.com/x?id=1>.");
    expect(md("(https://exemple.fr/page)")).toBe("(<a https://exemple.fr/page>)");
    expect(md("https://fr.wikipedia.org/wiki/Paris_(France)")).toBe(
      "<a https://fr.wikipedia.org/wiki/Paris_(France)>",
    );
    expect(md("http://non-securise.fr")).toBe("http://non-securise.fr");
    expect(md("javascript:alert(1)")).toBe("javascript:alert(1)");
  });

  it("aucun HTML : les chevrons restent du texte", () => {
    expect(md("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
    const nodes = parseInline("<script>alert(1)</script>");
    expect(nodes).toEqual([{ type: "text", text: "<script>alert(1)</script>" }]);
  });

  it("mentions, mais pas les adresses e-mail", () => {
    expect(md("Merci @Pierre, et @Zoé-Lou.")).toBe("Merci <@Pierre>, et <@Zoé-Lou>.");
    expect(md("contact@exemple.fr")).toBe("contact@exemple.fr");
  });
});

describe("mentions", () => {
  const people = [
    { id: "j", name: "Johan Durand" },
    { id: "c", name: "Charles" },
    { id: "p", name: "Pierre" },
    { id: "z", name: "Zoé Martin" },
  ];

  it("extrait les mots mentionnés, sans doublon ni code", () => {
    expect(extractMentionTokens("@Pierre et @pierre, @ici `@Charles` mail@x.fr")).toEqual(["Pierre", "ici"]);
  });

  it("résout par prénom ou nom complet, sans accents ni casse", () => {
    expect(resolveMentions(["pierre", "ZOE", "JohanDurand"], people, null)).toEqual({
      ids: ["p", "z", "j"],
      here: false,
      ambiguous: [],
    });
  });

  it("l'auteur ne se mentionne pas ; @ici ; inconnus ignorés", () => {
    expect(resolveMentions(["Charles", "ici", "Inconnu"], people, "c")).toEqual({
      ids: [],
      here: true,
      ambiguous: [],
    });
  });

  it("prénom partagé : personne n'est mentionné", () => {
    const twins = [...people, { id: "p2", name: "Pierre Lenoir" }];
    expect(resolveMentions(["Pierre"], twins, null)).toEqual({ ids: [], here: false, ambiguous: ["Pierre"] });
    expect(resolveMentions(["PierreLenoir"], twins, null).ids).toEqual(["p2"]);
  });
});
