# Travailler à plusieurs sur Every1.ate OS

Ce guide est pour l'associé qui rejoint le code : installer l'app sur son ordinateur, ajouter une
fonctionnalité de son côté, puis la proposer à l'autre sans rien casser.

**Analogie : Google Docs en mode suggestion.**

| Google Docs               | Ici (GitHub)                           |
| ------------------------- | -------------------------------------- |
| Le document partagé       | Le dépôt `every1ate-os`                |
| Votre copie de travail    | Une **branche** (`charles/export-pdf`) |
| Une suggestion à accepter | Une **pull request**                   |
| Accepter la suggestion    | **Fusionner** (merge)                  |
| Le document publié        | La branche `main` + Netlify            |

Chacun écrit dans sa copie ; rien n'arrive dans la version commune sans que l'autre ait relu.

---

## 1. Ce qu'il faut (une seule fois)

1. Un compte GitHub, invité sur le dépôt avec le rôle **Write** (pas Admin) :
   GitHub → dépôt → _Settings_ → _Collaborators_ → _Add people_.
2. Sur l'ordinateur : [Node 22](https://nodejs.org), pnpm 10 (`corepack enable`), Git, et
   PostgreSQL 16 (le plus simple : [Docker Desktop](https://www.docker.com/products/docker-desktop/)).
3. Facultatif mais conseillé : [Claude Code](https://claude.ai/code). Le dépôt contient `CLAUDE.md`
   et `AGENTS.md` : Claude y lit les règles du projet et les applique.

## 2. Installer l'app en local (≈ 10 minutes)

```bash
git clone https://github.com/e1dot8/every1ate-OS.git every1ate-os
cd every1ate-os
pnpm install

# Base de données locale (Docker)
docker run --name e1-pg -e POSTGRES_USER=e1 -e POSTGRES_PASSWORD=e1 \
  -e POSTGRES_DB=every1ate_os -p 5432:5432 -d postgres:16

cp .env.example .env
```

Dans `.env`, remplacer :

```bash
DATABASE_URL="postgresql://e1:e1@localhost:5432/every1ate_os"
DIRECT_DATABASE_URL="postgresql://e1:e1@localhost:5432/every1ate_os"
BETTER_AUTH_SECRET="<résultat de : openssl rand -base64 32>"
```

Puis :

```bash
pnpm db:deploy      # crée les tables (migrations versionnées)
pnpm demo:seed      # agence FICTIVE : 3 associés, clients, projets, finances
pnpm dev            # http://localhost:3000
```

Connexion : `johan@demo.every1ate.test` (ou `charles@`, `pierre@`), mot de passe affiché à la fin de
`pnpm demo:seed`. Aucun e-mail ne part en local, aucune donnée réelle n'est utilisée.

## 3. La règle d'or des branches

```
main ──────────────●──────────────●──────────►  (production, Netlify)
                   ▲              ▲
v1-2 ──●──●──●─────┘              │            (version en cours de validation)
            \                     │
charles/export-pdf ──●──●──► pull request ──►  relue par l'autre associé
```

1. **Partir de la branche de version la plus récente** (aujourd'hui `v1-2`, qui contient aussi la V1.1), jamais de `main`
   directement, et ne jamais écrire sur `main`.
2. **Une branche par fonctionnalité**, nommée `prenom/sujet-court` :
   ```bash
   git switch v1-2 && git pull
   git switch -c charles/export-pdf
   ```
3. **Petits commits clairs**, en français : « Export PDF du devis : bouton et gabarit ».
4. **Pousser et ouvrir une pull request** vers la branche de départ :
   ```bash
   git push -u origin charles/export-pdf
   ```
   puis _Compare & pull request_ sur GitHub. La CI vérifie automatiquement (lint, types, tests,
   build). L'autre associé relit, commente, puis fusionne.
5. **Mise en production** : uniquement d'un commun accord, par un commit contenant `[deploy]` sur
   `main` (chaque mise en production coûte 15 crédits Netlify sur 300 par mois).

Avant de commencer une journée : `git pull` sur sa branche de départ, puis
`git merge v1-2` dans sa branche de fonctionnalité pour rester à jour.

## 4. Ajouter une fonctionnalité : le chemin type

| Étape                   | Où                                                                      | Règle                                                                        |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Écran                | `src/app/(app)/<route>/page.tsx`                                        | Lecture des données dans un composant sous `<Suspense>`                      |
| 2. Règles métier pures  | `src/features/<zone>/rules.ts`                                          | Sans base de données, avec un test dans `tests/unit/`                        |
| 3. Lecture / écriture   | `src/features/<zone>/service.ts`                                        | Renvoie un `ServiceResult`, journal d'audit si sensible                      |
| 4. Action du formulaire | `src/app/(app)/<route>/actions.ts`                                      | `requireUser()` + validation Zod côté serveur                                |
| 5. Nouvelle donnée      | `prisma/schema.prisma` puis `pnpm exec prisma migrate dev --name <nom>` | Migration additive uniquement (jamais de suppression de colonne sans accord) |
| 6. Tests                | `tests/unit/`, `tests/e2e/`                                             | Données fictives, mobile + ordinateur                                        |

Les règles complètes sont dans [`AGENTS.md`](AGENTS.md) ; les décisions passées dans
[`docs/adr/`](docs/adr/README.md).

**Avant d'ouvrir la pull request :**

- [ ] `pnpm verify` passe (lint, types, tests, build, contrôle des secrets) ;
- [ ] `pnpm test:e2e` passe si un écran a changé ;
- [ ] l'écran a été regardé sur téléphone (390 px) et sur ordinateur ;
- [ ] aucune donnée réelle, aucun secret, aucun fichier `.env` dans le commit ;
- [ ] une fonctionnalité pas finie est affichée « Bientôt disponible », jamais simulée.

## 5. Avec Claude Code

Ouvrir le dossier dans Claude Code, puis demander par exemple :

> « Lis CONTRIBUER.md et AGENTS.md. Je veux ajouter l'export PDF d'un devis. Montre-moi d'abord
> l'écran (mobile et ordinateur) et les fichiers que tu vas toucher, puis attends mon accord. »

Claude travaille alors sur votre branche et suit les mêmes règles que celles utilisées jusqu'ici.

## 6. Où en est le projet

L'état complet (versions, ce qui reste à faire, réglages à configurer avant la mise en ligne) est
dans [`docs/PASSATION.md`](docs/PASSATION.md). À lire en premier.

## 7. Ce qui ne se partage jamais

- Le fichier `.env` et toute clé (Neon, Netlify, Resend, CallMeBot, VAPID).
- Les accès à la base de production : en local, on travaille toujours sur la base Docker et les
  données de démonstration.
- De vraies données clients dans les tests, captures ou démonstrations.
