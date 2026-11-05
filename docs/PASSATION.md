# Passation du développement — état au 5 novembre 2026

Document de reprise pour l'associé qui prend le relais sur le code d'Every1.ate OS.
À lire avec [`CONTRIBUER.md`](../CONTRIBUER.md) (installer, branches, règles) et
[`AGENTS.md`](../AGENTS.md) (règles non négociables).

## 1. En une phrase

L'application tourne en local avec des données de démonstration ; les **V1.2 et V1.3 sont terminées
et testées sur la branche `v1-3`**, en attente de la validation écran par écran par les associés.
**Rien des V1.1, V1.2 ni V1.3 n'est en production.**

## 2. Les versions et les branches

| Branche | Contenu                                                                                                                                                | État                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `main`  | V1 (lots 0 à 7) + début de V1.1                                                                                                                        | Base de la production Netlify (déploiement seulement sur commit `[deploy]`) |
| `v1-1`  | V1.1 : pilotage gratuit sans IA (brief du jour, comptes rendus → tâches, recherche, export comptable, trésorerie 13 semaines, objectifs, rentabilité…) | Terminée, en attente de validation                                          |
| `v1-2`  | V1.1 **+** V1.2 (ci-dessous)                                                                                                                           | Terminée, en attente de validation                                          |
| `v1-3`  | V1.1 + V1.2 **+** V1.3 : une discussion par tâche, livrable et projet ; point du matin (8 h, jours ouvrés)                                             | Terminée, en attente de validation — **branche de départ**                  |

**Sécurité, à faire avant toute mise en ligne :** Next.js est passé de 16.4.0 à **16.4.5** sur
`v1-2` (deux failles critiques d'exécution de code à distance, GHSA-2464-fhr4-w9xw et
GHSA-673q-mjm6-r5xr, plus un déni de service des Server Actions). `main` et `v1-1` sont encore en
16.4.0 : si une version est en ligne, la redéployer depuis `v1-3` (ou porter la mise à jour).

## 3. Ce que contient la V1.2

| Module                     | Où dans le code                                              | En bref                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accueil « QG »             | `src/app/(app)/page.tsx`, `src/features/qg/`                 | Brief, mon bureau (3 places), mes livrables, passations, l'équipe aujourd'hui, à prendre, quêtes d'équipe                                                                                                               |
| Livrables                  | `src/features/deliverables/`, `src/app/(app)/livrables/`     | Préparation → Création → Production → Montage → Livraison → Livré ; checklist par format ; passage d'étape automatique ; vues Tableau / Table / Calendrier ; onglet dans chaque projet                                  |
| Alertes                    | `src/features/notifications/`, `src/app/(app)/plus/alertes/` | Push (Web Push, VAPID) et WhatsApp (CallMeBot, gratuit, usage personnel) ; préférences par événement ; rien en focus sauf urgence                                                                                       |
| Discussions                | `src/features/discussions/`, `src/app/(app)/discussions/`    | Salons (général, clients, un par projet, privés), messages directs, fils, réactions, mentions, épinglés, plus tard, rappels, messages programmés, commandes `/tache` `/relance` `/focus` `/standup` `/rappel` `/huddle` |
| Limite d'en-cours          | `src/features/projects/{rules,service}.ts`                   | 3 tâches en cours/bloquées par associé (réglable 1–10) ; dépassement avec motif visible de tous                                                                                                                         |
| Passations                 | `src/features/qg/handoffs.ts`                                | Donner ou reprendre une tâche / un client ; l'objet ne change de main qu'à l'acceptation                                                                                                                                |
| Stand-up, ménage, présence | `src/app/(app)/qg/`, `src/features/presence/`                | Stand-up pré-rempli ; tâches qui « prennent la poussière » (10 jours) ; statut choisi, sans historique                                                                                                                  |
| Événements                 | `src/features/events/`                                       | Point d'entrée unique : notification dans l'app → push/WhatsApp → message du QG dans le salon                                                                                                                           |
| Interface « façon Notion » | `src/components/notion/blocks.tsx`                           | Page avec icône, propriétés, onglets de vue, sections, blocs repliables, encadrés                                                                                                                                       |

Migrations V1.2 (additives) : `prisma/migrations/20261104090000_*`, `20261104090100_*`, `20261104150000_*`.

### V1.3

| Module                 | Où dans le code                                           | En bref                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discussion par élément | `src/features/discussions/subjects.ts`, `subject-*.ts(x)` | Section « Discussion » sur chaque tâche et livrable, onglet « Discussion » du projet ; chaque discussion est un fil du salon du projet (ligne « Tâche · Titre » / « Livrable · Titre ») ; responsable, contributeurs et participants prévenus (événement `commentaire`) ; anciens commentaires de tâche repris automatiquement |
| Point du matin         | `src/features/qg/morning/`, `src/app/(app)/qg/point/`     | Lundi–vendredi à 8 h (Paris) : publié une fois par jour (date unique) par la passe planifiée ou à la première ouverture du QG ; Salle commune + notification (`point.matin`) ; page complète avec les 10 derniers points ; aucun total par personne                                                                            |

Migration V1.3 (additive) : `prisma/migrations/20261105080000_*`.

## 4. Vérifications au moment de la passation

| Contrôle                                           | Résultat                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | OK                                                                                            |
| `pnpm test` (unitaires)                            | 534 tests OK                                                                                  |
| `pnpm build` + `pnpm check:bundle`                 | OK, aucun secret dans le code envoyé au navigateur                                            |
| `pnpm test:e2e` (mobile + ordinateur, base neuve)  | 291 réussis, 3 ignorés (déjà ignorés en V1.1), 0 échec                                        |
| Revue de code (sécurité + logique métier)          | 17 points trouvés, aucun critique ; 16 corrigés, 1 laissé en l'état (point 1 de la section 6) |

## 5. Avant la mise en ligne de la V1.2 (checklist)

1. **Validation** écran par écran par les trois associés (mobile + ordinateur).
2. **Variables Netlify** (Site configuration → Environment variables), par contexte :
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret) : `npx web-push generate-vapid-keys`, une paire par environnement ;
   - `VAPID_SUBJECT` : `mailto:` de l'agence (facultatif) ;
   - `SECRETS_KEY` (secret, recommandé) : `openssl rand -base64 32` — chiffre les clés WhatsApp en base ;
   - inchangées : `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.
3. **Fusion** de `v1-3` dans `main` par pull request, CI au vert.
4. **Mise en production** : commit contenant `[deploy]` (15 crédits Netlify sur 300/mois). Les
   migrations s'appliquent au build.
5. **Chaque associé**, une fois en ligne :
   - iPhone : installer l'app sur l'écran d'accueil (Partager → Sur l'écran d'accueil), puis
     Plus › Alertes › « Activer sur cet appareil » (push iOS uniquement dans l'app installée) ;
   - WhatsApp : activer CallMeBot avec son propre numéro (étapes dans Plus › Alertes), coller la clé.
6. Détails d'exploitation : [`docs/EXPLOITATION.md`](EXPLOITATION.md).

## 6. Ce qui reste ouvert (non bloquant)

1. **Envois externes dans la requête** : `emitEvent` attend push/WhatsApp ; un CallMeBot lent peut
   ralentir une action jusqu'à 8 s. Piste : `after()` de `next/server`, à valider sur Netlify.
2. « Mes appareils » (Plus › Alertes) liste aussi les appareils dont la session a expiré (ils ne
   reçoivent plus rien ; affichage seulement).
3. Ouvrir les discussions d'un projet archivé crée son salon s'il n'existait pas.
4. Étiquette des notifications push : basée sur le type et le lien ; une clé par événement serait
   plus précise (`renotify` évite déjà la perte silencieuse).
5. « Bientôt disponible » assumé : envoi direct de fichiers dans les discussions (les liens https
   marchent), « Découper » une tâche au grand ménage.
6. Dépendances signalées par `pnpm audit` restantes : uniquement dans l'outillage du CLI Prisma
   (`mysql2`, `deepmerge-ts`, `fast-uri`…), non utilisé par l'application en production.
7. WhatsApp officiel (API Meta) : payant par message ; CallMeBot reste la solution gratuite, sans
   garantie de service.
8. Points métier encore ouverts côté agence : [`docs/POINTS_A_CONFIRMER.md`](POINTS_A_CONFIRMER.md).

## 7. Comment on a travaillé (à garder)

- **Un lot à la fois**, maquette écran par écran (mobile + ordinateur) **validée avant de coder** et
  **avant toute mise en ligne**.
- **Gratuit d'abord**, rien qui dépende d'une IA.
- Interface en français, mobile d'abord (360–430 px sans défilement horizontal), « façon Notion ».
- Garde-fous produit : pas de surveillance (statut choisi, jamais de « vu à »), pas de classement
  entre associés (récompenses collectives), un signal négatif porte sur un objet, jamais sur une
  personne, et propose une sortie en un clic.
- Toute mutation : `requireUser()` + Zod côté serveur + journal d'audit si sensible ; migrations
  additives uniquement ; aucune donnée réelle dans les tests ou la démo.

## 8. Ressources

- Données de démonstration : `pnpm demo:seed` sur une base locale vide ; comptes
  `johan@` / `charles@` / `pierre@demo.every1ate.test`, mot de passe affiché à la fin.
- Maquette d'origine du QG (pixel art, discussions) : dépôt `e1dot8/Every1ate-world` (public).
- Décisions techniques : [`docs/adr/`](adr/README.md) ; cahier des charges :
  [`docs/CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md).
