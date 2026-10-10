<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Règles du projet Every1.ate OS

1. Lire `docs/CAHIER_DES_CHARGES.md` et `docs/adr/` avant toute modification.
2. Un lot à la fois. Avant chaque lot : présenter fichiers et migrations prévus, attendre l'accord.
3. Toute mutation : validation serveur (Zod) + contrôle d'accès côté serveur. Masquer un bouton ne protège rien.
4. Opérations financières et modifications sensibles : journal d'audit (avant/après, auteur, date).
5. Migrations Prisma versionnées uniquement. Jamais de `migrate reset` / `db push` en production.
6. Montants : `Decimal`, jamais de flottants. Dates : stockées en UTC.
7. Aucune donnée réelle sensible dans les seeds ou les tests. Aucun secret commité.
8. Ne pas simuler une fonctionnalité future : une entrée non livrée est désactivée et étiquetée.
9. Toute règle métier nouvelle a un test. Prévoir les états loading, empty, error, offline, unauthorized.
10. Fin de lot : `pnpm verify` et `pnpm test:e2e` au vert, puis résumé (changements, commandes, tests, blocages).
