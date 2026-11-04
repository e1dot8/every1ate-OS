import { describe, expect, it } from "vitest";
import { primaryNav } from "@/lib/navigation";

describe("navigation principale", () => {
  it("suit l'ordre du cahier des charges (§4.1)", () => {
    expect(primaryNav.map((item) => item.label)).toEqual([
      "Accueil",
      "Tâches",
      "Livrables",
      "Projets",
      "CRM",
      "Discussions",
      "Plus",
    ]);
  });

  it("n'active que les sections réellement livrées", () => {
    const enabled = primaryNav.filter((item) => item.comingInLot === undefined).map((item) => item.href);
    expect(enabled).toEqual(["/", "/taches", "/livrables", "/projets", "/crm", "/discussions", "/plus"]);
  });

  it("garde six entrées au plus dans la barre basse mobile", () => {
    expect(primaryNav.filter((item) => item.mobile !== false).length).toBeLessThanOrEqual(6);
  });
});
