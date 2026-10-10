# ADR-0004 — Authentification : Better Auth + MFA TOTP

- **Statut** : Acceptée — 10/10/2026 (implémentation au lot 1)

## Contexte

Exigences §15.1 : connexion e-mail, réinitialisation, **MFA obligatoire** pour les associés,
invitations contrôlées, sessions révocables, limitation des tentatives, pas de système maison.

## Décision

**Better Auth** (1.7.x), bibliothèque open source, données stockées dans notre PostgreSQL via Prisma.

- E-mail + mot de passe (hachage géré par la librairie), réinitialisation par e-mail.
- Plugin `twoFactor` : TOTP (application d'authentification) + codes de secours ; MFA imposée côté serveur.
- Inscription publique **désactivée** : comptes créés par invitation uniquement.
- Sessions en base : liste et révocation possibles.
- Limitation de débit intégrée sur les routes d'authentification.

## Conséquences

- Coût nul, pas de dépendance à un fournisseur SaaS, migration facile (les données sont chez nous).
- Responsabilité : maintenir la librairie à jour (suivi des avis de sécurité).
- Contrainte : Prisma ≤ 7 (voir ADR-0002).

## Alternatives écartées

- Clerk : excellent mais hébergé hors UE, coûts croissants, dépendance forte.
- Supabase Auth : impose Supabase comme plateforme.
- Auth.js : MFA non native.
