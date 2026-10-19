/** Textes d'aide des comptes rendus (syntaxe des actions, sans IA). */

export const SYNTAX_HINT =
  "Une action par ligne, commençant par « [ ] », « TODO », « À faire : », « Action : » ou « → ». " +
  "« @Prénom » désigne le responsable ; « demain », « vendredi », « 15/11 » ou « 3 novembre » fixent l'échéance.";

/** Exemple affiché quand il n'y a encore rien (liste vide, aucune action détectée). */
export const SYNTAX_EXAMPLE = [
  "Point d'avancement avec le client",
  "Le client valide la direction artistique.",
  "[ ] Envoyer le devis V2 @Charles vendredi",
  "TODO : relancer le photographe @Pierre demain",
  "→ Préparer le moodboard le 15/11",
].join("\n");
