/**
 * Arbre de compétences : six branches ouvertes à tous, sans classe métier fixe.
 * Le niveau d'une compétence ne dépend ni du rang ni du nombre de tâches (ADR-0017).
 */

export type Skill = {
  key: string;
  name: string;
  description: string;
  /** Exemples de preuves acceptées. */
  proofs: string[];
  /** Actions concrètes pour progresser. */
  actions: string[];
};

export type Branch = { key: string; name: string; tagline: string; skills: Skill[] };

const s = (key: string, name: string, description: string, proofs: string[], actions: string[]): Skill => ({
  key,
  name,
  description,
  proofs,
  actions,
});

export const BRANCHES: Branch[] = [
  {
    key: "creation",
    name: "Création & stratégie",
    tagline: "Comprendre la marque et trouver l'angle.",
    skills: [
      s(
        "diagnostic",
        "Diagnostic & recherche",
        "Analyser une marque, sa communauté et son marché.",
        ["Audit de marque livré", "Benchmark structuré"],
        ["Mener un audit sur un projet", "Documenter une grille d'analyse"],
      ),
      s(
        "positionnement",
        "Positionnement",
        "Formuler ce qui rend une marque singulière.",
        ["Plateforme de marque validée"],
        ["Rédiger un positionnement et le confronter"],
      ),
      s(
        "concept",
        "Concept créatif",
        "Trouver l'idée qui porte une campagne.",
        ["Concept retenu par un client"],
        ["Proposer deux pistes sur un brief réel"],
      ),
      s(
        "direction-artistique",
        "Direction artistique",
        "Donner une identité visuelle cohérente.",
        ["Moodboard validé", "Charte appliquée"],
        ["Construire un moodboard commenté"],
      ),
      s(
        "deck",
        "Deck & présentation",
        "Raconter une stratégie et convaincre.",
        ["Présentation client réussie"],
        ["Présenter un deck à la brigade avant le client"],
      ),
      s(
        "mesure",
        "Mesure d'impact",
        "Définir et lire les indicateurs d'une campagne.",
        ["Bilan de campagne chiffré"],
        ["Fixer 3 indicateurs avant un lancement"],
      ),
    ],
  },
  {
    key: "production",
    name: "Production & livraison",
    tagline: "Faire exister l'idée, à l'heure et au budget.",
    skills: [
      s(
        "budget-prod",
        "Budget de production",
        "Chiffrer et tenir un budget.",
        ["Budget tenu à ±10 %"],
        ["Chiffrer une production avec un associé"],
      ),
      s(
        "planning-prod",
        "Planning",
        "Organiser les étapes et les dépendances.",
        ["Rétroplanning respecté"],
        ["Construire la roadmap d'un projet dans l'OS"],
      ),
      s(
        "prestataires",
        "Prestataires & logistique",
        "Trouver, briefer et coordonner les partenaires.",
        ["Tournage coordonné"],
        ["Constituer une liste de prestataires fiables"],
      ),
      s(
        "tournage",
        "Tournage & coordination",
        "Piloter une journée de production.",
        ["Plateau mené de bout en bout"],
        ["Préparer une feuille de service"],
      ),
      s(
        "post-production",
        "Post-production",
        "Monter, étalonner, finaliser.",
        ["Livrable monté et validé"],
        ["Monter une version et recueillir les retours"],
      ),
      s(
        "qualite",
        "Contrôle qualité & livraison",
        "Vérifier, livrer, archiver proprement.",
        ["Livraison sans retour technique"],
        ["Utiliser une checklist de livraison"],
      ),
    ],
  },
  {
    key: "commercial",
    name: "Développement commercial",
    tagline: "Trouver les bons clients et les garder.",
    skills: [
      s(
        "prospection",
        "Ciblage & prospection",
        "Identifier et approcher les bonnes marques.",
        ["Premier rendez-vous obtenu"],
        ["Lister 10 cibles et en contacter 3"],
      ),
      s(
        "discovery",
        "Discovery call & qualification",
        "Comprendre le besoin et qualifier.",
        ["Opportunité qualifiée dans le CRM"],
        ["Préparer une trame d'appel"],
      ),
      s(
        "proposition",
        "Proposition & devis",
        "Écrire une proposition qui convainc.",
        ["Proposition signée"],
        ["Relire une proposition d'un associé"],
      ),
      s(
        "negociation",
        "Négociation",
        "Défendre la valeur, trouver l'accord.",
        ["Accord sans brader le prix"],
        ["Préparer ses marges de négociation"],
      ),
      s(
        "fidelisation",
        "Suivi & fidélisation",
        "Faire revenir un client.",
        ["Deuxième mission d'un client"],
        ["Proposer une suite après un projet réussi"],
      ),
    ],
  },
  {
    key: "agence",
    name: "Gestion & développement agence",
    tagline: "Faire tourner la maison.",
    skills: [
      s(
        "finances",
        "Finances & trésorerie",
        "Suivre la trésorerie et la rentabilité.",
        ["Prévision de trésorerie tenue"],
        ["Mettre à jour le solde et lire la prévision"],
      ),
      s(
        "offres",
        "Offres",
        "Concevoir et packager les offres de l'agence.",
        ["Offre publiée"],
        ["Formaliser une offre récurrente"],
      ),
      s(
        "process",
        "Processus & outils",
        "Améliorer les façons de faire et l'OS.",
        ["Processus documenté et adopté"],
        ["Proposer une amélioration de l'OS"],
      ),
      s(
        "partenariats",
        "Partenariats",
        "Construire des alliances utiles.",
        ["Partenariat actif"],
        ["Rencontrer un partenaire potentiel"],
      ),
      s(
        "gouvernance",
        "Gouvernance",
        "Décider à trois, clairement.",
        ["Décision collective menée"],
        ["Préparer une décision avec ses options"],
      ),
    ],
  },
  {
    key: "visibilite",
    name: "Personal branding & visibilité",
    tagline: "Montrer le travail et la façon de penser.",
    skills: [
      s(
        "portfolio",
        "Portfolio",
        "Tenir un portfolio vivant.",
        ["Portfolio mis à jour"],
        ["Ajouter un projet récent au portfolio"],
      ),
      s(
        "etude-de-cas",
        "Étude de cas",
        "Raconter un projet et ses résultats.",
        ["Étude de cas publiée"],
        ["Écrire le cas d'un projet livré"],
      ),
      s(
        "publication",
        "Publication & réseaux",
        "Publier régulièrement et utilement.",
        ["Série de publications"],
        ["Publier les coulisses d'un projet"],
      ),
      s(
        "prise-de-parole",
        "Prise de parole",
        "Intervenir, animer, convaincre en public.",
        ["Intervention donnée"],
        ["Proposer un talk ou un atelier"],
      ),
      s(
        "reseau",
        "Réseau",
        "Entretenir des relations professionnelles.",
        ["Recommandation obtenue"],
        ["Revoir 2 contacts ce mois-ci"],
      ),
    ],
  },
  {
    key: "brigade",
    name: "Apprentissage & brigade",
    tagline: "Progresser et faire progresser.",
    skills: [
      s(
        "outil",
        "Maîtrise d'un outil",
        "Devenir à l'aise sur un outil clé.",
        ["Livrable produit avec l'outil"],
        ["Suivre une formation et l'appliquer"],
      ),
      s(
        "documentation",
        "Documentation",
        "Écrire des méthodes réutilisables.",
        ["Recette réutilisée par un associé"],
        ["Documenter une méthode après un projet"],
      ),
      s(
        "feedback",
        "Feedback",
        "Donner et recevoir des retours constructifs.",
        ["Retour appliqué sur un livrable"],
        ["Demander un retour précis à un associé"],
      ),
      s(
        "entraide",
        "Entraide & résolution",
        "Débloquer une situation, aider un associé.",
        ["Blocage levé avec un associé"],
        ["Répondre à une demande d'aide"],
      ),
      s(
        "transmission",
        "Transmission",
        "Faire monter les autres en compétence.",
        ["Associé formé sur un sujet"],
        ["Animer une session de partage"],
      ),
    ],
  },
];

export const SKILLS: (Skill & { branch: Branch })[] = BRANCHES.flatMap((b) =>
  b.skills.map((sk) => ({ ...sk, branch: b })),
);

export const skillByKey = (key: string) => SKILLS.find((sk) => sk.key === key) ?? null;

/** Niveaux de maîtrise (1 à 5). */
export const MASTERY: { level: number; name: string; description: string }[] = [
  { level: 1, name: "Découverte", description: "Comprend les bases, expérimente avec aide." },
  { level: 2, name: "Pratique", description: "Réalise une action simple avec une autonomie croissante." },
  { level: 3, name: "Autonomie", description: "Maîtrise les tâches courantes en situation réelle." },
  { level: 4, name: "Maîtrise", description: "Gère des situations complexes et adapte sa méthode." },
  { level: 5, name: "Transmission", description: "Améliore les méthodes et aide les autres à progresser." },
];

/** Niveau suggéré par les preuves (jamais imposé) : 1 preuve → 2, 3 → 3, 6 → 4. */
export function suggestedLevel(evidence: number, endorsements: number): number {
  const score = evidence + endorsements;
  return score >= 6 ? 4 : score >= 3 ? 3 : score >= 1 ? 2 : 1;
}
