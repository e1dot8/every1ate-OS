/**
 * Le point du matin (V1.3) : règles pures, sans base ni horloge implicite.
 * Heure de publication (8 h, heure de Paris, du lundi au vendredi), fenêtre « depuis le dernier
 * point », assemblage du point à partir des faits, texte court pour la Salle commune.
 *
 * Garde-fous : jamais de total ni de classement par personne ; un retard ou un blocage porte sur
 * l'objet (avec son motif), jamais sur quelqu'un. Le responsable n'est nommé que sur ce qui est
 * prévu (aujourd'hui, cette semaine), pour savoir qui est dessus.
 */
import { z } from "zod";
import type { DeliverableStage, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import { addDays, daysBetween, formatDay, formatTime, isWorkingDay, todayDate } from "@/lib/dates";
import { endOfWeek, isStage, stageIndex, stageLabels } from "@/features/deliverables/rules";
import { projectStatusLabels } from "@/features/projects/labels";
import { parisMidnight } from "@/features/qg/quests";

// ─── Heure de publication et fenêtre ────────────────────────────────────────

/** Heure de publication (heure de Paris). */
export const MORNING_HOUR = 8;
/** Éléments par rubrique dans le texte publié (au-delà : « … et N autres »). */
export const TEXT_ITEMS = 5;
/** Éléments gardés par rubrique dans l'instantané enregistré (la page les affiche). */
export const STORED_ITEMS = 30;
/** Projets gardés dans l'instantané. */
export const STORED_PROJECTS = 20;
/** Longueur maximale du texte publié dans la Salle commune. */
export const TEXT_MAX = 3500;

function parisHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((p) => p.type === "hour")?.value;
  return Number(hour ?? 0);
}

/** Du lundi au vendredi (jour de Paris), à partir de 8 h (heure de Paris, été comme hiver). */
export function isMorningReportDue(now: Date): boolean {
  return isWorkingDay(todayDate(now)) && parisHour(now) >= MORNING_HOUR;
}

/** Jour ouvré précédent (le lundi : vendredi ; le week-end : vendredi). */
export function previousWorkingDay(day: Date): Date {
  let d = addDays(day, -1);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}

const weekdayName = (day: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(day);

export type ReportWindow = {
  /** Jour du point (date calendrier de Paris, minuit UTC). */
  today: Date;
  /** Jour ouvré précédent. */
  previousDay: Date;
  /** Début (inclus) : minuit à Paris du jour ouvré précédent. */
  from: Date;
  /** Fin (exclue) : minuit à Paris aujourd'hui. */
  to: Date;
  /** « hier » ou « depuis vendredi ». */
  since: string;
};

/**
 * « Depuis le dernier point » : du début (minuit, heure de Paris) du jour ouvré précédent au début
 * d'aujourd'hui. Le lundi : depuis vendredi minuit, week-end inclus.
 */
export function reportWindow(now: Date): ReportWindow {
  const today = todayDate(now);
  const previousDay = previousWorkingDay(today);
  return {
    today,
    previousDay,
    from: parisMidnight(previousDay),
    to: parisMidnight(today),
    since: daysBetween(previousDay, today) === 1 ? "hier" : `depuis ${weekdayName(previousDay)}`,
  };
}

/** « Le point du mardi 4 novembre ». */
export function reportTitle(day: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(day);
  return `Le point du ${label}`;
}

// ─── Instantané enregistré (validé à la lecture) ────────────────────────────

/** Lien interne uniquement (jamais de schéma ni d'hôte) : l'instantané ne peut pas rediriger ailleurs. */
const internalHref = z.string().regex(/^\/(?![/\\])\S*$/);
const count = z.number().int().nonnegative();

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  href: internalHref,
  /** Projet, client… */
  context: z.string().optional(),
  /** Responsable de l'élément (jamais un total par personne). */
  owner: z.string().optional(),
  /** Précision sur l'objet : motif de blocage, échéance, étape, heure. */
  detail: z.string().optional(),
  tone: z.enum(["danger", "warning", "success"]).optional(),
});

const listSchema = z.object({
  key: z.string(),
  label: z.string(),
  total: count,
  items: z.array(itemSchema),
});

export const SECTION_KEYS = ["hier", "aujourdhui", "surveiller", "semaine"] as const;

const sectionSchema = z.object({
  key: z.enum(SECTION_KEYS),
  title: z.string(),
  empty: z.string(),
  lists: z.array(listSchema),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: internalHref,
  client: z.string().optional(),
  percent: z.number().int().min(0).max(100),
  tasksDone: count,
  tasksTotal: count,
  deliverablesInProgress: count,
  /** Prochaine échéance (AAAA-MM-JJ). */
  nextDue: z.string().optional(),
  /** Statut quand le projet n'est pas « Actif » (en attente, bloqué), avec son motif. */
  status: z.string().optional(),
  reason: z.string().optional(),
});

export const reportDataSchema = z.object({
  version: z.literal(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  since: z.string(),
  summary: z.string(),
  counts: z.object({ done: count, delivered: count, today: count, late: count, blocked: count }),
  sections: z.array(sectionSchema),
  projects: z.object({ total: count, items: z.array(projectSchema) }),
});

export type ReportItem = z.infer<typeof itemSchema>;
export type ReportList = z.infer<typeof listSchema>;
export type ReportSection = z.infer<typeof sectionSchema>;
export type ReportProject = z.infer<typeof projectSchema>;
export type MorningReportData = z.infer<typeof reportDataSchema>;

/** Lecture tolérante d'un instantané : null s'il est illisible (jamais d'exception). */
export function parseReportData(raw: unknown): MorningReportData | null {
  const parsed = reportDataSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ─── Faits (collectés par le service) ───────────────────────────────────────

export type StageEvent = { targetId: string | null; before: unknown; after: unknown };

export type MorningFacts = {
  window: ReportWindow;
  /** Tâches passées à « Terminé » dans la fenêtre. */
  doneTasks: { id: string; title: string; project: string }[];
  /** Livrables passés à une étape suivante dans la fenêtre (voir `summarizeStageMoves`). */
  stageMoves: { id: string; title: string; project: string; from: DeliverableStage; to: DeliverableStage }[];
  /** Livrables livrés dans la fenêtre. */
  delivered: { id: string; title: string; project: string }[];
  /** Opportunités signées dans la fenêtre. */
  won: { id: string; title: string; client: string | null }[];
  /** Projets créés dans la fenêtre. */
  newProjects: { id: string; name: string; client: string | null }[];
  /** Tâches ouvertes dues au plus tard aujourd'hui, ou bloquées. */
  openTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: Date | null;
    blockedReason: string | null;
    owner: string | null;
    project: string;
  }[];
  /** Livrables non livrés dus d'ici dimanche ou bloqués, et ceux à publier aujourd'hui. */
  deliverables: {
    id: string;
    title: string;
    stage: DeliverableStage;
    dueDate: Date | null;
    publishDate: Date | null;
    blockedReason: string | null;
    channel: string | null;
    owner: string | null;
    project: string;
  }[];
  /** Réunions partagées (jamais les événements privés) du jour. */
  meetings: { id: string; title: string; startsAt: Date; allDay: boolean; project: string | null }[];
  /** Relances commerciales dues (au plus tard aujourd'hui). */
  followUps: { id: string; title: string; nextAction: string | null; nextActionDate: Date | null }[];
  /** Passations en attente de réponse. */
  handoffs: {
    id: string;
    createdAt: Date;
    task: { id: string; title: string; project: string } | null;
    opportunity: { id: string; title: string; client: string | null } | null;
  }[];
  /** Projets actifs (ou en attente, bloqués) avec leurs compteurs. */
  projects: {
    id: string;
    name: string;
    client: string | null;
    status: ProjectStatus;
    statusReason: string | null;
    tasksDone: number;
    /** Tâches non annulées. */
    tasksTotal: number;
    deliverablesInProgress: number;
    nextDue: Date | null;
  }[];
};

const stageOf = (snapshot: unknown): DeliverableStage | null => {
  const value =
    snapshot && typeof snapshot === "object" && "stage" in snapshot
      ? (snapshot as { stage: unknown }).stage
      : null;
  return isStage(value) ? value : null;
};

/**
 * Passages d'étape VERS L'AVANT d'après le journal (dans l'ordre chronologique), regroupés par
 * livrable : de la première étape quittée à la dernière atteinte. Les retours en arrière sont
 * ignorés ; la livraison (« Livré ») est comptée à part.
 */
export function summarizeStageMoves(
  events: StageEvent[],
): { id: string; from: DeliverableStage; to: DeliverableStage }[] {
  const moves = new Map<string, { id: string; from: DeliverableStage; to: DeliverableStage }>();
  for (const e of events) {
    const from = stageOf(e.before);
    const to = stageOf(e.after);
    if (!e.targetId || !from || !to || stageIndex(to) <= stageIndex(from)) continue;
    const seen = moves.get(e.targetId);
    moves.set(e.targetId, { id: e.targetId, from: seen?.from ?? from, to });
  }
  return [...moves.values()].filter((m) => m.to !== "LIVRE" && stageIndex(m.to) > stageIndex(m.from));
}

// ─── Assemblage ─────────────────────────────────────────────────────────────

/** Emoji de chaque rubrique (texte publié et page). */
export const listEmoji: Record<string, string> = {
  "taches-terminees": "✅",
  "livrables-avances": "⏩",
  "livrables-livres": "📦",
  "opportunites-signees": "🤝",
  "nouveaux-projets": "✨",
  "taches-du-jour": "📌",
  "livrables-du-jour": "🎬",
  publications: "📣",
  reunions: "🗓️",
  "taches-en-retard": "⏰",
  "livrables-en-retard": "⏰",
  bloques: "🚧",
  relances: "📞",
  passations: "🔁",
  "livrables-semaine": "📅",
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const byText = (a: string, b: string) => a.localeCompare(b, "fr");
const time = (d: Date | null) => d?.getTime() ?? Number.POSITIVE_INFINITY;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const weekdayShort = (day: Date) =>
  lower(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(day),
  );
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const opt = (s: string | null | undefined) => clean(s) || undefined;

function list(key: string, label: string, items: ReportItem[]): ReportList {
  return { key, label, total: items.length, items: items.slice(0, STORED_ITEMS) };
}

/** Résumé chiffré court (notification, accueil) : « 3 terminées hier · 5 pour aujourd'hui · … ». */
export function summaryLine(counts: MorningReportData["counts"], since: string): string {
  const parts: string[] = [];
  if (counts.done) parts.push(`${plural(counts.done, "terminée", "terminées")} ${since}`);
  if (counts.delivered) parts.push(plural(counts.delivered, "livré", "livrés"));
  parts.push(counts.today ? `${counts.today} pour aujourd'hui` : "rien à rendre aujourd'hui");
  if (counts.late) parts.push(`${counts.late} en retard`);
  if (counts.blocked) parts.push(plural(counts.blocked, "bloqué", "bloqués"));
  if (!counts.late && !counts.blocked) parts.push("rien en retard");
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * Le point structuré à partir des faits. Chaque objet n'apparaît qu'à un endroit, le plus
 * important d'abord : bloqué, puis en retard, puis aujourd'hui, puis cette semaine.
 */
export function buildMorningReport(f: MorningFacts): MorningReportData {
  const { today, since } = f.window;
  const sunday = endOfWeek(today);
  const day = (d: Date | null) => formatDay(d, today);
  const isToday = (d: Date | null) => !!d && d.getTime() === today.getTime();
  const isLate = (d: Date | null) => !!d && d.getTime() < today.getTime();

  // Hier (ou depuis vendredi) : ce qui a avancé. Aucun responsable nommé : c'est collectif.
  const deliveredIds = new Set(f.delivered.map((d) => d.id));
  const hier: ReportList[] = [
    list(
      "taches-terminees",
      "Tâches terminées",
      [...f.doneTasks]
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((t) => ({ id: t.id, title: t.title, href: `/taches/${t.id}`, context: t.project })),
    ),
    list(
      "livrables-avances",
      "Livrables passés à l'étape suivante",
      f.stageMoves
        .filter((m) => !deliveredIds.has(m.id))
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((m) => ({
          id: m.id,
          title: m.title,
          href: `/livrables/${m.id}`,
          context: m.project,
          detail: `${stageLabels[m.from]} → ${stageLabels[m.to]}`,
        })),
    ),
    list(
      "livrables-livres",
      "Livrables livrés",
      [...f.delivered]
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: d.project,
          tone: "success" as const,
        })),
    ),
    list(
      "opportunites-signees",
      "Opportunités signées",
      [...f.won]
        .sort((a, b) => byText(a.title, b.title))
        .map((o) => ({
          id: o.id,
          title: o.title,
          href: `/crm/opportunites/${o.id}`,
          context: opt(o.client),
          tone: "success" as const,
        })),
    ),
    list(
      "nouveaux-projets",
      "Nouveaux projets",
      [...f.newProjects]
        .sort((a, b) => byText(a.name, b.name))
        .map((p) => ({ id: p.id, title: p.name, href: `/projets/${p.id}`, context: opt(p.client) })),
    ),
  ];

  // Tâches ouvertes : bloquées, en retard, dues aujourd'hui.
  const blockedTasks = f.openTasks.filter((t) => t.status === "BLOQUE");
  const lateTasks = f.openTasks.filter((t) => t.status !== "BLOQUE" && isLate(t.dueDate));
  const todayTasks = f.openTasks.filter((t) => t.status !== "BLOQUE" && isToday(t.dueDate));

  // Livrables non livrés : bloqués (motif), en retard, dus aujourd'hui, d'ici dimanche.
  const working = f.deliverables.filter((d) => d.stage !== "LIVRE");
  const blockedDeliverables = working.filter((d) => clean(d.blockedReason));
  const free = working.filter((d) => !clean(d.blockedReason));
  const lateDeliverables = free.filter((d) => isLate(d.dueDate));
  const todayDeliverables = free.filter((d) => isToday(d.dueDate));
  const weekDeliverables = free.filter(
    (d) => d.dueDate && d.dueDate.getTime() > today.getTime() && d.dueDate.getTime() <= sunday.getTime(),
  );
  const publications = f.deliverables.filter((d) => isToday(d.publishDate));

  const aujourdhui: ReportList[] = [
    list(
      "taches-du-jour",
      "Tâches à rendre",
      [...todayTasks]
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          href: `/taches/${t.id}`,
          context: t.project,
          owner: opt(t.owner),
        })),
    ),
    list(
      "livrables-du-jour",
      "Livrables à livrer",
      [...todayDeliverables]
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: d.project,
          owner: opt(d.owner),
          detail: `Étape : ${stageLabels[d.stage]}`,
        })),
    ),
    list(
      "publications",
      "Publications prévues",
      [...publications]
        .sort((a, b) => byText(a.project, b.project) || byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: [d.project, clean(d.channel)].filter(Boolean).join(" · "),
          owner: opt(d.owner),
          detail:
            d.stage === "LIVRE" ? "Livré, prêt à publier" : `Pas encore livré (${stageLabels[d.stage]})`,
          tone: d.stage === "LIVRE" ? undefined : ("warning" as const),
        })),
    ),
    list(
      "reunions",
      "Réunions",
      [...f.meetings]
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || byText(a.title, b.title))
        .map((m) => ({
          id: m.id,
          title: m.title,
          href: `/calendrier/${m.id}`,
          context: opt(m.project),
          detail:
            m.allDay || m.startsAt.getTime() < parisMidnight(today).getTime()
              ? "Journée"
              : formatTime(m.startsAt),
        })),
    ),
  ];

  // À surveiller : l'objet et son motif, jamais une personne.
  const surveiller: ReportList[] = [
    list("bloques", "Bloqué", [
      ...[...blockedTasks]
        .sort((a, b) => byText(a.title, b.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          href: `/taches/${t.id}`,
          context: `Tâche · ${t.project}`,
          detail: clean(t.blockedReason) ? `Motif : ${clean(t.blockedReason)}` : "Motif non précisé",
          tone: "warning" as const,
        })),
      ...[...blockedDeliverables]
        .sort((a, b) => byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: `Livrable · ${d.project}`,
          detail: `Motif : ${clean(d.blockedReason)}`,
          tone: "warning" as const,
        })),
    ]),
    list(
      "taches-en-retard",
      "Tâches en retard",
      [...lateTasks]
        .sort((a, b) => time(a.dueDate) - time(b.dueDate) || byText(a.title, b.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          href: `/taches/${t.id}`,
          context: t.project,
          detail: `Prévue le ${day(t.dueDate)}`,
          tone: "danger" as const,
        })),
    ),
    list(
      "livrables-en-retard",
      "Livrables en retard",
      [...lateDeliverables]
        .sort((a, b) => time(a.dueDate) - time(b.dueDate) || byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: d.project,
          detail: `Prévu le ${day(d.dueDate)} · étape : ${stageLabels[d.stage]}`,
          tone: "danger" as const,
        })),
    ),
    list(
      "relances",
      "Relances commerciales en retard",
      f.followUps
        .filter((o) => isLate(o.nextActionDate))
        .sort((a, b) => time(a.nextActionDate) - time(b.nextActionDate) || byText(a.title, b.title))
        .map((o) => ({
          id: o.id,
          title: o.title,
          href: `/crm/opportunites/${o.id}`,
          detail: `${clean(o.nextAction) || "Relance"} · prévue le ${day(o.nextActionDate)}`,
          tone: "danger" as const,
        })),
    ),
    list(
      "passations",
      "Passations en attente",
      [...f.handoffs]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .flatMap((h) => {
          const proposed = `Proposée le ${day(todayDate(h.createdAt))}`;
          if (h.task)
            return [
              {
                id: h.id,
                title: h.task.title,
                href: `/taches/${h.task.id}`,
                context: `Tâche · ${h.task.project}`,
                detail: proposed,
              },
            ];
          if (h.opportunity)
            return [
              {
                id: h.id,
                title: h.opportunity.title,
                href: `/crm/opportunites/${h.opportunity.id}`,
                context: ["Opportunité", clean(h.opportunity.client)].filter(Boolean).join(" · "),
                detail: proposed,
              },
            ];
          return [];
        }),
    ),
  ];

  const semaine: ReportList[] = [
    list(
      "livrables-semaine",
      "Livrables à livrer d'ici dimanche",
      [...weekDeliverables]
        .sort((a, b) => time(a.dueDate) - time(b.dueDate) || byText(a.title, b.title))
        .map((d) => ({
          id: d.id,
          title: d.title,
          href: `/livrables/${d.id}`,
          context: d.project,
          owner: opt(d.owner),
          detail: `Pour ${weekdayShort(d.dueDate!)} · étape : ${stageLabels[d.stage]}`,
        })),
    ),
  ];

  const projects = [...f.projects]
    .sort((a, b) => time(a.nextDue) - time(b.nextDue) || byText(a.name, b.name))
    .map((p): ReportProject => ({
      id: p.id,
      name: p.name,
      href: `/projets/${p.id}`,
      client: opt(p.client),
      percent: p.tasksTotal ? Math.min(100, Math.round((p.tasksDone / p.tasksTotal) * 100)) : 0,
      tasksDone: p.tasksDone,
      tasksTotal: p.tasksTotal,
      deliverablesInProgress: p.deliverablesInProgress,
      nextDue: p.nextDue ? p.nextDue.toISOString().slice(0, 10) : undefined,
      status: p.status === "ACTIF" ? undefined : projectStatusLabels[p.status],
      reason: p.status === "ACTIF" ? undefined : opt(p.statusReason),
    }));

  const counts = {
    done: f.doneTasks.length,
    delivered: f.delivered.length,
    today: todayTasks.length + todayDeliverables.length,
    late: lateTasks.length + lateDeliverables.length,
    blocked: blockedTasks.length + blockedDeliverables.length,
  };
  const sinceTitle = since.charAt(0).toUpperCase() + since.slice(1);
  const nonEmpty = (lists: ReportList[]) => lists.filter((l) => l.total > 0);
  return {
    version: 1,
    date: today.toISOString().slice(0, 10),
    title: reportTitle(today),
    since,
    summary: summaryLine(counts, since),
    counts,
    sections: [
      { key: "hier", title: sinceTitle, empty: "Rien de terminé.", lists: nonEmpty(hier) },
      {
        key: "aujourdhui",
        title: "Aujourd'hui",
        empty: "Rien de prévu aujourd'hui.",
        lists: nonEmpty(aujourdhui),
      },
      {
        key: "surveiller",
        title: "À surveiller",
        empty: "Rien en retard, rien de bloqué.",
        lists: nonEmpty(surveiller),
      },
      {
        key: "semaine",
        title: "Cette semaine",
        empty: "Rien d'autre à livrer d'ici dimanche.",
        lists: nonEmpty(semaine),
      },
    ],
    projects: { total: projects.length, items: projects.slice(0, STORED_PROJECTS) },
  };
}

// ─── Texte publié (Markdown léger) ──────────────────────────────────────────

/** Neutralise la mise en forme involontaire d'un titre (astérisques, accents graves, retours). */
function plain(s: string, max = 80): string {
  const value = clean(s).replace(/\*/g, "∗").replace(/`/g, "'");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function itemLine(item: ReportItem): string {
  const meta = [item.context, item.owner, item.detail]
    .filter((x): x is string => !!x)
    .map((x) => plain(x, 60));
  return `• ${plain(item.title)}${meta.length ? ` · ${meta.join(" · ")}` : ""}`;
}

function more(n: number): string {
  return `… et ${n} ${n > 1 ? "autres" : "autre"}`;
}

function projectLine(p: ReportProject, today: Date): string {
  const parts = [
    p.tasksTotal ? `${p.percent} % des tâches` : "aucune tâche",
    p.deliverablesInProgress
      ? plural(p.deliverablesInProgress, "livrable en cours", "livrables en cours")
      : null,
    p.nextDue ? `prochaine échéance ${formatDay(new Date(`${p.nextDue}T00:00:00Z`), today)}` : null,
    p.status ? `${lower(p.status)}${p.reason ? ` : ${plain(p.reason, 60)}` : ""}` : null,
  ].filter(Boolean);
  return `• ${plain(p.name)} : ${parts.join(" · ")}`;
}

function renderWith(report: MorningReportData, perList: number): string {
  const today = new Date(`${report.date}T00:00:00Z`);
  const lines: string[] = [`☀️ **${report.title}**`, report.summary];
  const section = (s: ReportSection | undefined) => {
    if (!s) return;
    lines.push("", `**${s.title}**`);
    if (!s.lists.length) {
      lines.push(s.empty);
      return;
    }
    for (const l of s.lists) {
      lines.push(`${listEmoji[l.key] ?? "•"} ${l.label} (${l.total})`);
      const shown = l.items.slice(0, perList);
      for (const item of shown) lines.push(itemLine(item));
      if (l.total > shown.length && shown.length) lines.push(more(l.total - shown.length));
    }
  };
  const byKey = (key: ReportSection["key"]) => report.sections.find((s) => s.key === key);
  section(byKey("hier"));
  section(byKey("aujourdhui"));
  section(byKey("surveiller"));
  lines.push("", "**Projets actifs**");
  if (!report.projects.items.length) lines.push("Aucun projet actif.");
  else {
    const shown = report.projects.items.slice(0, perList);
    for (const p of shown) lines.push(projectLine(p, today));
    if (report.projects.total > shown.length)
      lines.push(
        shown.length ? more(report.projects.total - shown.length) : `${report.projects.total} projets`,
      );
  }
  section(byKey("semaine"));
  return lines.join("\n");
}

/**
 * Texte court publié dans la Salle commune : gras `**`, retours à la ligne, puces « • ».
 * Au plus 5 éléments par rubrique (« … et N autres ») et 3 500 caractères : au-delà, les
 * rubriques sont raccourcies, puis le texte est coupé.
 */
export function renderReportText(report: MorningReportData): string {
  for (const perList of [TEXT_ITEMS, 3, 1, 0]) {
    const text = renderWith(report, perList);
    if (text.length <= TEXT_MAX) return text;
  }
  return `${renderWith(report, 0).slice(0, TEXT_MAX - 1)}…`;
}
