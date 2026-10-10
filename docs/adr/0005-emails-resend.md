# ADR-0005 — E-mails transactionnels : Resend

- **Statut** : Acceptée — 10/10/2026 (implémentation au lot 1)

## Décision

**Resend** pour les e-mails transactionnels (invitations, réinitialisation, notifications importantes).

- Expéditeur sur un sous-domaine dédié, par ex. `notifications@every1ate.com`.
- SPF, DKIM et DMARC configurés sur le DNS du domaine.
- Clé API uniquement côté serveur (`RESEND_API_KEY`), jamais dans le navigateur ni les logs.
- Interface `lib/integrations/email` : le fournisseur reste remplaçable.

## Prérequis

Accès au DNS du domaine every1ate.com.

## Alternative

Brevo (fournisseur français), si l'hébergement des données en France devient une exigence.
