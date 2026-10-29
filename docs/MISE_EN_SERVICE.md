# Mise en service — de zéro à « on travaille dedans »

Analogie : on ouvre le restaurant. **Neon** est la chambre froide (les données), **Netlify** la
salle où l'on reçoit (le site), **Resend** le facteur (les e-mails). Il faut les trois avant
d'accueillir la brigade.

Durée : environ 1 h, en une fois. Aucune étape ne demande d'écrire du code.

## Qui fait quoi

| Étape                                                    | Qui                                        | Durée                |
| -------------------------------------------------------- | ------------------------------------------ | -------------------- |
| 1. Créer la base Neon                                    | Associé (compte Neon)                      | 10 min               |
| 2. Créer le site Netlify relié au dépôt GitHub           | Associé (compte Netlify)                   | 10 min               |
| 3. Créer le compte Resend et vérifier le domaine         | Associé (accès DNS du domaine)             | 15 min + attente DNS |
| 4. Saisir les variables dans Netlify                     | Associé                                    | 10 min               |
| 5. Publier (commit `[deploy]`) et vérifier `/api/health` | Claude ou associé                          | 5 min                |
| 6. Inviter Johan, Charles et Pierre                      | Claude ou associé (commande `pnpm invite`) | 5 min                |
| 7. Pilote sur un vrai projet (`docs/PILOTE.md`)          | Les trois associés                         | 2–3 semaines         |

Les clés secrètes ne transitent jamais par une conversation ni par le dépôt : elles se collent
directement dans Netlify.

## 1. Neon (la base)

1. Créer un compte sur neon.tech, puis **New project** ; région **AWS Europe Central (Frankfurt)**.
2. Dans **Connection details**, copier deux adresses de la branche `main` :
   - l'adresse **pooled** (contient `-pooler`) → servira de `DATABASE_URL` ;
   - l'adresse **direct** (sans `-pooler`) → servira de `DIRECT_DATABASE_URL`.
3. Créer une branche `preview` (pour les essais) et noter aussi ses deux adresses.

## 2. Netlify (le site)

1. Sur netlify.com : **Add new site → Import an existing project → GitHub → `every1ate-os`**,
   branche `main`.
2. Ne rien changer aux réglages de build : ils sont lus dans `netlify.toml`.
3. Le premier build sera **ignoré volontairement** (garde-fou des crédits, ADR-0007) : c'est normal.

## 3. Resend (les e-mails)

1. Créer un compte sur resend.com, puis **Domains → Add domain** avec le domaine de l'agence.
2. Ajouter chez l'hébergeur du domaine les enregistrements DNS affichés (SPF, DKIM).
3. Attendre l'état **Verified**, puis **API Keys → Create** (droit « Sending access »).

## 4. Variables (Netlify → Site configuration → Environment variables)

| Variable              | Valeur                                            | Contexte                        |
| --------------------- | ------------------------------------------------- | ------------------------------- |
| `DATABASE_URL`        | adresse pooled Neon `main`                        | Production                      |
| `DATABASE_URL`        | adresse pooled Neon `preview`                     | Deploy previews, branch deploys |
| `DIRECT_DATABASE_URL` | adresse directe Neon `main`                       | Production                      |
| `BETTER_AUTH_SECRET`  | 32 caractères aléatoires, différents par contexte | Tous                            |
| `APP_URL`             | l'adresse du site (ex. `https://os.every1ate.fr`) | Production                      |
| `RESEND_API_KEY`      | la clé Resend                                     | Production                      |
| `EMAIL_FROM`          | ex. `Every1.ate OS <os@every1ate.fr>`             | Production                      |
| `CRON_SECRET`         | 32 caractères aléatoires                          | Production                      |

Pour générer une valeur aléatoire : bouton **Generate** de Netlify si proposé, ou sur un Mac
`openssl rand -base64 32` dans le Terminal. Cocher **Contains secret values** pour les secrets.

## 5. Publier

Un commit dont le message contient `[deploy]` sur `main` lance la mise en production :
migrations appliquées (jamais de remise à zéro), puis build. Vérifier ensuite
`https://<site>/api/health` → `{"status":"ok", …}`.

## 6. Ouvrir les comptes

Pour chaque associé, depuis un poste qui a le dépôt :

```
DATABASE_URL=<adresse production> APP_URL=<adresse du site> RESEND_API_KEY=<clé> \
  pnpm invite <e-mail> <prénom>
```

Chacun reçoit un e-mail d'invitation, choisit son mot de passe, puis installe l'app sur
son téléphone (Plus › Installer).

## 7. Premiers pas dans l'outil (le premier jour)

1. **Réglages** (Plus › Réglages) : coût horaire et capacité de chacun, seuils de gouvernance.
2. **Clients** : saisir les clients actifs et les opportunités en cours.
3. **Projets** : créer les projets en cours (depuis un modèle), avec lots, tâches et responsables.
4. **Point hebdo** du lundi : ouvrir le premier, fixer trois objectifs.
5. Chacun : **briefing du jour** le matin, chronomètre sur ses tâches, et ses **quêtes** de la semaine.

Les décisions encore ouvertes avant la production sont listées dans
[`POINTS_A_CONFIRMER.md`](POINTS_A_CONFIRMER.md).
