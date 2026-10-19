import "server-only";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatDay, parseDateInput } from "@/lib/dates";
import { localDay } from "@/features/calendar/rules";
import { stageLabels, type Stage } from "@/features/crm/rules";
import { projectStatusLabels, taskStatusLabels } from "@/features/projects/labels";
import type { ServiceResult } from "@/features/projects/service";
import type { ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import {
  SEARCH_GROUPS,
  SEARCH_GROUP_LIMIT,
  SEARCH_MIN_LENGTH,
  containsFolded,
  containsPattern,
  documentHref,
  normalizeQuery,
  prefixPattern,
  snippetAround,
  type SearchGroupKey,
} from "@/features/search/rules";

type Viewer = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

export type SearchHit = {
  id: string;
  title: string;
  href: string;
  meta: string | null;
  /** Extrait autour de la correspondance (comptes rendus, description d'un projet). */
  snippet: string | null;
};
export type SearchGroup = { key: SearchGroupKey; label: string; count: number; hits: SearchHit[] };
export type SearchResults = { term: string; total: number; groups: SearchGroup[] };

/** Total des correspondances du groupe (fenêtre calculée avant LIMIT). */
type Counted = { total: number };
type ProjectRow = Counted & {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  clientName: string | null;
};
type ClientRow = Counted & { id: string; name: string; sector: string | null };
type ContactRow = Counted & {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string | null;
  clientName: string;
};
type OpportunityRow = Counted & { id: string; title: string; stage: Stage; clientName: string };
type TaskRow = Counted & { id: string; title: string; status: TaskStatus; projectName: string };
type FileRow = Counted & {
  id: string;
  title: string;
  projectId: string | null;
  taskId: string | null;
  clientId: string | null;
  projectName: string | null;
  clientName: string | null;
  taskTitle: string | null;
};
type EventRow = Counted & { id: string; title: string; startsAt: Date; allDay: boolean };
type NoteRow = Counted & {
  id: string;
  title: string;
  body: string;
  occurredAt: Date;
  projectName: string | null;
  clientName: string | null;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;
const asDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

/**
 * Recherche globale, insensible aux accents et à la casse (`unaccent` de PostgreSQL).
 * Requêtes paramétrées uniquement ; jokers LIKE échappés (`ESCAPE '\'`).
 * Archives exclues ; événements limités à ce que le lecteur peut voir (même règle que l'agenda) :
 * le titre d'un créneau non partagé d'un autre associé ne fuit jamais.
 */
export async function globalSearch(raw: string, viewer: Viewer): Promise<ServiceResult<SearchResults>> {
  const query = normalizeQuery(raw);
  if (query.status !== "ok") return failed(`Saisissez au moins ${SEARCH_MIN_LENGTH} caractères.`);
  const { term } = query;
  const like = containsPattern(term);
  const prefix = prefixPattern(term);
  const limit = SEARCH_GROUP_LIMIT;
  const db = getDb();

  try {
    const [projects, clients, contacts, opportunities, tasks, files, events, notes] = await Promise.all([
      db.$queryRaw<ProjectRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT p."id", p."name", p."description", p."status"::text AS "status", c."name" AS "clientName",
               (count(*) OVER ())::int AS "total"
        FROM "project" p
        CROSS JOIN q
        LEFT JOIN "client" c ON c."id" = p."clientId"
        WHERE p."archivedAt" IS NULL
          AND (unaccent(lower(p."name")) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(coalesce(p."description", ''))) LIKE q.pat ESCAPE '\\')
        ORDER BY (unaccent(lower(p."name")) LIKE q.pre ESCAPE '\\') DESC, p."updatedAt" DESC
        LIMIT ${limit}::int`,
      db.$queryRaw<ClientRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT c."id", c."name", c."sector", (count(*) OVER ())::int AS "total"
        FROM "client" c
        CROSS JOIN q
        WHERE c."archivedAt" IS NULL
          AND unaccent(lower(c."name")) LIKE q.pat ESCAPE '\\'
        ORDER BY (unaccent(lower(c."name")) LIKE q.pre ESCAPE '\\') DESC, c."name" ASC
        LIMIT ${limit}::int`,
      db.$queryRaw<ContactRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT ct."id", ct."firstName", ct."lastName", ct."email", ct."role", c."name" AS "clientName",
               (count(*) OVER ())::int AS "total"
        FROM "client_contact" ct
        CROSS JOIN q
        JOIN "client" c ON c."id" = ct."clientId"
        WHERE ct."archivedAt" IS NULL
          AND c."archivedAt" IS NULL
          AND (unaccent(lower(ct."firstName" || ' ' || ct."lastName")) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(ct."lastName" || ' ' || ct."firstName")) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(coalesce(ct."email", ''))) LIKE q.pat ESCAPE '\\')
        ORDER BY (unaccent(lower(ct."firstName" || ' ' || ct."lastName")) LIKE q.pre ESCAPE '\\'
                  OR unaccent(lower(ct."lastName")) LIKE q.pre ESCAPE '\\') DESC,
                 ct."lastName" ASC, ct."firstName" ASC
        LIMIT ${limit}::int`,
      db.$queryRaw<OpportunityRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT o."id", o."title", o."stage"::text AS "stage", c."name" AS "clientName",
               (count(*) OVER ())::int AS "total"
        FROM "opportunity" o
        CROSS JOIN q
        JOIN "client" c ON c."id" = o."clientId"
        WHERE o."archivedAt" IS NULL
          AND unaccent(lower(o."title")) LIKE q.pat ESCAPE '\\'
        ORDER BY (unaccent(lower(o."title")) LIKE q.pre ESCAPE '\\') DESC, o."updatedAt" DESC
        LIMIT ${limit}::int`,
      db.$queryRaw<TaskRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT t."id", t."title", t."status"::text AS "status", p."name" AS "projectName",
               (count(*) OVER ())::int AS "total"
        FROM "task" t
        CROSS JOIN q
        JOIN "project" p ON p."id" = t."projectId"
        WHERE t."archivedAt" IS NULL
          AND p."archivedAt" IS NULL
          AND unaccent(lower(t."title")) LIKE q.pat ESCAPE '\\'
        ORDER BY (unaccent(lower(t."title")) LIKE q.pre ESCAPE '\\') DESC,
                 (t."status" IN ('TERMINE', 'ANNULE')) ASC, t."updatedAt" DESC
        LIMIT ${limit}::int`,
      db.$queryRaw<FileRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT f."id", f."title", f."projectId", f."taskId", f."clientId",
               p."name" AS "projectName", c."name" AS "clientName", tk."title" AS "taskTitle",
               (count(*) OVER ())::int AS "total"
        FROM "file_reference" f
        CROSS JOIN q
        LEFT JOIN "project" p ON p."id" = f."projectId"
        LEFT JOIN "client" c ON c."id" = f."clientId"
        LEFT JOIN "task" tk ON tk."id" = f."taskId"
        WHERE f."archivedAt" IS NULL
          AND unaccent(lower(f."title")) LIKE q.pat ESCAPE '\\'
        ORDER BY (unaccent(lower(f."title")) LIKE q.pre ESCAPE '\\') DESC, f."createdAt" DESC
        LIMIT ${limit}::int`,
      db.$queryRaw<EventRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat, unaccent(lower(${prefix}::text)) AS pre)
        SELECT e."id", e."title", e."startsAt", e."allDay", (count(*) OVER ())::int AS "total"
        FROM "calendar_event" e
        CROSS JOIN q
        WHERE e."cancelledAt" IS NULL
          AND (e."visibility" = 'PARTAGE'
            OR e."ownerId" = ${viewer.id}
            OR EXISTS (
              SELECT 1 FROM "event_attendee" a WHERE a."eventId" = e."id" AND a."userId" = ${viewer.id}
            ))
          AND unaccent(lower(e."title")) LIKE q.pat ESCAPE '\\'
        ORDER BY (unaccent(lower(e."title")) LIKE q.pre ESCAPE '\\') DESC,
                 -- timestamp sans fuseau stocké en UTC : comparé à now() en UTC, quel que soit le fuseau de session
                 (e."endsAt" < (now() AT TIME ZONE 'UTC')) ASC,
                 CASE WHEN e."endsAt" >= (now() AT TIME ZONE 'UTC') THEN e."startsAt" END ASC,
                 e."startsAt" DESC
        LIMIT ${limit}::int`,
      db.$queryRaw<NoteRow[]>`
        WITH q AS (SELECT unaccent(lower(${like}::text)) AS pat)
        SELECT n."id", n."title", n."body", n."occurredAt",
               p."name" AS "projectName", c."name" AS "clientName",
               (count(*) OVER ())::int AS "total"
        FROM "meeting_note" n
        CROSS JOIN q
        LEFT JOIN "project" p ON p."id" = n."projectId"
        LEFT JOIN "client" c ON c."id" = n."clientId"
        WHERE n."archivedAt" IS NULL
          AND (unaccent(lower(n."title")) LIKE q.pat ESCAPE '\\'
            OR unaccent(lower(n."body")) LIKE q.pat ESCAPE '\\')
        ORDER BY (unaccent(lower(n."title")) LIKE q.pat ESCAPE '\\') DESC,
                 n."occurredAt" DESC, n."createdAt" DESC
        LIMIT ${limit}::int`,
    ]);

    const hits: Record<SearchGroupKey, { count: number; hits: SearchHit[] }> = {
      projets: group(projects, (p) => ({
        id: p.id,
        title: p.name,
        href: `/projets/${p.id}`,
        meta: join(p.clientName ?? "Sans client", projectStatusLabels[p.status]),
        // Trouvé par sa description seulement : l'extrait montre pourquoi.
        snippet:
          p.description && !containsFolded(p.name, term) ? snippetAround(p.description, term) || null : null,
      })),
      entreprises: group(clients, (c) => ({
        id: c.id,
        title: c.name,
        href: `/crm/clients/${c.id}`,
        meta: c.sector,
        snippet: null,
      })),
      contacts: group(contacts, (c) => ({
        id: c.id,
        title: `${c.firstName} ${c.lastName}`,
        href: `/crm/contacts/${c.id}`,
        meta: join(c.role, c.clientName, c.email),
        snippet: null,
      })),
      opportunites: group(opportunities, (o) => ({
        id: o.id,
        title: o.title,
        href: `/crm/opportunites/${o.id}`,
        meta: join(o.clientName, stageLabels[o.stage]),
        snippet: null,
      })),
      taches: group(tasks, (t) => ({
        id: t.id,
        title: t.title,
        href: `/taches/${t.id}`,
        meta: join(t.projectName, taskStatusLabels[t.status]),
        snippet: null,
      })),
      documents: group(files, (f) => ({
        id: f.id,
        title: f.title,
        href: documentHref(f),
        meta: join(f.projectName ?? f.clientName ?? "Bibliothèque", f.taskTitle),
        snippet: null,
      })),
      evenements: group(events, (e) => {
        const startsAt = asDate(e.startsAt);
        return {
          id: e.id,
          title: e.title,
          href: `/calendrier/${e.id}`,
          meta: e.allDay
            ? join(formatDay(parseDateInput(localDay(startsAt))), "journée entière")
            : formatDateTime(startsAt),
          snippet: null,
        };
      }),
      "comptes-rendus": group(notes, (n) => ({
        id: n.id,
        title: n.title,
        href: `/notes/${n.id}`,
        meta: join(formatDay(asDate(n.occurredAt)), n.projectName ?? n.clientName),
        snippet: snippetAround(n.body, term) || null,
      })),
    };

    const groups = SEARCH_GROUPS.map(({ key, label }) => ({ key, label, ...hits[key] }));
    return done({ term, total: groups.reduce((n, g) => n + g.count, 0), groups });
  } catch (error) {
    console.error("[recherche] requête impossible", error);
    return failed("La recherche est momentanément indisponible. Réessayez dans un instant.");
  }
}

function group<T extends Counted>(rows: T[], toHit: (row: T) => SearchHit) {
  return { count: rows.length ? Number(rows[0].total) : 0, hits: rows.map(toHit) };
}
