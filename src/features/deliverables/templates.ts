/**
 * Checklists types d'une agence de contenu, par format et par étape.
 * Copiées dans le livrable à sa création, puis librement modifiables (ajout, renommage,
 * suppression, ordre). « Livré » n'a pas de checklist : c'est l'état final.
 */
import type { DeliverableFormat } from "@/generated/prisma/enums";
import { WORK_STAGES, type WorkStage } from "@/features/deliverables/rules";

export type ChecklistTemplate = Record<WorkStage, string[]>;

const VIDEO: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Références et moodboard",
    "Planning de production calé",
    "Lieux, talents et matériel réservés",
  ],
  CREATION: [
    "Concept et note d'intention",
    "Script rédigé",
    "Storyboard ou découpage technique",
    "Concept validé par le client",
  ],
  PRODUCTION: [
    "Feuille de service envoyée",
    "Tournage réalisé",
    "Rushes sauvegardés (double copie)",
    "Autorisations de droit à l'image signées",
  ],
  MONTAGE: [
    "Dérushage",
    "Montage V1",
    "Retours client sur la V1",
    "Étalonnage et mixage son",
    "Sous-titres",
    "Version finale validée en interne",
  ],
  LIVRAISON: ["Exports aux bons formats", "Envoi au client", "Validation client", "Publication programmée"],
};

const REEL: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Références et tendances repérées",
    "Planning de tournage calé",
  ],
  CREATION: ["Accroche et script", "Concept validé par le client"],
  PRODUCTION: ["Tournage vertical (9:16)", "Rushes sauvegardés (double copie)"],
  MONTAGE: [
    "Dérushage",
    "Montage V1",
    "Musique et sound design (droits vérifiés)",
    "Sous-titres incrustés",
    "Retours client intégrés",
    "Version finale",
  ],
  LIVRAISON: [
    "Export 9:16 et couverture",
    "Légende et hashtags",
    "Envoi au client",
    "Validation client",
    "Publication programmée",
  ],
};

const STORY: ChecklistTemplate = {
  PREPARATION: ["Brief validé avec le client", "Références"],
  CREATION: ["Séquence des stories écrite", "Concept validé par le client"],
  PRODUCTION: ["Captation photo et vidéo", "Fichiers sauvegardés"],
  MONTAGE: [
    "Montage des séquences",
    "Textes, stickers et liens",
    "Retours client intégrés",
    "Version finale",
  ],
  LIVRAISON: ["Exports 9:16", "Validation client", "Publication programmée"],
};

const PHOTO: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Moodboard et références",
    "Planning du shooting",
    "Lieu, modèles et matériel réservés",
  ],
  CREATION: ["Liste des plans (shot list)", "Direction artistique validée par le client"],
  PRODUCTION: [
    "Shooting réalisé",
    "Photos sauvegardées (double copie)",
    "Autorisations de droit à l'image signées",
  ],
  MONTAGE: [
    "Tri et sélection",
    "Sélection validée par le client",
    "Retouches",
    "Retours client sur les retouches",
    "Version finale",
  ],
  LIVRAISON: [
    "Exports aux bons formats (web et print)",
    "Envoi au client (galerie)",
    "Validation client",
    "Publication programmée",
  ],
};

const POST: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Références",
    "Éléments client reçus (logo, charte, produits)",
  ],
  CREATION: ["Maquette du visuel", "Légende rédigée", "Concept validé par le client"],
  PRODUCTION: ["Visuel final réalisé", "Relecture orthographe"],
  MONTAGE: ["Retours client intégrés", "Version finale"],
  LIVRAISON: ["Exports aux bons formats", "Validation client", "Publication programmée"],
};

const CAROUSEL: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Références",
    "Éléments client reçus (logo, charte, produits)",
  ],
  CREATION: ["Structure des slides (fil narratif)", "Textes rédigés", "Maquette validée par le client"],
  PRODUCTION: ["Slides réalisées", "Relecture orthographe"],
  MONTAGE: ["Cohérence visuelle entre les slides", "Retours client intégrés", "Version finale"],
  LIVRAISON: [
    "Exports 4:5 (1080 × 1350)",
    "Légende et hashtags",
    "Validation client",
    "Publication programmée",
  ],
};

const VISUEL: ChecklistTemplate = {
  PREPARATION: ["Brief validé avec le client", "Références et moodboard", "Charte et éléments client reçus"],
  CREATION: ["Pistes graphiques", "Piste validée par le client"],
  PRODUCTION: ["Visuel réalisé", "Déclinaisons de formats"],
  MONTAGE: ["Retours client intégrés", "Version finale"],
  LIVRAISON: ["Exports aux bons formats", "Envoi au client", "Validation client"],
};

const ARTICLE: ChecklistTemplate = {
  PREPARATION: ["Brief validé avec le client", "Mots-clés et sources", "Plan de l'article"],
  CREATION: ["Plan validé par le client", "Premier jet rédigé"],
  PRODUCTION: ["Visuels et illustrations", "Relecture et corrections"],
  MONTAGE: ["Retours client intégrés", "Mise en page et optimisation SEO", "Version finale"],
  LIVRAISON: ["Intégration sur le site", "Validation client", "Publication programmée"],
};

const PRINT: ChecklistTemplate = {
  PREPARATION: [
    "Brief validé avec le client",
    "Format, papier et quantités définis",
    "Devis imprimeur validé",
  ],
  CREATION: ["Maquette", "Maquette validée par le client"],
  PRODUCTION: ["Textes définitifs intégrés", "Relecture orthographe"],
  MONTAGE: ["Retours client intégrés", "BAT envoyé", "BAT signé par le client"],
  LIVRAISON: ["Fichiers HD envoyés à l'imprimeur", "Contrôle du tirage", "Livraison au client"],
};

const AUTRE: ChecklistTemplate = {
  PREPARATION: ["Brief validé avec le client", "Références", "Planning calé"],
  CREATION: ["Concept", "Concept validé par le client"],
  PRODUCTION: ["Réalisation"],
  MONTAGE: ["Retours client intégrés", "Version finale"],
  LIVRAISON: ["Envoi au client", "Validation client"],
};

export const CHECKLIST_TEMPLATES: Record<DeliverableFormat, ChecklistTemplate> = {
  VIDEO,
  REEL,
  PHOTO,
  POST,
  CAROUSEL,
  STORY,
  VISUEL,
  ARTICLE,
  PRINT,
  AUTRE,
};

export function checklistTemplate(format: DeliverableFormat): ChecklistTemplate {
  return CHECKLIST_TEMPLATES[format] ?? AUTRE;
}

/** Points à créer avec le livrable, positions numérotées par étape. */
export function templateItems(
  format: DeliverableFormat,
): { stage: WorkStage; label: string; position: number }[] {
  const template = checklistTemplate(format);
  return WORK_STAGES.flatMap((stage) =>
    template[stage].map((label, position) => ({ stage, label, position })),
  );
}
