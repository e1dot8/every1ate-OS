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

// Les fichiers changent au déploiement, pas pendant l'exécution : une recherche par prénom suffit.
const cache = new Map<string, string | null>();

export function portraitFor(name: string): string | null {
  const slug = portraitSlug(name);
  if (!slug) return null;
  if (!cache.has(slug)) {
    const ext = ["png", "webp", "jpg"].find((e) => existsSync(path.join(DIR, `${slug}.${e}`)));
    cache.set(slug, ext ? `/brigade/${slug}.${ext}` : null);
  }
  return cache.get(slug)!;
}
