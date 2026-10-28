import { describe, expect, it } from "vitest";
import { navGroups, primaryNav, utilityNav } from "@/lib/navigation";

describe("navigation principale", () => {
  it("barre mobile : le travail d'abord, la maison à un tap", () => {
    expect(primaryNav.map((item) => item.label)).toEqual([
      "Cockpit",
      "Tâches",
      "Projets",
      "La maison",
      "Plus",
    ]);
  });

  it("n'active que les sections réellement livrées", () => {
    const enabled = primaryNav.filter((item) => item.comingInLot === undefined).map((item) => item.href);
    expect(enabled).toEqual(["/", "/taches", "/projets", "/maison", "/plus"]);
  });

  it("rail en trois niveaux : travail, maison, outils ; aucune adresse en double", () => {
    expect(navGroups.map((g) => g.title)).toEqual(["Mon travail", "Espaces", "Outils"]);
    const hrefs = [...navGroups.flatMap((g) => g.items.map((i) => i.href)), ...utilityNav.map((i) => i.href)];
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(navGroups[0].items[0].href).toBe("/");
  });

  it("pied du rail : courrier, recherche, réglages", () => {
    expect(utilityNav.map((i) => i.href)).toEqual(["/notifications", "/recherche", "/plus"]);
  });
});
