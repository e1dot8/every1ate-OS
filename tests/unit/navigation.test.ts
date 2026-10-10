import { describe, expect, it } from "vitest";
import { primaryNav } from "@/lib/navigation";

describe("navigation principale", () => {
  it("suit l'ordre du cahier des charges (§4.1)", () => {
    expect(primaryNav.map((item) => item.label)).toEqual(["Accueil", "Tâches", "Projets", "CRM", "Plus"]);
  });

  it("n'active que les sections réellement livrées", () => {
    const enabled = primaryNav.filter((item) => item.comingInLot === undefined).map((item) => item.href);
    expect(enabled).toEqual(["/"]);
  });
});
