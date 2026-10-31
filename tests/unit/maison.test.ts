import { describe, expect, it } from "vitest";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  HOUSE_DECOR,
  ITEMS,
  SLOTS,
  defaultLayout,
  houseDecorFor,
  isUnlocked,
  resolveLayout,
  validLook,
  type Progress,
} from "@/features/maison/cosmetics";
import { ROOMS } from "@/features/maison/rooms";
import { BADGES } from "@/features/badges/catalog";

const newbie: Progress = { level: 1, rankKey: "apprenti", rankLevel: 1, badges: new Set() };

describe("pièces de la maison", () => {
  it("entre 4 et 6 pièces, chacune ouvrable ou explicitement à venir", () => {
    expect(ROOMS.length).toBeGreaterThanOrEqual(4);
    expect(ROOMS.length).toBeLessThanOrEqual(6);
    for (const r of ROOMS) expect(Boolean(r.href) !== Boolean(r.comingSoon)).toBe(true);
  });
  it("une seule pièce par emplacement du bâtiment, numéros uniques", () => {
    const cells = ROOMS.map((r) => ("annex" in r.cell ? "annexe" : `${r.cell.floor}:${r.cell.column}`));
    expect(new Set(cells).size).toBe(ROOMS.length);
    expect(ROOMS.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("le parcours de la maison : la Salle (CRM) dehors, la Cuisine (production) dedans", () => {
    expect(ROOMS.find((r) => r.key === "salle")?.href).toBe("/crm/salle");
    expect(ROOMS.find((r) => r.key === "cuisine")?.href).toBe("/cuisine");
  });
});

describe("déblocages cosmétiques", () => {
  it("suivent le niveau, le rang et les badges existants", () => {
    expect(isUnlocked({ kind: "default" }, newbie)).toBe(true);
    expect(isUnlocked({ kind: "level", level: 3 }, newbie)).toBe(false);
    expect(isUnlocked({ kind: "level", level: 3 }, { ...newbie, level: 3 })).toBe(true);
    expect(isUnlocked({ kind: "rank", key: "commis", title: "Commis" }, newbie)).toBe(false);
    expect(
      isUnlocked({ kind: "rank", key: "commis", title: "Commis" }, { ...newbie, rankKey: "sous-chef" }),
    ).toBe(true);
    expect(
      isUnlocked(
        { kind: "badge", key: "main-tendue", name: "" },
        { ...newbie, badges: new Set(["main-tendue"]) },
      ),
    ).toBe(true);
  });

  it("chaque badge cité pour un déblocage existe dans le catalogue", () => {
    const keys = new Set(BADGES.map((b) => b.key));
    const unlocks = [
      ...ITEMS.map((i) => i.unlock),
      ...Object.values(AVATAR_OPTIONS)
        .flat()
        .map((o) => o.unlock),
    ];
    for (const u of unlocks) if (u.kind === "badge") expect(keys.has(u.key)).toBe(true);
  });

  it("l'avatar par défaut est accessible à tous ; une option verrouillée est refusée côté serveur", () => {
    expect(validLook(DEFAULT_AVATAR, newbie)).toBeNull();
    expect(validLook({ ...DEFAULT_AVATAR, hat: "toque-haute" }, newbie)).toMatch(/pas encore débloqué/);
    expect(validLook({ ...DEFAULT_AVATAR, hat: "chapeau-pirate" }, newbie)).toMatch(/inconnue/);
  });

  it("disposition : un objet verrouillé ou mal placé est ignoré, la vitrine peut être vide", () => {
    expect(Object.keys(defaultLayout()).sort()).toEqual(["bureau", "etagere", "lampe", "mur", "sol"]);
    const layout = resolveLayout(
      [
        { slot: "mur", itemKey: "affiche-methode" }, // niveau 2 requis
        { slot: "sol", itemKey: "ordinateur" }, // mauvais emplacement
        { slot: "etagere", itemKey: "vide" },
      ],
      newbie,
    );
    expect(layout.mur).toBe("affiche-cuisine");
    expect(layout.sol).toBe("plante");
    expect(layout.etagere).toBeUndefined();
    expect(resolveLayout([{ slot: "mur", itemKey: "affiche-methode" }], { ...newbie, level: 2 }).mur).toBe(
      "affiche-methode",
    );
  });

  it("chaque emplacement a un objet de départ (sauf la vitrine, qui se mérite)", () => {
    for (const s of SLOTS.filter((s) => s.key !== "vitrine"))
      expect(ITEMS.some((i) => i.slot === s.key && i.unlock.kind === "default")).toBe(true);
    expect(ITEMS.some((i) => i.slot === "vitrine" && i.unlock.kind === "default")).toBe(false);
  });

  it("le décor collectif suit les paliers de la maison", () => {
    expect(houseDecorFor(0).every((d) => !d.unlocked)).toBe(true);
    expect(
      houseDecorFor(10)
        .filter((d) => d.unlocked)
        .map((d) => d.key),
    ).toEqual(["plante-commune", "tableau-projets", "machine-cafe"]);
    expect(HOUSE_DECOR.map((d) => d.points)).toEqual(
      [...HOUSE_DECOR.map((d) => d.points)].sort((a, b) => a - b),
    );
  });
});
