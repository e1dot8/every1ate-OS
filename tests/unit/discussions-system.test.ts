import { beforeEach, describe, expect, it, vi } from "vitest";

/** Salons simulés : aucune base réelle. */
const h = vi.hoisted(() => ({
  projectChannel: null as { id: string; archivedAt: Date | null } | null,
  posted: [] as { channelId: string; text: string }[],
  generalAsked: 0,
}));

vi.mock("@/features/discussions/channels", () => ({
  ensureProjectChannel: async () => h.projectChannel,
  ensureGeneralChannel: async () => {
    h.generalAsked += 1;
    return { id: "general", archivedAt: null };
  },
  createSystemMessage: async (input: { channelId: string; text: string }) => {
    h.posted.push({ channelId: input.channelId, text: input.text });
    return "m1";
  },
}));

const { postSystemMessage } = await import("@/features/discussions/system");

beforeEach(() => {
  h.projectChannel = null;
  h.posted = [];
  h.generalAsked = 0;
});

describe("messages du QG dans les salons", () => {
  it("publie dans le salon du projet, ou la Salle commune sans projet", async () => {
    h.projectChannel = { id: "projet", archivedAt: null };
    await postSystemMessage({ projectId: "p1", text: "Livrable livré" });
    await postSystemMessage({ projectId: null, text: "Opportunité signée" });
    expect(h.posted.map((p) => p.channelId)).toEqual(["projet", "general"]);
  });

  it("salon du projet archivé : rien n'est publié, ni ailleurs", async () => {
    h.projectChannel = { id: "projet", archivedAt: new Date("2026-11-01T10:00:00Z") };
    await postSystemMessage({ projectId: "p1", text: "Livrable livré" });
    expect(h.posted).toEqual([]);
    expect(h.generalAsked).toBe(0);
  });
});
