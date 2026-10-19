import { describe, expect, it } from "vitest";
import {
  SEARCH_GROUPS,
  SEARCH_MAX_LENGTH,
  containsFolded,
  containsPattern,
  documentHref,
  escapeLike,
  foldText,
  highlightParts,
  normalizeQuery,
  prefixPattern,
  resultCountLabel,
  snippetAround,
} from "@/features/search/rules";

const marked = (text: string, term: string) =>
  highlightParts(text, term)
    .map((p) => (p.match ? `[${p.text}]` : p.text))
    .join("");

describe("normalisation de la saisie", () => {
  it("vide, absente ou d'un mauvais type", () => {
    expect(normalizeQuery(undefined)).toEqual({ status: "empty", term: "" });
    expect(normalizeQuery("   ")).toEqual({ status: "empty", term: "" });
    expect(normalizeQuery(42)).toEqual({ status: "empty", term: "" });
  });
  it("moins de 2 caractères : pas de recherche", () => {
    expect(normalizeQuery(" é ")).toEqual({ status: "too-short", term: "é" });
    expect(normalizeQuery("%")).toEqual({ status: "too-short", term: "%" });
  });
  it("espaces regroupés, caractères de contrôle retirés", () => {
    expect(normalizeQuery("  éclat \n\t  été\u0000 ")).toEqual({ status: "ok", term: "éclat été" });
  });
  it("paramètre répété : la première valeur", () => {
    expect(normalizeQuery(["projet", "autre"])).toEqual({ status: "ok", term: "projet" });
  });
  it("100 caractères au plus (sans couper un émoji)", () => {
    const long = normalizeQuery("é".repeat(150));
    expect(long.status).toBe("ok");
    expect(Array.from(long.term)).toHaveLength(SEARCH_MAX_LENGTH);
    const emoji = normalizeQuery("😀".repeat(120));
    expect(Array.from(emoji.term)).toHaveLength(SEARCH_MAX_LENGTH);
    expect(emoji.term).toBe("😀".repeat(SEARCH_MAX_LENGTH));
  });
});

describe("échappement LIKE", () => {
  it("échappe %, _ et la barre oblique inverse", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("mot_clé")).toBe("mot\\_clé");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
  });
  it("échappe aussi les sosies que unaccent replie en jokers (％ ﹪ ＿ ＼ ﹨ ∖)", () => {
    // Le motif est replié par unaccent après échappement : \％ devient \% (littéral), pas %.
    expect(escapeLike("50％")).toBe("50\\％");
    expect(escapeLike("a﹪b")).toBe("a\\﹪b");
    expect(escapeLike("mot＿clé")).toBe("mot\\＿clé");
    expect(escapeLike("a＼b﹨c∖d")).toBe("a\\＼b\\﹨c\\∖d");
    expect(containsPattern("％＿")).toBe("%\\％\\＿%");
  });
  it("laisse le reste intact (accents, apostrophes, guillemets)", () => {
    expect(escapeLike("L'Été « 2026 »")).toBe("L'Été « 2026 »");
  });
  it("motifs « contient » et « commence par »", () => {
    expect(containsPattern("50%_off")).toBe("%50\\%\\_off%");
    expect(prefixPattern("a_b")).toBe("a\\_b%");
  });
});

describe("repli des accents et de la casse", () => {
  it("minuscules sans accents, ligatures dépliées", () => {
    expect(foldText("Éclat Été")).toBe("eclat ete");
    expect(foldText("CRÈME BRÛLÉE à l'ŒUF")).toBe("creme brulee a l'oeuf");
    expect(foldText("Ça déçoit")).toBe("ca decoit");
  });
  it("texte déjà décomposé (NFD)", () => {
    expect(foldText("Été")).toBe("ete");
  });
});

describe("correspondance repliée", () => {
  it("contient le terme, sans accents ni casse (sert à choisir l'extrait de description)", () => {
    expect(containsFolded("Éclat Été", "ECLAT ete")).toBe(true);
    expect(containsFolded("Chef-d'Œuvre", "oeuvre")).toBe(true);
    expect(containsFolded("Refonte du site", "été")).toBe(false);
    expect(containsFolded(null, "été")).toBe(false);
    expect(containsFolded("Été", "  ")).toBe(false);
  });
});

describe("surlignage", () => {
  it("trouve le terme sans accents dans un titre accentué, garde l'orthographe d'origine", () => {
    expect(marked("Éclat Été 2026", "eclat ete")).toBe("[Éclat Été] 2026");
    expect(highlightParts("Éclat Été 2026", "eclat ete")).toEqual([
      { text: "Éclat Été", match: true },
      { text: " 2026", match: false },
    ]);
  });
  it("terme accentué sur un texte sans accents, et inversement de casse", () => {
    expect(marked("Campagne ete", "ÉTÉ")).toBe("Campagne [ete]");
  });
  it("toutes les occurrences", () => {
    expect(marked("Été, été et ÉTÉ", "ete")).toBe("[Été], [été] et [ÉTÉ]");
  });
  it("caractères décomposés (NFD) : le surlignage couvre l'accent", () => {
    const parts = highlightParts("Café noir", "café");
    expect(parts[0]).toEqual({ text: "Café", match: true });
  });
  it("ligature : le terme « oe » surligne « Œ »", () => {
    expect(marked("Chef-d'Œuvre", "oeuvre")).toBe("Chef-d'[Œuvre]");
  });
  it("pas de correspondance ou terme vide : texte intact", () => {
    expect(highlightParts("Projet", "zz")).toEqual([{ text: "Projet", match: false }]);
    expect(highlightParts("Projet", "  ")).toEqual([{ text: "Projet", match: false }]);
    expect(highlightParts("", "projet")).toEqual([]);
  });
  it("les jokers sont des caractères comme les autres", () => {
    expect(marked("Remise 50% été", "50%")).toBe("Remise [50%] été");
  });
});

describe("extrait de compte rendu", () => {
  const body =
    "Point hebdomadaire avec l'équipe.\n\nNous avons validé la direction artistique de la campagne d'été " +
    "et le planning de tournage. Prochaine étape : envoyer le devis révisé au client avant vendredi.";

  it("extrait centré sur la correspondance, coupé aux mots, avec « … »", () => {
    const s = snippetAround(body, "devis revise", 20);
    expect(s).toContain("devis révisé");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(100);
    expect(s).not.toMatch(/\n/);
  });
  it("correspondance au début : pas de « … » initial", () => {
    expect(snippetAround(body, "point", 20).startsWith("Point")).toBe(true);
  });
  it("sans correspondance (titre seul) : début du texte", () => {
    const s = snippetAround(body, "introuvable", 20);
    expect(s.startsWith("Point hebdomadaire")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });
  it("texte court ou vide", () => {
    expect(snippetAround("Court", "zz")).toBe("Court");
    expect(snippetAround("   ", "zz")).toBe("");
  });
});

describe("liens et libellés", () => {
  it("document : tâche, puis onglet Docs du projet, puis entreprise, puis bibliothèque", () => {
    const base = { title: "Brief & moodboard", projectId: null, taskId: null, clientId: null };
    expect(documentHref({ ...base, projectId: "p1", taskId: "t1" })).toBe("/taches/t1");
    expect(documentHref({ ...base, projectId: "p1", clientId: "c1" })).toBe("/projets/p1?onglet=docs");
    expect(documentHref({ ...base, clientId: "c1" })).toBe("/crm/clients/c1");
    expect(documentHref(base)).toBe("/documents?q=Brief%20%26%20moodboard");
  });
  it("huit groupes dans l'ordre d'affichage", () => {
    expect(SEARCH_GROUPS.map((g) => g.label)).toEqual([
      "Projets",
      "Entreprises",
      "Contacts",
      "Opportunités",
      "Tâches",
      "Documents",
      "Événements",
      "Comptes rendus",
    ]);
  });
  it("compte de résultats", () => {
    expect(resultCountLabel(0)).toBe("0 résultat");
    expect(resultCountLabel(1)).toBe("1 résultat");
    expect(resultCountLabel(12)).toBe("12 résultats");
  });
});
