# ADR-0018 — La maison : bâtiment, avatars, appartement et vie de brigade (lot G6)

- **Statut** : Acceptée — 22/10/2026

## Contexte

Brief « Univers virtuel, bâtiment et mécaniques inspirées de Habbo » : donner l'impression d'habiter
un lieu (pièces, avatars, décoration, présence, collection) sans jamais ralentir le travail. Les
fonctions métier existantes (projets, CRM, temps, briefings, progression) ne sont pas reconstruites.

## Décisions

1. **Exception à l'ADR-0009 prolongée** : comme pour G1-G5, les écrans sont développés directement
   et validés sur captures du rendu réel (demande des associés du 22/10/2026).
2. **Le bâtiment** (`/maison`) : vue axonométrique éclatée originale (SVG, trait noir, aplats crème,
   jaune, rouge), six pièces sur deux étages. Survol (souris) = aperçu ; clic = entrée. Toucher :
   1er tap = aperçu, 2e tap ou « Ouvrir » = entrée. Clavier : focus = aperçu, Entrée = entrée.
   L'aperçu dit le nom, la fonction et « à l'intérieur » (données réelles). La liste des pièces sous
   la carte, le menu, la recherche et le bloc « Le bâtiment » du cockpit donnent le même accès.
   Aucune animation permanente ; seules des transitions d'opacité (coupées par reduced-motion).
3. **Pièces** : Appartement (`/appartement`), Bureau commun (`/bureau`), Carnet de recettes
   (`/recettes`, nouveau), La Cuisine (`/crm/cuisine`), L'atelier (`/atelier`, nouveau tableau de
   production qui renvoie aux pages existantes). L'espace client est affiché, étiqueté « lot à
   venir » et non ouvrable (AGENTS.md, règle 8).
4. **Avatar** (`user_avatar`) : buste original, cinq groupes d'options (teint, couvre-chef,
   tablier, accessoire, fond), défaut soigné. Cosmétique uniquement : aucune permission, aucune
   compétence. Une option verrouillée est refusée côté serveur.
5. **Objets** (`src/features/maison/cosmetics.ts`) : six emplacements prédéfinis (mur, étagère,
   bureau, sol, lumière, vitrine) ; un objet de départ par emplacement (vitrine vide). Les
   déblocages se _lisent_ dans la progression existante (niveau, rang, badges) : aucune monnaie,
   aucune boutique, aucun stock, aucun échange. Seuls les choix sont enregistrés
   (`apartment_item`) ; un choix devenu invalide retombe sur le défaut.
6. **Décor collectif** du bureau commun : débloqué par les paliers de la maison (projets livrés +
   objectifs atteints), distinct des niveaux personnels. Aucun classement.
7. **Carnet de recettes** : six catégories (les branches de compétences). Écrire une recette
   rapporte le bonus du barème (10 XP, idempotent par recette) et publie dans le fil. « Je l'ai
   réutilisée » prévient l'auteur ; la première réutilisation par un autre associé débloque
   automatiquement « Transmission du savoir ». Toute la brigade peut améliorer une recette
   (journalisé) ; seul l'auteur la range.
8. **Interactions sociales** : réactions rapides (4 emojis fixes, une par personne et par emoji),
   félicitations avec un mot, demandes d'aide reliées à une tâche ou à une compétence (« Je m'en
   occupe », « Réglé »), disponibilité du jour facultative (Disponible, Concentré, Absent),
   effacée chaque soir, jamais historisée. Rien n'exige d'aller dans une pièce : le courrier est
   accessible partout et ouvre l'objet concerné.

## Exclu du MVP

Monde 3D, déplacement d'avatar, chat spatial, messagerie privée, économie, boutique, échanges,
mini-jeux, quêtes (lot ultérieur), portail client (lot dédié, avec maquette Figma).
