import { addDays } from "@/lib/dates";

/**
 * Modèles de projet (§3.4, §7.7). Durées en jours calendaires depuis la date de début.
 * Les dépendances sont exprimées par le titre de la tâche précédente, dans le même modèle.
 */
export type TemplateTask = { title: string; offset: number; duration: number; after?: string };
export type TemplateLot = { name: string; tasks: TemplateTask[] };
export type ProjectTemplate = { key: string; name: string; description: string; lots: TemplateLot[] };

export const TEMPLATES: ProjectTemplate[] = [
  {
    key: "production-audiovisuelle",
    name: "Production audiovisuelle",
    description: "Pré-production, tournage, post-production, livraison, clôture.",
    lots: [
      {
        name: "Pré-production",
        tasks: [
          { title: "Brief et note d'intention", offset: 0, duration: 4 },
          { title: "Repérages", offset: 4, duration: 5, after: "Brief et note d'intention" },
          { title: "Casting", offset: 4, duration: 7, after: "Brief et note d'intention" },
          { title: "Plan de tournage", offset: 11, duration: 4, after: "Repérages" },
          { title: "Budget de production validé", offset: 11, duration: 3 },
        ],
      },
      {
        name: "Tournage",
        tasks: [
          { title: "Préparation matériel et équipe", offset: 15, duration: 3, after: "Plan de tournage" },
          { title: "Jours de tournage", offset: 18, duration: 5, after: "Préparation matériel et équipe" },
          { title: "Sauvegarde et dérushage", offset: 23, duration: 3, after: "Jours de tournage" },
        ],
      },
      {
        name: "Post-production",
        tasks: [
          { title: "Montage", offset: 26, duration: 10, after: "Sauvegarde et dérushage" },
          { title: "Étalonnage", offset: 36, duration: 4, after: "Montage" },
          { title: "Mixage son", offset: 36, duration: 4, after: "Montage" },
          { title: "Validation client", offset: 40, duration: 5, after: "Étalonnage" },
        ],
      },
      {
        name: "Livraison",
        tasks: [
          { title: "Exports et masters", offset: 45, duration: 3, after: "Validation client" },
          { title: "Livraison des fichiers", offset: 48, duration: 2, after: "Exports et masters" },
        ],
      },
      {
        name: "Clôture",
        tasks: [
          { title: "Bilan de projet", offset: 50, duration: 3 },
          { title: "Archivage des rushes", offset: 50, duration: 5 },
        ],
      },
    ],
  },
  {
    key: "campagne-creative",
    name: "Campagne créative",
    description: "Concept, création, déclinaisons, diffusion.",
    lots: [
      {
        name: "Concept",
        tasks: [
          { title: "Brief et objectifs", offset: 0, duration: 3 },
          { title: "Pistes créatives", offset: 3, duration: 7, after: "Brief et objectifs" },
          { title: "Présentation client", offset: 10, duration: 2, after: "Pistes créatives" },
        ],
      },
      {
        name: "Création",
        tasks: [
          { title: "Key visual", offset: 12, duration: 7, after: "Présentation client" },
          { title: "Shooting", offset: 15, duration: 3, after: "Présentation client" },
          { title: "Rédaction des messages", offset: 12, duration: 5, after: "Présentation client" },
        ],
      },
      {
        name: "Déclinaisons",
        tasks: [
          { title: "Déclinaisons print", offset: 19, duration: 7, after: "Key visual" },
          { title: "Déclinaisons réseaux sociaux", offset: 19, duration: 7, after: "Key visual" },
          { title: "Validation client des déclinaisons", offset: 26, duration: 3 },
        ],
      },
      {
        name: "Diffusion",
        tasks: [
          { title: "Plan de diffusion", offset: 26, duration: 4 },
          { title: "Mise en ligne", offset: 30, duration: 2, after: "Validation client des déclinaisons" },
          { title: "Bilan de campagne", offset: 50, duration: 3, after: "Mise en ligne" },
        ],
      },
    ],
  },
  {
    key: "conseil-strategie",
    name: "Conseil / stratégie",
    description: "Diagnostic, recommandations, restitution.",
    lots: [
      {
        name: "Diagnostic",
        tasks: [
          { title: "Entretiens", offset: 0, duration: 7 },
          { title: "Analyse documentaire", offset: 0, duration: 7 },
          { title: "Synthèse du diagnostic", offset: 7, duration: 4, after: "Entretiens" },
        ],
      },
      {
        name: "Recommandations",
        tasks: [
          { title: "Atelier de co-construction", offset: 11, duration: 3, after: "Synthèse du diagnostic" },
          { title: "Plateforme de marque", offset: 14, duration: 10, after: "Atelier de co-construction" },
        ],
      },
      {
        name: "Restitution",
        tasks: [
          { title: "Présentation finale", offset: 24, duration: 3, after: "Plateforme de marque" },
          { title: "Livrable écrit", offset: 27, duration: 5, after: "Présentation finale" },
        ],
      },
    ],
  },
  { key: "vierge", name: "Projet vierge", description: "Vous construisez la structure vous-même.", lots: [] },
];

export const getTemplate = (key: string) => TEMPLATES.find((t) => t.key === key) ?? null;

export type PlannedTask = { title: string; startDate: Date; dueDate: Date; after?: string };
export type PlannedLot = {
  name: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  tasks: PlannedTask[];
};

/** Recalcule toutes les dates du modèle à partir de la date de début choisie (§7.7). */
export function planTemplate(
  template: ProjectTemplate,
  startDate: Date,
): { lots: PlannedLot[]; plannedEnd: Date } {
  let end = startDate;
  const lots = template.lots.map((lot) => {
    const tasks = lot.tasks.map((t) => {
      const s = addDays(startDate, t.offset);
      const e = addDays(startDate, t.offset + t.duration - 1);
      if (e > end) end = e;
      return { title: t.title, startDate: s, dueDate: e, after: t.after };
    });
    const starts = tasks.map((t) => t.startDate.getTime());
    const ends = tasks.map((t) => t.dueDate.getTime());
    return {
      name: lot.name,
      plannedStart: tasks.length ? new Date(Math.min(...starts)) : null,
      plannedEnd: tasks.length ? new Date(Math.max(...ends)) : null,
      tasks,
    };
  });
  return { lots, plannedEnd: end };
}

/** Checklist de clôture (§14.3), créée avec chaque projet. */
export const CLOSURE_ITEMS: { key: string; label: string }[] = [
  { key: "livrables", label: "Livrables livrés et référencés" },
  { key: "couts", label: "Coûts et dépenses rapprochés" },
  { key: "facturation", label: "Facturation et encaissements vérifiés" },
  { key: "bilan", label: "Bilan projet renseigné" },
  { key: "archives", label: "Fichiers et données archivés" },
  { key: "taches", label: "Tâches restantes traitées ou transférées" },
];
