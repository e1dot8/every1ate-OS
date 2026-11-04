import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalPayload } from "@/features/notifications/channels";

/** Base, configuration, transports et coffre simulés : aucun appel réseau ni base réelle. */
const h = vi.hoisted(() => ({
  users: [] as Record<string, unknown>[],
  recentWhatsapp: [] as { userId: string; createdAt: Date }[],
  created: [] as Record<string, unknown>[],
  deleted: [] as string[],
  touched: [] as string[],
  failUsers: false,
  env: {} as Record<string, unknown>,
  sendWebPush: vi.fn(),
  sendCallMeBot: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        if (h.failUsers) throw new Error("base indisponible");
        return h.users.filter((u) => where.id.in.includes(u.id as string));
      },
    },
    externalDelivery: {
      findMany: async () => h.recentWhatsapp,
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        h.created.push(...data);
        return { count: data.length };
      },
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        h.deleted.push(...where.id.in);
        return { count: where.id.in.length };
      },
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        h.touched.push(...where.id.in);
        return { count: where.id.in.length };
      },
    },
  }),
}));

vi.mock("@/lib/env", () => ({ getServerEnv: () => h.env }));

vi.mock("@/lib/crypto/app-secrets", () => ({
  openAppSecret: (sealed: string) => {
    if (sealed === "illisible") throw new Error("altéré");
    return `clair-${sealed}`;
  },
}));

vi.mock("@/features/notifications/transports", () => ({
  sendWebPush: h.sendWebPush,
  sendCallMeBot: h.sendCallMeBot,
}));

const { deliverExternal } = await import("@/features/notifications/channels");

const NOW = Date.now();

function user(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    presenceState: "DISPO",
    presenceUntil: null,
    presenceNote: null,
    presenceShared: true,
    whatsappPhone: null,
    whatsappKey: null,
    notifyPrefs: null,
    pushSubscriptions: [
      { id: `sub-${id}`, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "p", auth: "a" },
    ],
    ...extra,
  };
}

const withWhatsapp = {
  whatsappPhone: "+33612345678",
  whatsappKey: "scelle",
  notifyPrefs: { "livrable.livre": { whatsapp: true } },
};
const delivered: ExternalPayload = {
  kind: "livrable.livre",
  title: "Livrable livré",
  body: "Clip v2",
  href: "/livrables/1",
};
const statuses = () => h.created.map((row) => `${row.userId}:${row.channel}:${row.status}`).sort();

beforeEach(() => {
  h.users = [];
  h.recentWhatsapp = [];
  h.created = [];
  h.deleted = [];
  h.touched = [];
  h.failUsers = false;
  h.env = {
    appUrl: "https://os.example.test",
    pushTransport: "webpush",
    whatsappTransport: "callmebot",
    VAPID_PUBLIC_KEY: "pub",
    VAPID_PRIVATE_KEY: "priv",
    vapidSubject: "mailto:test@example.test",
  };
  h.sendWebPush.mockReset().mockResolvedValue({ ok: true });
  h.sendCallMeBot.mockReset().mockResolvedValue({ ok: true });
});

describe("deliverExternal", () => {
  it("envoie push et WhatsApp selon les préférences, et journalise chaque envoi", async () => {
    h.users = [user("u1", withWhatsapp), user("u2")];
    await deliverExternal(["u1", "u2"], delivered);
    expect(statuses()).toEqual(["u1:push:envoye", "u1:whatsapp:envoye", "u2:push:envoye"]);
    expect(h.sendWebPush).toHaveBeenCalledTimes(2);
    const [, target, message] = h.sendWebPush.mock.calls[0];
    expect(target).toMatchObject({ endpoint: expect.stringContaining("fcm.googleapis.com") });
    expect(message).toEqual({
      title: "Livrable livré",
      body: "Clip v2",
      href: "/livrables/1",
      tag: "livrable.livre:/livrables/1",
    });
    expect(h.sendCallMeBot).toHaveBeenCalledWith({
      phone: "+33612345678",
      apikey: "clair-scelle",
      text: "Livrable livré\nClip v2\nhttps://os.example.test/livrables/1",
    });
    expect(h.touched.sort()).toEqual(["sub-u1", "sub-u2"]);
    expect(
      h.created.every((row) => row.eventKind === "livrable.livre" && row.title === "Livrable livré"),
    ).toBe(true);
  });

  it("n'envoie rien hors de l'app pour un événement désactivé (point de checklist coché par défaut)", async () => {
    h.users = [user("u1", withWhatsapp)];
    await deliverExternal(["u1"], { ...delivered, kind: "livrable.coche" });
    expect(h.sendWebPush).not.toHaveBeenCalled();
    expect(h.sendCallMeBot).not.toHaveBeenCalled();
    expect(h.created).toEqual([]);
  });

  it("en focus ou absent : rien n'est envoyé (journalisé « ignore_focus »), sauf urgence", async () => {
    const until = new Date(NOW + 3_600_000);
    h.users = [
      user("u1", { ...withWhatsapp, presenceState: "FOCUS", presenceUntil: until }),
      user("u2", { presenceState: "ABSENT" }),
    ];
    await deliverExternal(["u1", "u2"], delivered);
    expect(statuses()).toEqual(["u1:push:ignore_focus", "u1:whatsapp:ignore_focus", "u2:push:ignore_focus"]);
    expect(h.sendWebPush).not.toHaveBeenCalled();

    h.created = [];
    await deliverExternal(["u1", "u2"], { ...delivered, urgent: true });
    expect(statuses()).toEqual(["u1:push:envoye", "u1:whatsapp:envoye", "u2:push:envoye"]);
  });

  it("un focus expiré ou une réunion n'empêchent pas l'envoi", async () => {
    h.users = [
      user("u1", { presenceState: "FOCUS", presenceUntil: new Date(NOW - 60_000) }),
      user("u2", { presenceState: "REUNION" }),
    ];
    await deliverExternal(["u1", "u2"], delivered);
    expect(statuses()).toEqual(["u1:push:envoye", "u2:push:envoye"]);
  });

  it("transport « outbox » : aucun appel réseau, statut « outbox »", async () => {
    h.env = { ...h.env, pushTransport: "outbox", whatsappTransport: "outbox" };
    h.users = [user("u1", withWhatsapp)];
    await deliverExternal(["u1"], delivered);
    expect(statuses()).toEqual(["u1:push:outbox", "u1:whatsapp:outbox"]);
    expect(h.sendWebPush).not.toHaveBeenCalled();
    expect(h.sendCallMeBot).not.toHaveBeenCalled();
  });

  it("push non configuré (aucune clé VAPID) : le canal est ignoré", async () => {
    h.env = { ...h.env, pushTransport: "off" };
    h.users = [user("u1")];
    await deliverExternal(["u1"], delivered);
    expect(h.created).toEqual([]);
  });

  it("supprime un abonnement expiré (404/410) et journalise l'échec", async () => {
    h.users = [user("u1")];
    h.sendWebPush.mockResolvedValue({ ok: false, gone: true, error: "Abonnement expiré : appareil retiré." });
    await deliverExternal(["u1"], delivered);
    expect(h.deleted).toEqual(["sub-u1"]);
    expect(h.created).toEqual([
      expect.objectContaining({ status: "echec", error: "Abonnement expiré : appareil retiré." }),
    ]);
    expect(h.touched).toEqual([]);
  });

  it("limite WhatsApp : au-delà de 20 envois réussis dans l'heure, statut « limite »", async () => {
    h.users = [user("u1", { ...withWhatsapp, pushSubscriptions: [] })];
    h.recentWhatsapp = Array.from({ length: 20 }, (_, i) => ({
      userId: "u1",
      createdAt: new Date(NOW - (i + 1) * 60_000),
    }));
    await deliverExternal(["u1"], delivered);
    expect(statuses()).toEqual(["u1:whatsapp:limite"]);
    expect(h.sendCallMeBot).not.toHaveBeenCalled();
  });

  it("clé WhatsApp illisible (clé du serveur changée) : échec explicite, sans envoi", async () => {
    h.users = [user("u1", { ...withWhatsapp, whatsappKey: "illisible", pushSubscriptions: [] })];
    await deliverExternal(["u1"], delivered);
    expect(h.created).toEqual([
      expect.objectContaining({
        channel: "whatsapp",
        status: "echec",
        error: expect.stringContaining("illisible"),
      }),
    ]);
    expect(h.sendCallMeBot).not.toHaveBeenCalled();
  });

  it("ne lève jamais, même si la base ou un transport échoue", async () => {
    h.users = [user("u1")];
    h.sendWebPush.mockRejectedValue(new Error("inattendu"));
    await expect(deliverExternal(["u1"], delivered)).resolves.toBeUndefined();
    expect(statuses()).toEqual(["u1:push:echec"]);

    h.failUsers = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(deliverExternal(["u1"], delivered)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("aucun destinataire : aucune requête", async () => {
    h.failUsers = true;
    await expect(deliverExternal([], delivered)).resolves.toBeUndefined();
    expect(h.created).toEqual([]);
  });
});
