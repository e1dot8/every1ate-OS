# EVERY1.ATE OS

## Cahier des charges fonctionnel et technique

**Version :** 1.0 --- document de référence pour Claude Code\
**Date :** 10 octobre 2026\
**Statut :** spécification de départ à valider techniquement avant mise
en production

------------------------------------------------------------------------

## 1. Objet du document

Construire une application web privée de pilotage de l'agence
EVERY1.ATE, accessible à distance, installable sur iPhone comme une
Progressive Web App (PWA), puis extensible aux collaborateurs, clients
et prestataires.

L'application doit réunir dans une source de vérité cohérente : - le
pilotage des projets, lots, tâches, dépendances et échéances ; - le
développement commercial et le CRM ; - les budgets, coûts, échéanciers,
encaissements et marges ; - le suivi du temps ; - les calendriers et les
disponibilités ; - les documents courants et les références vers les
médias créatifs ; - la gouvernance, les validations, la traçabilité et
les sauvegardes.

Le développement se fait par étapes testables. La priorité est un socle
interne utilisable par les trois associés avant toute ouverture externe.

### 1.1 Principes non négociables

1.  Une seule source de vérité métier : les différentes vues affichent
    les mêmes projets, lots et tâches.
2.  La responsabilité est claire, sans hiérarchie artificielle entre
    associés.
3.  Les permissions sont vérifiées côté serveur pour chaque ressource et
    chaque action.
4.  Les données financières distinguent chiffre d'affaires, coûts
    refacturés, coûts engagés, coûts payés, encaissements et marge.
5.  Les changements sensibles sont traçables avec auteur, date et
    valeurs avant/après.
6.  Les suppressions sont réversibles par défaut.
7.  Le design est mobile-first, avec une PWA utilisable comme un dock de
    travail.
8.  La V1 est limitée à l'usage interne des trois associés ; le portail
    client/prestataire arrive en V2.
9.  Les fonctionnalités annoncées comme futures ne doivent pas être
    simulées par une interface sans comportement réel.
10. Toute fonctionnalité doit être livrée avec tests et critères
    d'acceptation.

------------------------------------------------------------------------

## 2. Contexte métier et utilisateurs

### 2.1 Les trois associés

-   **Johan** --- stratégie créative, production, coordination et
    développement commercial.
-   **Charles** --- direction, réalisation, image, audiovisuel et
    développement commercial.
-   **Pierre** --- direction artistique, design, narration et creative
    technology.

Les trois associés disposent de droits équivalents sur l'agence et ses
données. Les spécialités servent à décrire les compétences, pas à
imposer une chaîne hiérarchique.

Chaque projet a exactement un responsable global à un instant donné,
choisi explicitement à la création parmi les associés. Ce responsable
peut être remplacé avec journalisation. Un associé peut être responsable
global même si le projet ne relève pas principalement de sa spécialité.

### 2.2 Responsabilités projet

-   Le **responsable global** coordonne le projet, arbitre dans les
    limites convenues, suit le budget et le planning, traite les
    blocages et veille à la clôture.
-   Le **responsable de lot** est autonome sur son périmètre : tâches,
    dates, livrables et coordination des personnes affectées au lot.
-   Un lot peut être confié à un associé, un collaborateur ou, en V2, un
    prestataire.
-   Les tâches et livrables peuvent être attribués à une personne
    différente du responsable du lot.
-   L'application ne doit pas imposer que toute action passe par Johan.

### 2.3 Utilisateurs et rôles

**V1** - Associé : accès complet à l'ensemble des données de l'agence. -
Les trois associés sont les seuls utilisateurs actifs au lancement.

**V2** - Collaborateur : accès aux projets affectés, selon les
autorisations accordées par les associés. - Prestataire : accès strict
aux lots, tâches, fichiers et informations nécessaires à sa mission. -
Client : accès uniquement aux projets et contenus explicitement partagés
; peut commenter, transmettre des documents et approuver/rejeter des
livrables selon les permissions. - Une organisation cliente ne peut
jamais accéder aux données d'une autre organisation. - Les données
internes (marges, notes internes, commentaires internes, coûts et
décisions confidentielles) restent invisibles aux utilisateurs externes
par défaut.

------------------------------------------------------------------------

## 3. Périmètre et versions

### 3.1 V1 --- socle interne

Inclus : 1. Authentification et gestion des comptes des trois associés.
2. Tableau de bord personnel et cockpit agence. 3. Clients, contacts,
opportunités et pipeline CRM. 4. Projets, phases, lots, tâches,
dépendances et roadmap/Gantt. 5. Modèles de projet et création depuis un
modèle ou un assistant guidé. 6. Suivi du temps par chronomètre et
saisie manuelle. 7. Budgets, coûts, échéanciers de facturation,
encaissements, marges et imports financiers CSV/Excel. 8. Calendrier et
échéances ; intégrations de calendrier selon faisabilité technique
validée. 9. Références et accès contrôlés aux documents Google Drive.
10. Audit des actions sensibles et modifications métier importantes. 11.
Suppression réversible, archivage et restauration autorisée. 12. PWA
mobile-first, cache hors ligne limité et synchronisation contrôlée. 13.
Sauvegardes et procédure de restauration. 14. Notifications dans
l'application et e-mails pour les événements importants.

### 3.2 V2 --- collaboration externe

-   Portail client et prestataire.
-   Gestion complète des versions de livrables.
-   Commentaires internes et externes distincts.
-   Workflow de soumission, revue, approbation ou rejet, configurable
    par projet ou type de livrable.
-   Validation interne obligatoire lorsque le workflow du projet
    l'exige, avant soumission au client.
-   Partage de fichiers par connexion et liens temporaires pour certains
    fichiers.
-   Gestion des accès par organisation et projet.
-   Intégration approfondie du stockage objet pour les médias lourds.

### 3.3 Évolutions ultérieures

-   Mind map créative pour explorer idées, références, concepts et
    pistes.
-   Synchronisations automatiques plus poussées avec outils externes.
-   Automatisations et rapports additionnels.
-   Application native iOS/Android uniquement si le besoin le justifie ;
    la PWA est la cible initiale.

### 3.4 Modèles de projets au lancement

-   Production audiovisuelle.
-   Campagne créative.
-   Conseil / stratégie.
-   Projet vierge.

Les modèles doivent rester modifiables et personnalisables après
création. Les modèles événement/activation, photo/éditorial et
accompagnement récurrent ne sont pas prioritaires au lancement, mais le
modèle de données ne doit pas les empêcher.

------------------------------------------------------------------------

## 4. Parcours et navigation

### 4.1 Navigation mobile

Barre fixe en bas : 1. Accueil 2. Tâches 3. Projets 4. CRM 5. Plus

Le menu « Plus » donne accès à Finance, Calendrier, Temps, Clients,
Documents, Paramètres et Archives selon les droits.

### 4.2 Accueil personnel

L'accueil par défaut après connexion est **Mon espace**. Il affiche : -
tâches prioritaires ; - échéances à venir et en retard ; - tâches
bloquées ou en attente ; - prochains rendez-vous ; - temps suivi
aujourd'hui/semaine ; - livrables ou décisions qui nécessitent une
action ; - raccourci de création rapide.

Les données affichées sont personnalisées à l'utilisateur connecté.

### 4.3 Cockpit agence

Accessible depuis Mon espace, il affiche : - projets actifs, en retard
et bloqués ; - pipeline commercial, propositions et montant pondéré ; -
échéances et prochaines actions ; - facturation attendue, encaissements,
coûts engagés et marges ; - livrables en attente de validation ; -
charge de travail, avec vue personnelle par défaut et vue d'équipe
accessible aux associés.

Filtres temporels : semaine, mois, trimestre. Les indicateurs financiers
doivent distinguer les montants prévisionnels des montants réalisés.

### 4.4 Principes UX

-   Interface responsive complète, conçue d'abord pour le téléphone.
-   Cibles tactiles suffisamment grandes, actions courantes accessibles
    au pouce.
-   Navigation simple, chargement progressif, états vides explicites.
-   Chaque vue doit fournir filtres, recherche et tri utiles sans
    surcharger l'écran.
-   Les opérations destructives ou financières importantes demandent
    confirmation.
-   Les formulaires doivent conserver les saisies en cas d'erreur de
    validation.
-   États de chargement, d'erreur, de synchronisation et hors ligne
    visibles.
-   Éviter les tableaux larges sur mobile ; utiliser des cartes ou vues
    compactes.

------------------------------------------------------------------------

## 5. Identité visuelle

### 5.1 Direction artistique

Univers EVERY1.ATE : cuisine créative, esthétique éditoriale,
annotations, surlignages et personnalité.

-   Base : blanc, noir et gris neutres.
-   Rouge : annotations, alertes et accents, sans l'utiliser comme
    unique signal d'état.
-   Surlignages : utilisés pour attirer l'attention sur une échéance ou
    une information éditoriale.
-   Pictogrammes expressifs, micro-interactions discrètes, cartes
    arrondies.
-   Les couleurs d'état doivent rester lisibles et accessibles.

### 5.2 Typographie

-   **Arimo** : titres, libellés structurants et interface.
-   **Courier Prime** : annotations et éléments éditoriaux uniquement si
    les tests de lisibilité le confirment.
-   Corps de texte : choisir la police offrant le meilleur confort sur
    mobile ; ne pas imposer Courier Prime aux longs paragraphes ou
    tableaux sans validation.
-   Prévoir une hiérarchie typographique cohérente, tailles accessibles
    et contrastes suffisants.

### 5.3 Accessibilité

-   Contraste conforme aux bonnes pratiques WCAG.
-   Navigation clavier sur ordinateur.
-   Libellés accessibles pour les contrôles et icônes.
-   Les statuts ne doivent jamais être distingués uniquement par la
    couleur.
-   Respect de la préférence de réduction des animations.

------------------------------------------------------------------------

## 6. Phases projet et statuts

### 6.1 Phases métier

Les phases sont fixées dans cet ordre : 1. **La recette** --- brief,
diagnostic, stratégie et cadrage. 2. **La préparation** --- concept,
direction artistique, planning, budget et organisation. 3. **La
cuisson** --- exécution et production. 4. **Le dressage** --- finitions,
contrôle qualité et validations. 5. **Le service** --- livraison,
activation, bilan et enseignements.

La phase du projet ne remplace pas le statut opérationnel. Un projet en
« La cuisson » peut être bloqué ou en attente.

### 6.2 Statuts de projet

Au minimum : - À préparer - Actif - En attente - Bloqué - Terminé -
Archivé

La signification et les transitions doivent être documentées. Un projet
terminé ne devient archivé qu'après la procédure d'archivage prévue.

### 6.3 Statuts de tâche

Flux principal : - À faire - En cours - En revue - Terminé

États complémentaires : - En attente - Bloqué - Annulé (si nécessaire,
avec justification)

Un blocage doit avoir une raison et, si possible, une prochaine action
ou date de réexamen. La phase projet et le statut de tâche sont
indépendants.

------------------------------------------------------------------------

## 7. Projets, lots et tâches

### 7.1 Modèle d'un projet

Chaque projet contient : - nom, description et client ; - opportunité
CRM source, si applicable ; - responsable global ; - phase et statut ; -
dates de début et de fin prévues/réelles ; - budget initial, budget
courant et seuils de gouvernance ; - lots, tâches, jalons, dépendances
et livrables ; - calendrier, fichiers liés, commentaires internes et
journal d'activité ; - checklist de clôture ; - modèle de départ
utilisé.

### 7.2 Lots

Un lot représente un périmètre de travail cohérent et autonome. Champs
: - nom, description, responsable, personnes affectées ; - dates prévues
et réelles ; - budget prévisionnel, coûts engagés et coûts réels ; -
tâches, livrables et dépendances ; - statut et notes ; - visibilité et
autorisations.

Un lot peut être géré indépendamment, sans perdre le rattachement au
projet.

### 7.3 Tâches

Champs minimum : - titre et description ; - projet et lot ; -
responsable et contributeurs ; - statut ; - priorité calculée et
priorité manuelle éventuelle ; - date de début, échéance, durée estimée
; - temps réellement suivi ; - dépendances ; - commentaires et pièces
jointes/références ; - récurrence éventuelle ; - date de création,
auteur, date de modification.

### 7.4 Priorisation

La priorité suggérée prend en compte : - urgence ; - impact ; -
proximité de l'échéance ; - retard ; - dépendances bloquantes.

Le système suggère une priorité ; l'utilisateur peut la modifier et
verrouiller sa valeur. La logique doit être transparente et expliquée
dans l'interface. Aucun calcul ne doit silencieusement remplacer une
priorité verrouillée.

### 7.5 Dépendances

-   Une tâche peut dépendre de zéro ou plusieurs tâches.
-   Une dépendance bloque uniquement les tâches concernées, pas tout le
    projet par défaut.
-   Détecter et empêcher les cycles de dépendances.
-   Afficher la raison pour laquelle une tâche est bloquée.
-   La suppression ou modification d'une tâche dépendante doit être
    traitée avec prudence et confirmation.

### 7.6 Roadmap/Gantt

-   Vue timeline/Gantt des lots, tâches et jalons.
-   Déplacement de dates par glisser-déposer.
-   Ajustement de durée et modification des dépendances.
-   Affichage du chemin de dépendances et des retards.
-   Le déplacement d'une tâche dépendante ne doit pas déplacer
    arbitrairement toutes les tâches ; appliquer une règle explicite,
    avec prévisualisation si une cascade est proposée.
-   Chaque modification est persistée côté serveur et journalisée.
-   Prévoir une alternative accessible aux interactions de
    glisser-déposer (édition par formulaire).
-   Afficher la phase projet, sans la confondre avec les statuts.

### 7.7 Modèles de projet

Un modèle contient une structure de lots, tâches types, durées
suggérées, dépendances, jalons, phases et checklist de clôture. À la
création, les dates sont recalculées à partir de la date de début
choisie. L'utilisateur peut retirer, ajouter ou modifier les éléments
avant confirmation.

------------------------------------------------------------------------

## 8. Suivi du temps

-   Chronomètre démarrer/arrêter rattaché à une tâche.
-   Saisie manuelle des durées.
-   Correction manuelle autorisée, avec historique des modifications.
-   Empêcher par défaut plusieurs chronomètres actifs simultanément pour
    un même utilisateur.
-   Demander confirmation si l'utilisateur démarre un nouveau
    chronomètre alors qu'un autre tourne.
-   Un enregistrement de temps contient utilisateur, tâche, date,
    début/fin ou durée, origine (timer ou saisie manuelle), commentaire
    facultatif.
-   Les heures réelles alimentent les analyses de charge et de marge,
    sans être confondues avec les montants facturables.
-   Les fuseaux horaires et changements d'heure doivent être traités
    correctement.

------------------------------------------------------------------------

## 9. CRM et développement commercial

### 9.1 Pipeline

Étapes exactes : 1. À contacter 2. Premier échange 3. Qualification 4.
Proposition envoyée 5. Négociation 6. Gagné 7. Perdu

Les opportunités gagnées/perdues doivent conserver l'historique de leur
progression. Une perte peut inclure un motif.

### 9.2 Données CRM

-   Entreprise, contacts, coordonnées professionnelles.
-   Source : outbound, inbound, recommandation, réseau, partenaire.
-   Responsable commercial.
-   Étape, montant estimé HT, probabilité, date de clôture estimée.
-   Prochaine action et date de relance.
-   Historique chronologique : échanges, réunions, propositions,
    changements de statut et notes.
-   Fichiers/références vers les propositions envoyées.
-   Motif de perte si applicable.

### 9.3 Prévisions

Afficher séparément : - montant brut du pipeline ; - montant pondéré par
probabilité ; - montants par étape ; - propositions envoyées ; -
opportunités en retard de suivi.

Les probabilités par défaut doivent être configurables. Le montant
pondéré est un indicateur commercial, pas du chiffre d'affaires reconnu
ni de la trésorerie.

### 9.4 Conversion en projet

Lorsqu'une opportunité passe à « Gagné » : 1. proposer de créer un
projet ; 2. demander confirmation ; 3. faire choisir un modèle ; 4.
préremplir les informations CRM disponibles ; 5. demander le responsable
global et les dates initiales ; 6. créer le projet et conserver le lien
avec l'opportunité.

La conversion ne doit pas créer de doublon si l'utilisateur réessaie
l'opération.

------------------------------------------------------------------------

## 10. Finance et rentabilité

### 10.1 Principes comptables de gestion

L'application est un outil de pilotage et ne remplace pas le logiciel
comptable ou le conseil de l'expert-comptable.

Afficher les montants HT par défaut et la TVA séparément lorsqu'elle est
connue. Ne pas assimiler automatiquement : - montant de proposition à
chiffre d'affaires facturé ; - montant facturé à montant encaissé ; -
coût prévu à coût engagé ; - coût engagé à coût payé ; - budget à
trésorerie ; - coût refacturable à marge.

### 10.2 Budgets

Au niveau projet et lot : - budget initial ; - budget courant approuvé
; - revenus prévus ; - coûts prévus ; - coûts engagés ; - coûts réels
; - coûts payés ; - reste à payer ; - facturation attendue ; -
facturation réalisée ; - encaissements ; - marge prévisionnelle et marge
réelle.

Toute modification significative du budget est historisée et soumise aux
règles de gouvernance.

### 10.3 Tarification mixte

Prendre en charge : - forfait fixe ; - temps/TJM ; - frais et coûts de
production ; - combinaisons de ces méthodes.

Les postes doivent pouvoir préciser quantité, unité, taux, montant,
catégorie, lot, caractère refacturable et état (prévu, engagé, réalisé,
payé).

### 10.4 Coûts

Chaque coût peut comporter : - fournisseur ; - projet et lot ; -
description et catégorie ; - montant HT, TVA et TTC si disponibles ; -
statut : prévu, engagé, reçu/facturé, payé, annulé ; - date
d'engagement, date de facture, échéance et date de paiement ; -
justificatif ou référence de document ; - indication de refacturation au
client ; - provenance (saisie manuelle ou import).

Les coûts engagés et approuvés affectent la marge prévisionnelle sans
attendre leur paiement. Les imports ne doivent pas écraser les données
internes sans rapprochement explicite.

### 10.5 Échéancier de facturation

Chaque projet peut avoir un échéancier libre : - acompte ; - facturation
intermédiaire par étape ; - solde ; - dates prévues ; - montant HT et
TVA si connus ; - statut attendu, facturé, partiellement encaissé,
encaissé, en retard ou annulé ; - références et PDF de factures générées
dans l'outil externe.

La V1 ne génère pas de devis ou factures officiels. Elle suit les
échéances et conserve les références/fichiers correspondants.

### 10.6 Contrats récurrents

Prévoir les champs nécessaires aux revenus récurrents : - montant
mensuel ; - dates de début et fin ; - durée ; - statut ; - date de
renouvellement ; - préavis ; - montant récurrent actif.

Le MRR désigne les revenus mensuels récurrents contractés, pas le
chiffre d'affaires ponctuel divisé par douze. Afficher séparément le MRR
contracté, les échéances et les encaissements.

### 10.7 Imports CSV/Excel

Parcours obligatoire : 1. choisir le fichier ; 2. sélectionner ou
détecter le type d'import ; 3. prévisualiser les colonnes et lignes ; 4.
associer les colonnes aux champs ; 5. valider formats, montants, dates
et identifiants ; 6. détecter doublons et lignes potentiellement déjà
importées ; 7. afficher erreurs et avertissements ; 8. confirmer
l'import ; 9. afficher le rapport final ; 10. conserver un identifiant
d'import et les erreurs.

L'import ne doit pas modifier de données existantes sans action
explicite. Prévoir un mécanisme d'annulation logique ou de correction
documentée quand cela est sûr.

### 10.8 Pennylane et Qonto

Répartition cible : - Pennylane : référence comptable, sous réserve des
fonctions disponibles et de la configuration du compte. - Qonto :
référence bancaire pour les mouvements effectivement enregistrés. -
Every1.ate OS : budgets prévisionnels, coûts engagés, rentabilité par
projet/lot et échéanciers opérationnels.

En V1, import manuel CSV/Excel et rapprochement contrôlé. Aucune API
automatique n'est présumée disponible. Toute intégration future devra
vérifier l'accès, les autorisations, les limites API et les coûts.

------------------------------------------------------------------------

## 11. Calendriers et disponibilités

### 11.1 Besoin fonctionnel

-   Vue des événements, réunions, échéances et tâches planifiées.
-   Les réunions doivent pouvoir être reliées à un projet, un client ou
    une opportunité.
-   Les disponibilités partagées avec l'équipe sont limitées à
    occupé/libre par défaut ; les détails ne sont visibles que si
    explicitement partagés.
-   Les conflits doivent être signalés. En cas de versions concurrentes,
    l'utilisateur choisit la version à conserver.

### 11.2 Intégrations à valider

Google Calendar et Apple Calendar sont souhaités. Ne pas promettre une
synchronisation bidirectionnelle complète avant validation technique.

Avant développement : - déterminer le modèle d'intégration Apple (par
exemple, abonnements/calendriers externes ou solution nécessitant des
autorisations supplémentaires) ; - définir la source de vérité des
événements ; - définir les règles de détection des doublons et conflits
; - vérifier les API et contraintes des fournisseurs ; - prévoir une
file de synchronisation, les erreurs, les tentatives et un journal de
synchronisation.

### 11.3 V1 acceptable

Si une synchronisation bidirectionnelle robuste avec les deux
fournisseurs n'est pas réalisable dans le budget initial : - livrer
d'abord un calendrier interne fiable ; - intégrer le fournisseur le plus
simple et le plus utile en premier ; - documenter les limites ; - ne pas
simuler une synchronisation qui n'existe pas.

------------------------------------------------------------------------

## 12. Google Drive et stockage des médias

### 12.1 Documents courants

Google Drive est le stockage principal prévu pour les documents
courants. L'application stocke les métadonnées, le rattachement aux
projets/lots/tâches et les références Drive, sans nécessairement
dupliquer le fichier.

Prévoir : - association à un projet, lot, tâche ou client ; - titre,
type, propriétaire, date, référence externe ; - permissions vérifiées
avant ouverture ; - traitement des liens supprimés ou expirés ; -
gestion des autorisations OAuth avec scopes minimaux.

### 12.2 Médias volumineux

Prévoir un stockage objet privé dédié pour les gros fichiers photo,
vidéo, audio, PSD, AI, INDD et archives. Fournisseur à sélectionner
selon coût, transferts multipart/resumable, versionnement, accès signé
et sauvegarde.

-   Aucun média privé ne doit être public par défaut.
-   Les liens temporaires expirent et ne remplacent pas le contrôle
    d'accès.
-   Les clés d'accès ne sont jamais exposées au navigateur.
-   Limites de taille configurables.
-   Uploads volumineux reprenables.
-   Vérification du type et de la taille, sans se fier uniquement au nom
    de fichier.
-   Métadonnées et empreintes permettant la détection de doublons.
-   Rétention configurable par type de document/contrat, avec archivage
    et suppression autorisée.

### 12.3 Versions et validations V2

Chaque version conservera auteur, date, commentaires et décision. Le
workflow est configurable par projet/type de livrable. La validation
interne peut être obligatoire avant la transmission au client. Les
versions précédentes restent consultables selon les droits.

------------------------------------------------------------------------

## 13. Notifications et automatisations

### 13.1 Canaux V1

-   Centre de notifications in-app.
-   E-mail pour les événements importants.
-   Pas de push iPhone ni de rappel quotidien automatique au lancement.

### 13.2 Événements notifiables

-   tâche assignée ou réassignée ;
-   échéance approchante ;
-   tâche en retard ;
-   tâche bloquée ;
-   changement important de planning/budget ;
-   import financier terminé ou rejeté ;
-   conflit de synchronisation calendrier ;
-   action ou validation requise ;
-   sauvegarde échouée, accessible aux administrateurs techniques.

### 13.3 Escalade

Pour une tâche en retard : 1. notifier le responsable ; 2. après 48
heures de retard, notifier le responsable global du projet ; 3. éviter
les notifications répétitives inutiles ; 4. conserver l'historique des
alertes émises.

Les dates et heures sont stockées de manière cohérente et affichées
selon le fuseau horaire de l'utilisateur.

------------------------------------------------------------------------

## 14. Gouvernance et seuils

### 14.1 Seuils configurables

Les associés doivent pouvoir configurer les règles qui déclenchent une
validation collective, notamment : - dépassement de budget exprimé en
pourcentage du budget de référence ; - retard majeur exprimé en
pourcentage du planning initial et/ou selon une durée minimale ; -
changement de périmètre nécessitant une décision.

Les valeurs initiales ne sont pas encore définies. Elles doivent être
configurables et historisées.

### 14.2 Workflow de validation collective

Lorsqu'un seuil est dépassé : - créer une demande de décision ; -
expliquer le changement, les valeurs avant/après et les conséquences ; -
notifier les personnes requises ; - enregistrer les avis, décisions,
date et auteurs ; - empêcher l'application du changement si la règle
l'exige et que la validation n'est pas obtenue.

La règle exacte de majorité/quorum est à formaliser avant
implémentation. Ne pas déduire automatiquement les règles légales des
statuts de l'agence à partir de cette spécification.

### 14.3 Clôture projet

Checklist requise : - livrables livrés et référencés ; - coûts et
dépenses rapprochés ; - facturation et encaissements vérifiés ; - bilan
projet renseigné ; - fichiers et données archivés ; - tâches restantes
traitées ou explicitement transférées.

Un projet ne peut être marqué terminé que lorsque la checklist est
complétée. Le responsable global confirme la clôture.

------------------------------------------------------------------------

## 15. Authentification, droits et audit

### 15.1 Authentification

-   Connexion sécurisée par e-mail.
-   Réinitialisation de mot de passe.
-   MFA obligatoire pour les associés.
-   Invitations contrôlées pour les nouveaux comptes.
-   Gestion des sessions et révocation.
-   Limitation des tentatives et protection contre les abus.
-   Ne pas stocker les mots de passe en clair.
-   Préférer un fournisseur d'authentification éprouvé plutôt qu'un
    système maison.

Le fournisseur doit être choisi après vérification des coûts, de la MFA,
des sessions, des environnements Netlify et de la facilité de migration.

### 15.2 Contrôles d'accès

Toute action serveur doit vérifier : - identité ; - rôle ; -
appartenance au périmètre ; - permission sur la ressource ; - état de la
ressource et autorisation d'effectuer la transition.

Masquer un bouton dans l'interface ne constitue pas une protection. Les
accès directs aux routes et identifiants de ressources doivent être
testés.

### 15.3 Journal d'audit

Journaliser les actions sensibles et les modifications métier
importantes : - changements de rôle ou de permission ; - suppressions,
restaurations et archivages ; - modifications de budget, coûts,
échéanciers et encaissements ; - changement de responsable ; -
modifications de dates ou de périmètre ; - décisions de validation ; -
imports financiers et rapprochements.

Champs minimum : - acteur ; - date/heure ; - type d'action ; - type et
identifiant de la ressource ; - valeurs avant/après pertinentes ; -
motif facultatif ou requis selon action ; - origine de l'action lorsque
disponible.

Ne pas enregistrer de mots de passe, jetons, secrets ou données
sensibles inutiles dans les logs. Le journal ne doit pas être modifiable
par les utilisateurs ordinaires.

------------------------------------------------------------------------

## 16. PWA et fonctionnement hors ligne

### 16.1 Installation iOS

-   Manifest PWA, icônes, nom et couleurs de thème.
-   HTTPS obligatoire en production.
-   Instructions d'installation sur l'écran d'accueil.
-   Navigation mobile fixe en bas.
-   Comportement correct en mode standalone.

### 16.2 Hors ligne V1

-   Mettre en cache uniquement les données récentes nécessaires et
    autorisées.
-   Signaler clairement que les données sont potentiellement obsolètes.
-   Éviter le cache des pages sensibles ou financières si le risque
    n'est pas maîtrisé.
-   Aucun changement hors ligne n'est enregistré silencieusement dans la
    V1.
-   La synchronisation au retour du réseau doit afficher son état et
    gérer les erreurs.
-   Ne pas exposer les données d'un compte après déconnexion ou
    changement d'utilisateur sur le même appareil.

La modification hors ligne avec résolution de conflits est une évolution
distincte et ne doit pas être incluse implicitement.

------------------------------------------------------------------------

## 17. Sauvegardes et reprise

Politique cible : - sauvegarde automatique quotidienne de la base ; -
option de restauration à un point antérieur si le fournisseur la propose
; - sauvegarde indépendante des fichiers critiques ; - versionnement
Drive/stockage objet selon capacités ; - chiffrement et accès restreints
; - alerte sur échec ; - tests de restauration documentés et réguliers
; - objectifs de perte maximale de données et de temps de reprise à
définir.

Le code est versionné dans GitHub. Les secrets ne sont jamais commités.
Les sauvegardes de la base et des fichiers doivent être cohérentes ou
accompagnées d'une procédure expliquant les écarts possibles.

------------------------------------------------------------------------

## 18. Architecture technique proposée

### 18.1 Stack cible

-   Next.js avec TypeScript.
-   Tailwind CSS et shadcn/ui.
-   Prisma ORM.
-   PostgreSQL en production.
-   Netlify pour le déploiement web et les fonctions serveur
    compatibles.
-   GitHub pour le versionnement et la revue du code.
-   Google Drive API pour les documents courants, après validation
    OAuth.
-   Fournisseur d'authentification externe à choisir.
-   Stockage objet privé à choisir pour les médias lourds.
-   Service e-mail transactionnel à choisir pour les notifications.

### 18.2 Contraintes de déploiement

Ne pas supposer que SQLite est adapté à une application serverless
multi-utilisateur en production. PostgreSQL doit être hébergé séparément
ou via une solution compatible. Vérifier les limites Netlify, la durée
des fonctions, les tâches planifiées, les uploads et les connexions à la
base.

Les tâches récurrentes (escalade après 48 h, alertes, maintenance)
nécessitent une exécution planifiée fiable ; ne pas dépendre uniquement
d'une requête utilisateur pour déclencher un traitement.

### 18.3 Organisation du code suggérée

-   `app/` : routes et pages Next.js.
-   `components/` : composants UI génériques.
-   `features/` : modules métier (projects, tasks, crm, finance,
    calendar, files).
-   `lib/auth/` : authentification et permissions.
-   `lib/db/` : Prisma et accès aux données.
-   `lib/audit/` : journal d'audit.
-   `lib/integrations/` : Drive, calendriers, imports et e-mails.
-   `lib/validation/` : schémas de validation.
-   `prisma/` : schéma, migrations et seeds.
-   `tests/` : tests unitaires, intégration et parcours critiques.

L'organisation peut être ajustée si Claude Code propose une structure
plus adaptée, mais les frontières entre domaines métier doivent rester
explicites.

------------------------------------------------------------------------

## 19. Modèle de données conceptuel

Entités principales à détailler dans Prisma : - `User`, `Session` ou
équivalent fournisseur d'authentification ; - `ClientOrganization`,
`ClientContact` ; - `Opportunity`, `OpportunityActivity`, `FollowUp` ; -
`Project`, `ProjectTemplate`, `ProjectPhaseHistory` ; - `ProjectMember`,
`WorkPackage` (lot), `Task`, `TaskDependency`, `TaskTimeEntry`,
`Milestone` ; - `Deliverable`, `FileReference`, `FileVersion`,
`Approval` (préparer pour V2) ; - `ProjectBudget`, `BudgetRevision`,
`CostItem`, `BillingMilestone`, `InvoiceReference`, `PaymentRecord`,
`RecurringContract` ; - `CalendarEvent`, `CalendarConnection`,
`SyncJob`, `SyncConflict` ; - `ImportBatch`, `ImportRow`,
`ReconciliationMatch` ; - `Notification`, `AuditEvent`, `ArchiveRecord`,
`GovernanceRule`, `DecisionRequest`, `DecisionVote` ; -
`ProjectClosureChecklist`, `ProjectClosureItem`.

Principes : - identifiants stables ; - dates stockées en UTC et
affichées selon le fuseau ; - montants stockés en unités monétaires
décimales adaptées, jamais en nombres flottants binaires ; - clés
étrangères et contraintes d'intégrité ; - suppression logique pour les
objets métier ; - index sur les champs de recherche, statut, échéance et
relations ; - migrations versionnées ; - règles de validation côté
serveur.

Le schéma exact devra être produit et testé avant les écrans avancés.
Les données financières importées doivent conserver leur provenance et
leur identifiant externe si disponible.

------------------------------------------------------------------------

## 20. Contrats fonctionnels et critères d'acceptation

### 20.1 Authentification

-   Un associé autorisé peut se connecter et réinitialiser son mot de
    passe.
-   La MFA est requise pour chaque associé.
-   Une requête non autorisée vers une ressource protégée est rejetée
    côté serveur.
-   Les secrets ne sont jamais exposés dans le client ou les logs.

### 20.2 Projet

-   Un associé crée un projet à partir d'un modèle ou d'un projet
    vierge.
-   Le responsable global est obligatoire.
-   La phase est initialisée et modifiable selon les règles.
-   Les modifications de budget et de planning sont historisées.
-   Les projets, lots et tâches restent cohérents dans toutes les vues.

### 20.3 Tâches et roadmap

-   Une tâche peut être assignée, datée et reliée à un lot.
-   Une dépendance ne bloque que les tâches concernées.
-   Un cycle de dépendances est rejeté.
-   Le déplacement sur la roadmap persiste réellement la nouvelle date.
-   La priorité verrouillée ne change pas automatiquement.
-   Un retard déclenche les notifications attendues.

### 20.4 CRM

-   Une opportunité peut progresser dans le pipeline exact.
-   Le montant pondéré est calculé à partir de la probabilité
    configurée.
-   La prochaine action et sa date sont visibles.
-   La conversion « Gagné » demande confirmation et choix du modèle.
-   Une tentative répétée ne crée pas de projet en double.

### 20.5 Finance

-   Un import est prévisualisé et validé avant intégration.
-   Les erreurs de format sont signalées avant import.
-   Les doublons potentiels sont détectés.
-   Les coûts engagés affectent la marge prévisionnelle avant paiement.
-   Les montants attendus, facturés et encaissés restent distincts.
-   La marge est consultable au niveau projet et lot.

### 20.6 Calendrier

-   Les événements internes sont visibles dans le fuseau correct.
-   Les conflits détectés sont présentés à l'utilisateur.
-   Une erreur de synchronisation est visible et réessayable.
-   Les détails d'événements privés ne sont pas partagés par défaut.

### 20.7 Clôture

-   La clôture est refusée si une entrée obligatoire de la checklist
    manque.
-   La clôture réussie conserve la date, l'auteur et les éléments de
    bilan.
-   L'archivage ne détruit pas les données nécessaires à l'audit.

### 20.8 PWA

-   L'application est installable sur iOS.
-   Les principales vues s'adaptent au téléphone.
-   L'état hors ligne est clairement indiqué.
-   La déconnexion empêche l'accès ultérieur aux données privées en
    cache.

------------------------------------------------------------------------

## 21. Stratégie de tests

### Tests unitaires

-   Calcul de priorité.
-   Montant pondéré du pipeline.
-   Calculs de marges.
-   Seuils de gouvernance.
-   Transitions de statut.
-   Validation des échéanciers.
-   Détection des dépendances cycliques.

### Tests d'intégration

-   Permissions par rôle et par projet.
-   Création et conversion CRM → projet.
-   Import financier, détection de doublons et rapprochement.
-   Journalisation avant/après.
-   Clôture de projet.
-   Gestion des erreurs d'intégration.

### Tests end-to-end

-   Connexion MFA d'un associé.
-   Création d'un projet à partir d'un modèle.
-   Création d'un lot et d'une tâche.
-   Déplacement d'une tâche dans la roadmap.
-   Saisie d'un temps.
-   Import CSV et validation.
-   Création d'un échéancier.
-   Consultation du cockpit mobile.
-   Déconnexion et vérification du cache.

### Tests sécurité

-   Accès direct à une ressource interdite.
-   Escalade de privilèges.
-   CSRF/XSS selon les mécanismes utilisés.
-   Validation de fichiers importés.
-   Fuite de secrets.
-   Expiration de session.
-   Contrôle des URL de fichiers et liens temporaires.

------------------------------------------------------------------------

## 22. Découpage de réalisation dans Claude Code

Ne pas demander à Claude Code de générer toute l'application en une
seule opération.

### Lot 0 --- cadrage technique

-   Vérifier versions et compatibilité
    Next.js/Netlify/Prisma/PostgreSQL.
-   Choisir authentification, base hébergée, e-mail et stockage.
-   Créer les décisions d'architecture (ADR).
-   Créer le dépôt et les environnements.

**Livrable :** application minimale déployée, connexion à la base, CI de
base et tests.

### Lot 1 --- design system et authentification

-   Tokens visuels, typographies, composants.
-   Layout desktop/mobile et barre inférieure.
-   Connexion, MFA et gestion de session.
-   Permissions serveur et audit de base.

**Critère de sortie :** les trois associés peuvent se connecter de façon
sécurisée.

### Lot 2 --- projets, lots, tâches

-   Schéma et CRUD.
-   Phases, statuts, responsables, modèles.
-   Dépendances et règles de transition.
-   Liste et détails de projet.

**Critère de sortie :** un projet réel peut être suivi sans tableur
parallèle pour les tâches de base.

### Lot 3 --- roadmap et suivi du temps

-   Gantt interactif, jalons et déplacements de dates.
-   Chronomètre et saisie manuelle.
-   Priorités et notifications de retard.

**Critère de sortie :** toutes les interactions critiques persistent et
sont testées.

### Lot 4 --- CRM

-   Contacts, entreprises, opportunités, pipeline, relances.
-   Historique chronologique.
-   Conversion confirmée vers un projet.

### Lot 5 --- finance

-   Budgets, lots, coûts, échéanciers, encaissements.
-   Marges prévisionnelles/réelles.
-   Imports CSV/Excel et rapprochement.
-   Cockpit financier.

### Lot 6 --- calendrier et intégrations

-   Calendrier interne.
-   Étude et implémentation progressive des connecteurs.
-   Conflits et erreurs de synchronisation.
-   E-mails transactionnels.

### Lot 7 --- fiabilité et pilote

-   PWA, cache limité, sauvegardes, restauration.
-   Tests de sécurité et de permissions.
-   Test d'un projet réel avec les trois associés.
-   Corrections et documentation.

### Lot 8 --- V2 externe

-   Organisations clientes, collaborateurs et prestataires.
-   Portail externe, fichiers, versions, commentaires et validations.
-   Tests d'isolation et d'accès externes.

À la fin de chaque lot : lancer lint, vérification TypeScript, tests
unitaires, tests d'intégration pertinents et build. Ne pas poursuivre si
le lot ne passe pas les contrôles.

------------------------------------------------------------------------

## 23. Règles de travail à donner à Claude Code

1.  Lire ce document avant toute modification.
2.  Commencer par inspecter le dépôt et résumer son état ; ne pas
    écraser du code existant sans inspection.
3.  Ne réaliser qu'un lot à la fois.
4.  Avant chaque lot, présenter les fichiers et migrations prévus.
5.  Ne jamais inventer une intégration fonctionnelle : si un fournisseur
    ou un accès manque, créer une interface d'intégration explicite et
    documenter ce qui reste à faire.
6.  Ne pas mettre de données réelles sensibles dans les seeds ou tests.
7.  Toute nouvelle règle métier doit avoir un test.
8.  Toutes les mutations passent par validation serveur et contrôle
    d'accès.
9.  Toute opération financière importante et toute modification sensible
    doivent être auditées.
10. Utiliser des migrations Prisma versionnées ; ne pas réinitialiser la
    base de production.
11. Fournir un fichier `.env.example` sans secrets et documenter chaque
    variable.
12. Prévoir les états loading, empty, error, offline et unauthorized.
13. Ne pas considérer une maquette statique comme une fonctionnalité
    livrée.
14. Après chaque lot, fournir un résumé des changements, commandes
    exécutées, tests passés/échoués et points bloquants.
15. Mettre à jour ce cahier des charges et les décisions d'architecture
    si une décision évolue.

------------------------------------------------------------------------

## 24. Points à confirmer avant production

Ces points ne doivent pas être inventés par le code : 1. Seuils initiaux
de gouvernance : pourcentage de budget, tolérance de planning et
définition d'un changement de périmètre. 2. Règle de décision collective
: unanimité, majorité ou autre quorum selon les statuts/pacte
applicables. 3. Fournisseur PostgreSQL et politique de restauration. 4.
Fournisseur d'authentification et configuration MFA. 5. Stockage objet,
limites de taille, coût, versionnement et rétention. 6. Méthode
d'intégration Google Drive et gestion OAuth. 7. Faisabilité et limites
de la synchronisation Apple Calendar/Google Calendar. 8. Format des
exports Pennylane et Qonto à importer, colonnes et règles de
rapprochement. 9. Durée de conservation des archives, logs et
sauvegardes. 10. Objectifs de reprise après incident (RPO/RTO). 11.
Répartition exacte des accès collaborateurs en V2. 12. Seuils de marge
et règles de calcul validés par l'agence/comptable.

------------------------------------------------------------------------

## 25. Définition de « prêt à utiliser »

La V1 est considérée comme prête pour le pilote interne lorsque : - les
trois associés peuvent se connecter avec MFA ; - les projets, lots,
tâches, dépendances et roadmap fonctionnent de bout en bout ; - le CRM
permet de gérer une opportunité jusqu'à sa conversion en projet ; -
budgets, coûts, échéanciers, imports et marges sont cohérents et testés
; - les actions sensibles sont auditées ; - la PWA fonctionne sur iPhone
et ordinateur ; - le calendrier et les intégrations annoncées sont
réellement opérationnels ou leurs limites sont explicitement documentées
; - les sauvegardes sont exécutées et une restauration a été testée ; -
aucune vulnérabilité critique connue ne subsiste ; - les trois associés
ont validé un projet pilote réel.

**Fin du cahier des charges --- version 1.0.**
