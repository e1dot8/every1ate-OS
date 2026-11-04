import { beforeEach, describe, expect, it, vi } from "vitest";

/** Base, événements, accès et publication simulés : aucune base réelle. */
const h = vi.hoisted(() => ({
  reminders: [] as Record<string, unknown>[],
  scheduled: [] as Record<string, unknown>[],
  claimed: [] as string[],
  emitted: [] as Record<string, unknown>[],
  published: [] as unknown[][],
  /** « salon:associé » ayant accès. */
  access: new Set<string>(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    reminder: {
      findMany: async () => h.reminders,
      updateMany: async ({ where }: { where: { id: string } }) => {
        h.claimed.push(where.id);
        return { count: 1 };
      },
    },
    scheduledMessage: {
      findMany: async () => h.scheduled,
      updateMany: async () => ({ count: 1 }),
      update: async () => ({}),
    },
    message: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
  }),
}));

vi.mock("@/features/events/emit", () => ({
  emitEvent: async (event: Record<string, unknown>) => {
    h.emitted.push(event);
  },
}));

vi.mock("@/features/discussions/channels", () => ({
  accessChannel: async ({ id }: { id: string }, userId: string) =>
    h.access.has(`${id}:${userId}`)
      ? { channel: { id, slug: id, kind: "PUBLIC", archivedAt: null }, member: { id: "m" } }
      : null,
}));

vi.mock("@/features/discussions/service", () => ({
  publishMessage: async (...args: unknown[]) => {
    h.published.push(args);
    return { id: "publie", ambiguous: [] };
  },
}));

const { processDueDiscussions } = await import("@/features/discussions/scan");

/** Début de la passe, volontairement ancien : la publication doit utiliser l'heure réelle. */
const PASS_START = new Date("2026-11-04T13:30:00Z");

function reminder(id: string, message: Record<string, unknown> | null) {
  return { id, userId: "u1", text: `Texte ${id}`, message };
}
const onMessage = (extra: Record<string, unknown> = {}) => ({
  id: "msg1",
  parentId: null,
  channelId: "general",
  deletedAt: null,
  channel: { slug: "general" },
  ...extra,
});

beforeEach(() => {
  h.reminders = [];
  h.scheduled = [];
  h.claimed = [];
  h.emitted = [];
  h.published = [];
  h.access = new Set(["general:u1"]);
});

describe("rappels échus", () => {
  it("arrivent même pendant un focus (urgent) au seul propriétaire", async () => {
    h.reminders = [reminder("r1", onMessage()), reminder("r2", null)];
    const result = await processDueDiscussions(PASS_START);
    expect(result.reminders).toBe(2);
    expect(h.emitted).toEqual([
      expect.objectContaining({
        kind: "rappel",
        recipients: ["u1"],
        urgent: true,
        href: "/discussions/general/fil/msg1#m-msg1",
      }),
      expect.objectContaining({ kind: "rappel", urgent: true, href: "/discussions/activite#rappels" }),
    ]);
  });

  it("message supprimé ou salon devenu inaccessible : clos sans envoi", async () => {
    h.reminders = [
      reminder("supprime", onMessage({ deletedAt: new Date("2026-11-04T10:00:00Z") })),
      reminder("prive", onMessage({ channelId: "direction" })),
    ];
    const result = await processDueDiscussions(PASS_START);
    expect(h.claimed).toEqual(["supprime", "prive"]); // sentAt posé : plus jamais repris
    expect(h.emitted).toEqual([]);
    expect(result.reminders).toBe(0);
  });
});

describe("messages programmés échus", () => {
  it("publiés à l'heure réelle, sans marquer le salon comme lu pour l'auteur", async () => {
    h.scheduled = [
      {
        id: "s1",
        channelId: "general",
        parentId: null,
        body: "Bonjour",
        author: { id: "u1", name: "Pierre", role: "associe" },
      },
    ];
    const before = Date.now();
    const result = await processDueDiscussions(PASS_START);
    expect(result.scheduled).toBe(1);
    const [author, , input, at] = h.published[0] as [unknown, unknown, Record<string, unknown>, Date];
    expect(author).toMatchObject({ id: "u1" });
    expect(input).toEqual({ body: "Bonjour", parentId: null, markRead: false });
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
  });
});
