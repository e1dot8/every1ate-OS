# Every1.ate OS

Outil interne de pilotage de l'agence EVERY1.ATE : projets, CRM, finance, temps, calendrier.
Application privée, PWA mobile-first. Spécification : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).
Décisions techniques : [`docs/adr/`](docs/adr/README.md).
Maquettes : [Figma — Every1.ate OS](https://www.figma.com/design/bjxpFBYomtYT8yJOZKCV4X) (une page par lot).

**État : lot 0, socle technique** (application minimale, base de données, design system initial, CI).

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 6 · Tailwind CSS 4 · composants shadcn/ui ·
Prisma 7 + PostgreSQL (Neon) · Netlify · Vitest · Playwright.

## Structure

```
src/
├── app/                 routes Next.js (pages, api/health, manifest PWA)
├── components/ui/       composants du design system (format shadcn)
├── components/nav/      navigation (barre basse mobile, rail ordinateur)
├── features/            modules métier — à partir du lot 2
├── lib/
│   ├── env.ts           variables d'environnement validées (Zod)
│   ├── db/client.ts     client Prisma unique
│   ├── health.ts        contrôle de santé
│   └── navigation.ts    entrées de navigation
└── generated/prisma/    client Prisma généré (non versionné)
prisma/                  schéma, migrations versionnées, seed
netlify/functions/       tâches planifiées
tests/unit/ · tests/e2e/ tests Vitest et Playwright
docs/                    cahier des charges, ADR
```

## Démarrer en local

Prérequis : Node 22, pnpm 10, PostgreSQL 16 local (ou une branche Neon de développement).

```bash
pnpm install
cp .env.example .env          # puis renseigner DATABASE_URL
pnpm db:migrate               # applique les migrations sur la base locale
pnpm db:seed                  # données techniques uniquement
pnpm dev                      # http://localhost:3000
```

## Commandes de vérification

| Commande            | Rôle                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `pnpm lint`         | ESLint, 0 avertissement toléré                                          |
| `pnpm format:check` | Prettier                                                                |
| `pnpm typecheck`    | Génération Prisma + types de routes + `tsc --noEmit`                    |
| `pnpm test`         | Tests unitaires (Vitest)                                                |
| `pnpm build`        | Build de production                                                     |
| `pnpm check:bundle` | Vérifie qu'aucun secret n'est présent dans le code envoyé au navigateur |
| `pnpm test:e2e`     | Tests end-to-end (Playwright, mobile + ordinateur) — après `pnpm build` |
| `pnpm db:status`    | État des migrations                                                     |
| `pnpm verify`       | lint + typecheck + test + build + check:bundle                          |

Règle : un lot n'est pas terminé tant que ces contrôles ne passent pas (CI GitHub incluse).

## Déployer sur Netlify (première fois)

> **Crédits** : une mise en production coûte 15 crédits Netlify. Elle n'est lancée que si le
> message du dernier commit contient `[deploy]` (voir [ADR-0007](docs/adr/0007-deploiement-econome.md)).
> Les deploy previews et branch deploys sont gratuits et ne sont jamais bloqués.

1. **Neon** : créer un projet, région _AWS Europe Central (Frankfurt)_. Créer une branche `preview`.
   Noter pour chaque branche l'URL _pooled_ et l'URL _direct_.
2. **Netlify** : _Add new site → Import an existing project → GitHub →_ `every1ate-os`, branche `main`.
   Laisser les réglages de build (lus depuis `netlify.toml`).
3. **Variables** (_Site configuration → Environment variables_), avec des valeurs par contexte :
   - `DATABASE_URL` : production = URL pooled de `main` ; deploy previews / branch deploys = URL pooled de `preview`.
   - `DIRECT_DATABASE_URL` : production = URL directe de `main` (migrations au build).
   - Cocher _Contains secret values_ pour les deux.
4. Pousser un commit dont le message contient `[deploy]`. Vérifier `https://<site>.netlify.app/api/health` → `{"status":"ok",...}`.
5. Pour les deploy previews : appliquer les migrations sur la branche `preview`
   (`DIRECT_DATABASE_URL=<url preview> pnpm db:deploy`).

Les migrations de production s'exécutent au build (`prisma migrate deploy`) : elles appliquent
uniquement les migrations versionnées et ne réinitialisent jamais la base.

## Règles de travail

Voir [`AGENTS.md`](AGENTS.md).
