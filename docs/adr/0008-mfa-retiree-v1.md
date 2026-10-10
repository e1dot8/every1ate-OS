# ADR-0008 — Pas de MFA en V1

- **Statut** : Acceptée — 10/10/2026
- **Décideurs** : associés EVERY1.ATE
- **Remplace** : la partie MFA d'ADR-0004 et les exigences MFA du cahier des charges (§15.1, §20.1, §21, §22, §25)

## Contexte

La MFA (code à 6 chiffres via une appli) a été jugée trop contraignante pour l'usage quotidien des trois associés.

## Décision

Connexion par **e-mail + mot de passe**, sans second facteur. Mesures conservées :

- mot de passe de 12 caractères minimum, refusé s'il figure dans une fuite publique connue (vérification anonyme) ;
- 5 essais, puis connexion suspendue 15 minutes ; message d'erreur neutre (n'indique pas si l'e-mail existe) ;
- session de 7 jours prolongée à l'usage, liste des appareils connectés et déconnexion à distance ;
- comptes uniquement sur invitation (lien de 72 h) ; réinitialisation par lien de 1 h, à usage unique ;
- journal d'audit des connexions, échecs, invitations et révocations.

## Conséquences

- Un mot de passe volé suffit pour accéder aux données jusqu'à sa révocation : la déconnexion à distance et la réinitialisation doivent rester simples.
- Better Auth garde le plugin `twoFactor` disponible : la MFA peut être réactivée plus tard sans migration de données lourde.
- À réexaminer avant l'ouverture aux clients et prestataires (V2).
