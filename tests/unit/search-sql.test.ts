import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Garde-fous statiques sur les requêtes de la recherche globale (exécutées en e2e sur PostgreSQL).
const source = readFileSync(
  fileURLToPath(new URL("../../src/features/search/service.ts", import.meta.url)),
  "utf8",
);
const queries = [...source.matchAll(/\$queryRaw<[^>]+>`([^`]*)`/g)].map((m) => m[1]);
const sql = queries.join("\n");

describe("requêtes de la recherche globale", () => {
  it("uniquement des gabarits paramétrés ($queryRaw`…`), jamais de SQL brut construit", () => {
    expect(source).not.toMatch(/\$queryRawUnsafe|\$executeRawUnsafe|Prisma\.raw|Prisma\.sql/);
    expect(queries).toHaveLength(8);
  });
  it("chaque LIKE échappe ses jokers et compare des textes repliés (unaccent + lower)", () => {
    const likes = sql.match(/\bLIKE\b[^\n]*/g) ?? [];
    expect(likes.length).toBeGreaterThanOrEqual(8);
    for (const like of likes) expect(like).toMatch(/^LIKE q\.(pat|pre) ESCAPE '\\\\'/);
    for (const query of queries) expect(query).toContain("unaccent(lower(${like}::text)) AS pat");
  });
  it("archives exclues partout, événements annulés exclus", () => {
    for (const alias of ["p", "c", "ct", "o", "t", "f", "n"])
      expect(sql).toContain(`${alias}."archivedAt" IS NULL`);
    expect(sql).toContain(`e."cancelledAt" IS NULL`);
  });
  it("événements : même règle de visibilité que l'agenda (partagé, organisateur ou participant)", () => {
    expect(sql).toMatch(/e\."visibility" = 'PARTAGE'\s+OR e\."ownerId" = \$\{viewer\.id\}/);
    expect(sql).toMatch(/"event_attendee" a WHERE a\."eventId" = e\."id" AND a\."userId" = \$\{viewer\.id\}/);
  });
});
