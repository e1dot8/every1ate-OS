# ADR-0015 — PWA, sauvegardes et durcissement (lot 7)

## PWA et hors ligne

- Service worker servi par `app/sw.js/route.ts` (jamais mis en cache, exclu du proxy d'authentification).
- **Cache limité aux ressources statiques publiques** (JS/CSS/polices/icônes). Aucune page, aucune
  réponse d'API, aucune donnée privée ou financière n'est stockée sur l'appareil : c'est le choix
  le plus sûr pour la V1 (§16.2 « éviter le cache des pages sensibles »).
- Hors ligne : bandeau d'état, page `hors-ligne.html` pour les navigations, **blocage de tout
  envoi de formulaire** (aucun enregistrement silencieux), bandeau « connexion rétablie » + actualisation.
- Déconnexion : `Clear-Site-Data: "cache", "storage"` + purge côté client (caches, service worker,
  localStorage/sessionStorage). Vérifié par un test e2e (caches vides, retour arrière → connexion).
- La consultation hors ligne de données récentes est une évolution distincte, non incluse.

## Sauvegardes

Voir `docs/SAUVEGARDES.md` : PITR Neon + copie quotidienne chiffrée (GitHub Actions) avec test
de restauration automatique ; scripts `backup.sh`, `restore.sh` (refuse une base non vide, vérifie
l'empreinte), `restore-test.sh`.

## Durcissement

- CSP en production sans ressource externe (`object-src 'none'`, `frame-ancestors 'none'`,
  `form-action 'self'`). `'unsafe-inline'` reste requis par l'hydratation Next.js sans nonce.
- Server Actions : origine vérifiée par Next.js ; API d'authentification : `trustedOrigins`.
- Imports limités à 5 Mo (limite des Server Actions portée à 6 Mo), type vérifié par lecture réelle.
- Liens : `https` uniquement ; vérification serveur restreinte aux domaines Google (anti-SSRF).
- Page 404 en français ; en rendu partiel, un 404 « en flux » garde un statut HTTP 200 mais
  n'affiche aucune donnée (limite connue de Next.js, couverte par les tests de contenu).
