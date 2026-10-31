# ADR-0019 — Direction éditoriale, trois niveaux de navigation et noms des espaces (lot G7)

- **Statut** : Acceptée — 28/10/2026

## Contexte

Retour des associés sur G6 (maquette « Bienvenue à la maison » + notes de direction) : simplifier la
hiérarchie visuelle, ne plus montrer le bâtiment en permanence, rester fidèle à l'identité
éditoriale Every1.ate et rendre la gamification discrète mais profonde. Principe retenu :
80 % fonctionnel, 20 % univers ; l'univers passe aussi par les mots, les transitions et les
récompenses.

## Décisions

1. **Exception à l'ADR-0009 prolongée** : écrans codés directement, validés sur captures du rendu.
2. **Jetons** : fond blanc cassé (`--background: #f6f5f1`), rayon de base 0,5 rem, cartes à contour
   fin sans ombre (`rounded-lg`, plus de `rounded-2xl`). Jaune réservé aux actions prioritaires
   (variante de bouton `highlight`, une par écran), aux sélections et aux réussites ; rouge
   ponctuel (annotations, alertes). Les règles sont montrées sur `/design`.
3. **Trois niveaux de navigation** :
   - Niveau 1 — **Cockpit** (`/`), écran par défaut, sans illustration ;
   - Niveau 2 — **La maison** (`/maison`), le bâtiment comme carte des espaces ;
   - Niveau 3 — les **outils** (tâches, projets, CRM, temps, finance…), indépendants du dessin.
     Le rail desktop est groupé « Mon travail / La maison / Outils » et se termine par un mini-profil
     (rang, niveau, XP) menant à l'appartement. La barre mobile garde cinq entrées.
4. **Le bâtiment** est redessiné en axonométrie monochrome au trait net, marqueurs numérotés jaunes
   et étiquettes flottantes. Seule la pièce visée se colore (jaune) et révèle son aperçu
   (données réelles). Mêmes règles d'interaction qu'en G6 (survol/clic, 1er tap/2e tap, clavier).
   La colonne de droite reprend la maquette : « La brigade aujourd'hui », « Objectifs de la
   semaine », « Dernières activités ».
5. **Noms des espaces** et routes :
   - La Cuisine = production (`/atelier` → `/cuisine`) ;
   - La Salle de restaurant = CRM (`/crm/cuisine` → `/crm/salle`) ;
   - Le service de la semaine = briefing hebdomadaire (`/menu-semaine` → `/service`) ;
   - « Nouvelle recette » (carnet), « Service terminé » (projet livré).
     Les anciennes URL redirigent (`next.config.ts`, redirections temporaires) pour ne casser aucun
     favori ni lien de notification existant.
6. **Gamification discrète** :
   - tâche terminée : coche, XP sur la ligne et notification brève « Tâche terminée. +N XP »
     (`role="status"`, disparaît seule) ; plus de panneau de progression permanent au cockpit ;
   - badge obtenu : bandeau de célébration au cockpit avec **« Partager au bureau commun »** ou
     « Garder pour moi ». Un badge automatique n'est plus publié d'office : le partage est un choix.
     Un badge remis par un pair reste annoncé (c'est un geste social). Le partage est aussi
     possible depuis la collection ;
   - le profil (appartement / progression) garde l'arbre, les rangs et la collection.
7. **Sécurité** : Next.js passe de 16.4.0 à 16.4.3 (correctifs critiques GHSA-2464-fhr4-w9xw et
   GHSA-673q-mjm6-r5xr). Montée de patch, sans changement d'API.

## Conséquences

- Les tests e2e suivent les nouveaux noms et routes ; un test vérifie la redirection `/atelier`.
- Aucun changement de schéma : le partage d'un badge réutilise le fil de brigade (dédoublonné).
- Les pages d'outils n'embarquent plus d'illustration : le bâtiment ne vit que sur `/maison`.
