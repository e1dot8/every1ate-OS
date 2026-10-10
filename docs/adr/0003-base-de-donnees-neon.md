# ADR-0003 — PostgreSQL hébergé sur Neon (région UE)

- **Statut** : Acceptée — 10/10/2026

## Contexte

L'application est serverless (fonctions Netlify) et multi-utilisateur : SQLite est exclu
(§18.2). Il faut un PostgreSQL managé, proche des utilisateurs (France), avec sauvegardes.

## Décision

**Neon PostgreSQL**, région UE (Francfort).

- `DATABASE_URL` : URL du **pooler** (runtime de l'application).
- `DIRECT_DATABASE_URL` : URL **directe** (migrations Prisma).
- Une branche Neon par environnement : `main` = production, une branche `preview` pour les deploy previews.

## Migrations

- `prisma migrate dev` en local uniquement.
- `prisma migrate deploy` au build Netlify **de production uniquement** (applique les migrations versionnées, ne réinitialise jamais).
- Interdit en production : `migrate reset`, `db push`, suppression manuelle de table.

## À vérifier avant production (§17, §24.3)

- Fenêtre de restauration à un instant donné selon le forfait Neon choisi.
- Sauvegarde logique quotidienne indépendante (`pg_dump` vers stockage externe) — lot 7.
- RPO/RTO à fixer par les associés.

## Alternatives écartées

- Supabase : solide, mais pousse vers son propre système d'auth et ajoute une plateforme.
- Base auto-hébergée : charge d'exploitation injustifiée pour trois utilisateurs.
