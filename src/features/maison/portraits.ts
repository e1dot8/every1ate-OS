import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Portraits de la brigade (lot G8) : visuels « photocopie » fournis par les associés, déposés
 * dans `public/brigade/<prénom>.png` (prénom en minuscules, sans accent). Quand un portrait
 * existe, il remplace l'avatar dessiné ; sinon l'avatar personnalisable reste affiché.
 */
const DIR = path.join(process.cwd(), "public", "brigade");

export const portraitSlug = (name: string) =>
  (name.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

export function portraitFor(name: string): string | null {
  const slug = portraitSlug(name);
  if (!slug) return null;
  for (const ext of ["png", "webp", "jpg"]) {
    if (existsSync(path.join(DIR, `${slug}.${ext}`))) return `/brigade/${slug}.${ext}`;
  }
  return null;
}
