# ADR-0010 — Détails de sécurité de la connexion (lot 1)

- **Statut** : Acceptée — 10/10/2026
- **Complète** : ADR-0004 (Better Auth) et ADR-0008 (pas de MFA en V1)

| Sujet                         | Choix                                                                                                                                                                                                                     | Où                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Création de compte            | Invitation uniquement (lien de 72 h, jeton stocké en SHA-256, usage unique et atomique). Inscription publique désactivée.                                                                                                 | `src/lib/auth/invitations.ts`               |
| Premier compte                | `pnpm invite <email> <prénom>` en ligne de commande                                                                                                                                                                       | `scripts/invite.ts`                         |
| Mot de passe                  | 12 à 128 caractères, refus des mots de passe présents dans Have I Been Pwned (k-anonymat, échec ouvert si le service est indisponible). Empreinte scrypt.                                                                 | `src/lib/auth/password-policy.ts`           |
| Tentatives                    | 5 échecs en 15 min suspendent le compte 15 min (compté depuis le journal d'audit, par empreinte d'e-mail). Limitation par IP en plus sur les appels HTTP directs.                                                         | `src/lib/auth/login-throttle.ts`, `auth.ts` |
| Messages                      | Neutres : n'indiquent jamais si une adresse existe (connexion, mot de passe oublié).                                                                                                                                      | `src/app/(auth)/actions.ts`                 |
| Session                       | 7 jours prolongés à l'usage ; liste des appareils ; déconnexion à distance par identifiant (le jeton n'est jamais envoyé au navigateur).                                                                                  | `src/app/(app)/plus/securite`               |
| Changement / réinitialisation | Déconnecte les autres appareils. Lien de réinitialisation : 1 h, usage unique.                                                                                                                                            | `auth.ts`                                   |
| Contrôle d'accès              | `proxy.ts` (redirection rapide sans cookie) + `requireUser()` dans chaque page et chaque Server Action (vérification réelle).                                                                                             | `src/lib/auth/session.ts`                   |
| Redirections                  | `next` limité aux chemins internes (pas de redirection ouverte).                                                                                                                                                          | `safeNextPath`                              |
| Audit                         | Connexions (réussies, refusées, bloquées), déconnexions, mots de passe, sessions, invitations. Table en ajout seul : triggers PostgreSQL contre UPDATE, DELETE et TRUNCATE. Aucun mot de passe, jeton ni e-mail en clair. | `src/lib/audit/audit.ts`                    |
| E-mails                       | Resend en production ; table `email_outbox` en développement et en test (rien ne part).                                                                                                                                   | `src/lib/email/`                            |

## Limites connues

- Le blocage par compte peut être déclenché volontairement par un tiers qui connaît l'adresse (blocage de 15 min). Accepté pour 3 utilisateurs.
- La liste des appareils n'affiche pas de ville (aucune géolocalisation d'IP en V1).
