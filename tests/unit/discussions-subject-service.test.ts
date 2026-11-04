import { beforeEach, describe, expect, it, vi } from "vitest";

/** Base, événements, salons et journal simulés : aucune base réelle. */
const h = vi.hoisted(() => ({
  emitted: [] as Record<string, unknown>[],
  previousAuthors: [] as { authorId: string | null }[],
  comments: [] as Record<string, unknown>[],
  /** Commentaires déjà réservés par une autre passe (la réservation échoue). */
  takenElsewhere: new Set<string>(),
  created: [] as Record<string, unknown>[],
  committed: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    const db = {
      message: {
        findMany: async () => h.previousAuthors,
        findFirst: async () => ({ id: "racine", channel: { id: "salon", slug: "projet" } }),
      },
      taskComment: { findMany: async () => h.comments },
      task: {
        findUnique: async () => ({
          title: "Monter la vidéo",
          projectId: "p1",
          ownerId: "johan",
          archivedAt: null,
          project: { archivedAt: null },
          contributors: [],
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const pending: Record<string, unknown>[] = [];
        const tx = {
          message: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              pending.push(data);
              h.created.push(data);
              return { id: `msg-${h.created.length}` };
            },
          },
          taskComment: {
            updateMany: async ({ where }: { where: { id: string } }) => ({
              count: h.takenElsewhere.has(where.id) ? 0 : 1,
            }),
          },
        };
        const result = await fn(tx);
        h.committed.push(...pending);
        return result;
      },
    };
    return db;
  },
}));

vi.mock("@/features/events/emit", () => ({
  emitEvent: async (event: Record<string, unknown>) => {
    h.emitted.push(event);
  },
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: async (entry: Record<string, unknown>) => {
    h.audits.push(entry);
  },
}));

vi.mock("@/features/discussions/channels", () => ({
  accessChannel: async () => null,
  channelSelect: {},
  ensureProjectChannel: async () => ({ id: "salon", slug: "projet" }),
}));
vi.mock("@/features/discussions/queries", () => ({
  linkedTasks: async () => new Map(),
  messageInclude: () => ({}),
}));
vi.mock("@/features/discussions/service", () => ({
  checkAttachment: () => null,
  checkBody: () => null,
  postMessage: async () => ({ ok: false, error: "non utilisé" }),
}));

const { announceSubjectComment } = await import("@/features/discussions/subject-notify");

const taskContext = {
  subject: { type: "task" as const, id: "t1" },
  title: "Monter la vidéo",
  projectId: "p1",
  projectArchived: false,
  archived: false,
  ownerId: "johan",
  contributorIds: ["pierre"],
};

beforeEach(() => {
  h.emitted = [];
  h.previousAuthors = [];
  h.comments = [];
  h.takenElsewhere = new Set();
  h.created = [];
  h.committed = [];
  h.audits = [];
});

describe("annonce d'un commentaire", () => {
  it("prévient responsable, contributeurs et anciens commentateurs, sauf auteur et mentionnés", async () => {
    h.previousAuthors = [{ authorId: "zoe" }, { authorId: "charles" }];
    await announceSubjectComment(
      { id: "charles", name: "Charles" },
      taskContext,
      { id: "m1", parentId: "racine", body: "Voir **la V2** @Pierre" },
      ["pierre"],
    );
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      kind: "commentaire",
      actorId: "charles",
      title: "Charles a commenté la tâche « Monter la vidéo »",
      body: "Voir la V2 @Pierre",
      href: "/taches/t1#discussion",
      projectId: "p1",
      taskId: "t1",
      recipients: ["johan", "zoe"],
      dedupeKey: "commentaire:m1",
      channelPost: false,
    });
  });

  it("livrable : lien vers sa page, pas de tâche liée ; personne à prévenir = aucun événement", async () => {
    await announceSubjectComment(
      { id: "pierre", name: "Pierre" },
      { ...taskContext, subject: { type: "deliverable", id: "d1" }, ownerId: "johan", contributorIds: [] },
      { id: "m2", parentId: "racine", body: "" },
      [],
    );
    expect(h.emitted[0]).toMatchObject({
      href: "/livrables/d1#discussion",
      taskId: null,
      body: "Lien joint",
      recipients: ["johan"],
    });

    h.emitted = [];
    await announceSubjectComment(
      { id: "johan", name: "Johan" },
      { ...taskContext, contributorIds: [] },
      { id: "m3", parentId: "racine", body: "Note pour moi" },
      [],
    );
    expect(h.emitted).toHaveLength(0);
  });
});

describe("reprise des anciens commentaires", () => {
  const legacy = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
    id,
    taskId: "t1",
    authorId: "charles",
    body: `Commentaire ${id}`,
    createdAt: new Date(createdAt),
    editedAt: null,
    deletedAt: null,
    movedToMessageId: null,
    ...extra,
  });

  it("recopie dans le fil de la tâche et ne compte que les commentaires réservés", async () => {
    const { moveLegacyTaskComments } = await import("@/features/discussions/subjects");
    h.comments = [
      legacy("c1", "2026-10-01T10:00:00Z"),
      legacy("c2", "2026-10-02T10:00:00Z", { deletedAt: new Date("2026-10-03T10:00:00Z") }),
      legacy("c3", "2026-10-04T10:00:00Z"),
    ];
    h.takenElsewhere = new Set(["c3"]);
    const result = await moveLegacyTaskComments({ taskId: "t1", limit: 50 });
    expect(result).toEqual({ moved: 2 });
    // La copie de c3 est annulée avec sa transaction (déjà reprise par une autre passe).
    expect(h.committed.map((m) => m.body)).toEqual(["Commentaire c1", "Commentaire c2"]);
    expect(h.committed[0]).toMatchObject({ parentId: "racine", channelId: "salon", aboutTaskId: "t1" });
    expect(h.committed[1].deletedAt).toEqual(new Date("2026-10-03T10:00:00Z"));
    expect(h.audits).toEqual([
      expect.objectContaining({ action: "task.comments_moved", targetId: "t1", after: { count: 2 } }),
    ]);
  });

  it("rien à reprendre : aucune écriture", async () => {
    const { moveLegacyTaskComments } = await import("@/features/discussions/subjects");
    h.comments = [legacy("c1", "2026-10-01T10:00:00Z", { movedToMessageId: "m1" })];
    expect(await moveLegacyTaskComments({ limit: 50 })).toEqual({ moved: 0 });
    expect(h.created).toHaveLength(0);
    expect(h.audits).toHaveLength(0);
  });
});
