# Every1.ate OS

Outil interne de pilotage de l'agence EVERY1.ATE : projets, CRM, finance, temps, calendrier.
Application privée, PWA mobile-first. Spécification : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).
Décisions techniques : [`docs/adr/`](docs/adr/README.md).
Maquettes : [Figma — Every1.ate OS](https://www.figma.com/design/bjxpFBYomtYT8yJOZKCV4X) (une page par lot).

**État : V1 complète (lots 0 à 7), prête pour le pilote interne.** V2 (portail clients/prestataires, lot 8) : à venir.

| Lot | Contenu                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------- |
| 1   | Connexion par invitation, mot de passe oublié, appareils connectés, journal d'audit                       |
| 2   | Projets, lots, tâches, dépendances, statuts, modèles, clôture, archives                                   |
| 3   | Roadmap/Gantt, jalons, chronomètre et saisie du temps, priorité expliquée, notifications et escalade 48 h |
| 4   | CRM : entreprises, contacts, pipeline 7 étapes, prévisions, relances, conversion en projet                |
| 5   | Finance : budgets, coûts, échéancier, encaissements, marges, MRR, imports CSV/Excel, gouvernance, cockpit |
| 6   | Calendrier interne, abonnement ICS Google/Apple, références Google Drive                                  |
| 7   | PWA (cache limité, hors ligne, purge à la déconnexion), sauvegardes, durcissement sécurité                |

### Every1.ate OS — cockpit, rituels et progression (lots G1 à G5, [ADR-0017](docs/adr/0017-os-progression-brigade.md))

| Lot | Contenu                                                                                                                                                                                                                 | Pages                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| G1  | Cockpit personnel (3 priorités, courrier, temps, projets), XP idempotents, niveaux et rangs culinaires configurables                                                                                                    | `/`, `/priorites`, `/progression`                      |
| G2  | Pause/reprise du chrono, catégories, tâches internes (« La maison »), estimations, restant, écart, mini-bilan                                                                                                           | `/taches/[id]`, `/temps/rapport`                       |
| G3  | La mise en place (briefing quotidien) et le menu de la semaine (hebdomadaire, historisé)                                                                                                                                | `/mise-en-place`, `/service`                           |
| G4  | Le courrier (3 niveaux, archive, @mentions) et La Salle, ex-« La Cuisine » (CRM : À risque, En attente, À encaisser, À développer)                                                                                      | `/notifications`, `/crm/salle`                         |
| G5  | Compétences (6 branches), badges, série de régularité, préférences, bureau commun et fil de la brigade                                                                                                                  | `/competences`, `/bureau`, `/plus/preferences`         |
| G6  | La maison ([ADR-0018](docs/adr/0018-la-maison-univers.md)) : bâtiment interactif, avatar, appartement et objets, carnet de recettes, réactions, demandes d'aide, disponibilité                                          | `/maison`, `/appartement`, `/cuisine`, `/recettes`     |
| G7  | Direction éditoriale ([ADR-0019](docs/adr/0019-direction-editoriale-et-niveaux.md)) : jetons, rail en 3 niveaux, bâtiment monochrome, La Cuisine / La Salle / Le service de la semaine, XP discrets, partage des badges | `/`, `/maison`, `/cuisine`, `/crm/salle`, `/service`   |
| G8  | Maquette « La maison » ([ADR-0020](docs/adr/0020-panneaux-et-style-photocopie.md)) : panneaux, rail en carte, textures WOK, bannière vidéo, portraits                                                                   | `/`, `/maison`, `/appartement`, `/bureau`, `/recettes` |
| G9  | Quêtes de la semaine ([ADR-0021](docs/adr/0021-quetes-hebdomadaires.md)) : 7 quêtes mesurées sur le vrai travail, 3 par semaine, XP une seule fois                                                                      | `/quetes`, `/`                                         |

Barème d'XP, paliers et rangs : `src/features/progression/config.ts`. Badges : `src/features/badges/catalog.ts`.
Arbre de compétences : `src/features/skills/tree.ts`. Seuils de La Cuisine : Réglages CRM.
Objets et avatars : `src/features/maison/cosmetics.ts`. Pièces : `src/features/maison/rooms.ts`.
À venir : quêtes, portail client (lot 8, avec maquette Figma).

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 6 · Tailwind CSS 4 · composants shadcn/ui ·
Prisma 7 + PostgreSQL (Neon) · Netlify · Vitest · Playwright.

## Structure

```
src/
├── app/                 routes Next.js (pages, api/health, manifest PWA)
├── components/ui/       composants du design system (format shadcn)
├── components/nav/      navigation (barre basse mobile, rail ordinateur)
├── features/            modules métier : projects, planning, time, crm, finance,
│                        calendar, documents, notifications (règles pures + services)
├── lib/
│   ├── env.ts           variables d'environnement validées (Zod)
│   ├── db/client.ts     client Prisma unique
│   ├── health.ts        contrôle de santé
│   └── navigation.ts    entrées de navigation
└── generated/prisma/    client Prisma généré (non versionné)
prisma/                  schéma, migrations versionnées, seed
netlify/functions/       tâches planifiées (santé quotidienne, passe horaire retards/priorités/relances)
scripts/                 invitations, sauvegarde/restauration, données de démonstration
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
pnpm invite vous@exemple.fr Prénom   # crée le premier compte (lien affiché dans le terminal)
pnpm dev                      # http://localhost:3000
```

En local, aucun e-mail ne part : ils sont enregistrés dans la table `email_outbox` et affichés dans le terminal.

## Comptes et connexion

- Pas d'inscription publique : un compte naît d'une **invitation** (Plus › Associés, ou `pnpm invite` pour le tout premier).
- Connexion par e-mail et mot de passe (pas de MFA en V1, voir [ADR-0008](docs/adr/0008-mfa-retiree-v1.md)).
- Détails de sécurité : [ADR-0010](docs/adr/0010-securite-connexion.md).

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
   - `BETTER_AUTH_SECRET` : valeur aléatoire (`openssl rand -base64 32`), différente par contexte.
   - `APP_URL` : URL publique du contexte (domaine final en production).
   - `RESEND_API_KEY` et `EMAIL_FROM` : envoi réel des invitations, réinitialisations et alertes.
   - `CRON_SECRET` : 32 caractères minimum, partagé avec la fonction planifiée `scheduled-scan`.
   - Cocher _Contains secret values_ pour les deux.
4. Pousser un commit dont le message contient `[deploy]`. Vérifier `https://<site>.netlify.app/api/health` → `{"status":"ok",...}`.
5. Créer le premier compte : `DATABASE_URL=<url production> APP_URL=<url> RESEND_API_KEY=<clé> pnpm invite <email> <prénom>`.
6. Pour les deploy previews : appliquer les migrations sur la branche `preview`
   (`DIRECT_DATABASE_URL=<url preview> pnpm db:deploy`).

Les migrations de production s'exécutent au build (`prisma migrate deploy`) : elles appliquent
uniquement les migrations versionnées et ne réinitialisent jamais la base.

## Exploitation

- Sauvegardes et restauration : [`docs/SAUVEGARDES.md`](docs/SAUVEGARDES.md)
- Tâches planifiées, alertes, incidents : [`docs/EXPLOITATION.md`](docs/EXPLOITATION.md)
- Pilote interne (checklist des trois associés) : [`docs/PILOTE.md`](docs/PILOTE.md)
- Décisions encore ouvertes (§24 du cahier des charges) : [`docs/POINTS_A_CONFIRMER.md`](docs/POINTS_A_CONFIRMER.md)

## Données de démonstration (local uniquement)

`pnpm demo:seed` crée une agence fictive (associés, clients, projets, opportunités, finances,
événements) sur une base **locale** : le script refuse toute autre base. Aucune donnée réelle.

## Règles de travail

Voir [`AGENTS.md`](AGENTS.md).
