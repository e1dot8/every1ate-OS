import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import type { BuildingPhoto } from "@/features/maison/components/building-map";

/**
 * Visuels d'ambiance (lot G8) : des textures noir et blanc tirées de la vidéo « WOK » de la
 * marque (recadrages, négatifs, contours), sans personne visible, déposées dans
 * `public/maison/`. Tant qu'un fichier manque, la page garde sa version dessinée ou neutre :
 * jamais d'image cassée.
 */
const DIR = path.join(process.cwd(), "public", "maison");

export const AMBIANCES = ["appartement", "bureau"] as const;
export const TEXTURE_COUNT = 14;

/** Index stable dans la réserve de textures pour une clé donnée (même recette, même image). */
export function textureIndex(seed: string, count = TEXTURE_COUNT): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % count) + 1;
}

/** Texture d'ambiance d'un élément (recette, carte…), variée d'un élément à l'autre. */
export function textureFor(seed: string): string | null {
  const n = String(textureIndex(seed)).padStart(2, "0");
  return existsSync(path.join(DIR, "textures", `t${n}.jpg`)) ? `/maison/textures/t${n}.jpg` : null;
}
export type Ambiance = (typeof AMBIANCES)[number];

const find = (name: string) => {
  for (const ext of ["webp", "jpg", "png"]) {
    if (existsSync(path.join(DIR, `${name}.${ext}`))) return `/maison/${name}.${ext}`;
  }
  return null;
};

/** Rendu réaliste du bâtiment (4:3), s'il est présent. */
export function buildingPhoto(): BuildingPhoto | null {
  const src = find("batiment");
  return src ? { src, width: 1456, height: 1088 } : null;
}

/** Photo d'ambiance d'un espace ou d'une catégorie de recette, s'il y en a une. */
export function ambiance(name: string): string | null {
  return (AMBIANCES as readonly string[]).includes(name) ? find(name) : null;
}
