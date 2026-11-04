import { describe, expect, it } from "vitest";
import { journalLabel } from "@/features/projects/journal-labels";
import {
  aboutFields,
  byLastActivity,
  commentEventTitle,
  commentRecipients,
  isSubjectType,
  lastActivity,
  legacyCommentsByTask,
  legacyReplyData,
  legacyRootDate,
  repliesLabel,
  subjectHref,
  subjectMessageHref,
  subjectOf,
  subjectPath,
  subjectReadOnlyReason,
  subjectRootBody,
  type LegacyComment,
} from "@/features/discussions/subject-rules";

const at = (iso: string) => new Date(iso);

describe("discussions par élément : liens et racine", () => {
  it("page, section Discussion et commentaire précis de l'élément", () => {
    expect(subjectPath({ type: "task", id: "t1" })).toBe("/taches/t1");
    expect(subjectPath({ type: "deliverable", id: "d1" })).toBe("/livrables/d1");
    expect(subjectHref({ type: "task", id: "t1" })).toBe("/taches/t1#discussion");
    expect(subjectMessageHref({ type: "deliverable", id: "d1" }, "m9")).toBe("/livrables/d1#m-m9");
  });

  it("texte de la racine : « Discussion · Tâche « Titre » », espaces normalisés", () => {
    expect(subjectRootBody("task", "  Monter   la vidéo ")).toBe("Discussion · Tâche « Monter la vidéo »");
    expect(subjectRootBody("deliverable", "Reel été")).toBe("Discussion · Livrable « Reel été »");
    expect(subjectRootBody("task", "   ")).toBe("Discussion · Tâche « Sans titre »");
  });

  it("un message porte au plus un élément", () => {
    expect(aboutFields({ type: "task", id: "t1" })).toEqual({ aboutTaskId: "t1" });
    expect(aboutFields({ type: "deliverable", id: "d1" })).toEqual({ aboutDeliverableId: "d1" });
    expect(subjectOf({ aboutTaskId: "t1", aboutDeliverableId: null })).toEqual({ type: "task", id: "t1" });
    expect(subjectOf({ aboutTaskId: null, aboutDeliverableId: "d1" })).toEqual({
      type: "deliverable",
      id: "d1",
    });
    expect(subjectOf({ aboutTaskId: null, aboutDeliverableId: null })).toBeNull();
    expect(isSubjectType("task")).toBe(true);
    expect(isSubjectType("projet")).toBe(false);
  });
});

describe("événement « commentaire » : destinataires", () => {
  it("responsable, contributeurs et personnes ayant déjà commenté, sans l'auteur", () => {
    expect(
      commentRecipients({
        authorId: "charles",
        ownerId: "johan",
        contributorIds: ["pierre", "charles"],
        previousAuthorIds: ["zoe", "johan", null],
        mentionedIds: [],
      }),
    ).toEqual(["johan", "pierre", "zoe"]);
  });

  it("les mentionnés sont déjà prévenus par la mention : pas de second envoi", () => {
    expect(
      commentRecipients({
        authorId: "charles",
        ownerId: "johan",
        contributorIds: ["pierre"],
        previousAuthorIds: ["pierre"],
        mentionedIds: ["johan"],
      }),
    ).toEqual(["pierre"]);
  });

  it("sans responsable ni commentaire précédent : personne (l'auteur ne se notifie jamais)", () => {
    expect(
      commentRecipients({ authorId: "a", ownerId: null, previousAuthorIds: ["a"], mentionedIds: [] }),
    ).toEqual([]);
    expect(
      commentRecipients({ authorId: "a", ownerId: "a", previousAuthorIds: [], mentionedIds: [] }),
    ).toEqual([]);
  });

  it("titre de la notification selon l'élément", () => {
    expect(commentEventTitle("Charles", "task", "Monter la vidéo")).toBe(
      "Charles a commenté la tâche « Monter la vidéo »",
    );
    expect(commentEventTitle("Pierre", "deliverable", "Reel été")).toBe(
      "Pierre a commenté le livrable « Reel été »",
    );
  });
});

describe("lecture seule", () => {
  it("projet archivé, puis élément archivé, puis salon archivé", () => {
    const base = { type: "task" as const, projectArchived: false, elementArchived: false };
    expect(subjectReadOnlyReason(base)).toBeNull();
    expect(subjectReadOnlyReason({ ...base, projectArchived: true, elementArchived: true })).toBe(
      "Projet archivé : la discussion est en lecture seule.",
    );
    expect(subjectReadOnlyReason({ ...base, elementArchived: true })).toBe(
      "Tâche archivée : la discussion est en lecture seule.",
    );
    expect(subjectReadOnlyReason({ ...base, type: "deliverable", elementArchived: true })).toBe(
      "Livrable archivé : la discussion est en lecture seule.",
    );
    expect(subjectReadOnlyReason({ ...base, channelArchived: true })).toBe(
      "Salon du projet archivé : la discussion est en lecture seule.",
    );
  });
});

describe("fils par élément", () => {
  it("dernière activité : dernière réponse, sinon création du fil", () => {
    const root = at("2026-11-02T09:00:00Z");
    expect(lastActivity(root, null)).toEqual(root);
    expect(lastActivity(root, at("2026-11-03T10:00:00Z"))).toEqual(at("2026-11-03T10:00:00Z"));
  });

  it("triés du plus récemment actif au plus ancien, ordre stable à égalité", () => {
    const sorted = byLastActivity([
      { id: "a", lastActivityAt: at("2026-11-01T10:00:00Z") },
      { id: "b", lastActivityAt: at("2026-11-04T10:00:00Z") },
      { id: "c", lastActivityAt: at("2026-11-01T10:00:00Z") },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("libellé du nombre de réponses", () => {
    expect(repliesLabel(0)).toBe("Aucune réponse");
    expect(repliesLabel(1)).toBe("1 réponse");
    expect(repliesLabel(3)).toBe("3 réponses");
  });
});

describe("reprise des anciens commentaires de tâche", () => {
  const comment = (over: Partial<LegacyComment>): LegacyComment => ({
    id: "c",
    taskId: "t1",
    authorId: "u1",
    body: "Texte",
    createdAt: at("2026-10-01T10:00:00Z"),
    editedAt: null,
    deletedAt: null,
    movedToMessageId: null,
    ...over,
  });

  it("idempotente : un commentaire déjà repris n'est jamais recopié", () => {
    const groups = legacyCommentsByTask([
      comment({ id: "c1", movedToMessageId: "m1" }),
      comment({ id: "c2" }),
    ]);
    expect([...groups.keys()]).toEqual(["t1"]);
    expect(groups.get("t1")!.map((c) => c.id)).toEqual(["c2"]);
    expect(legacyCommentsByTask([comment({ id: "c1", movedToMessageId: "m1" })]).size).toBe(0);
  });

  it("regroupés par tâche, dans l'ordre chronologique", () => {
    const groups = legacyCommentsByTask([
      comment({ id: "b", taskId: "t2", createdAt: at("2026-10-03T10:00:00Z") }),
      comment({ id: "a", taskId: "t1", createdAt: at("2026-10-02T10:00:00Z") }),
      comment({ id: "z", taskId: "t1", createdAt: at("2026-10-01T10:00:00Z") }),
    ]);
    expect([...groups.keys()]).toEqual(["t1", "t2"]);
    expect(groups.get("t1")!.map((c) => c.id)).toEqual(["z", "a"]);
  });

  it("la racine prend la date du plus ancien commentaire (jamais affichée comme nouvelle)", () => {
    const now = at("2026-11-04T10:00:00Z");
    expect(
      legacyRootDate(
        [{ createdAt: at("2026-10-05T08:00:00Z") }, { createdAt: at("2026-10-02T08:00:00Z") }],
        now,
      ),
    ).toEqual(at("2026-10-02T08:00:00Z"));
    expect(legacyRootDate([], now)).toEqual(now);
  });

  it("auteur, texte et dates conservés ; réponse du fil de la tâche, sans mention", () => {
    const data = legacyReplyData(
      comment({
        id: "c1",
        editedAt: at("2026-10-01T11:00:00Z"),
        deletedAt: at("2026-10-02T09:00:00Z"),
      }),
      { id: "racine", channelId: "salon" },
    );
    expect(data).toEqual({
      channelId: "salon",
      parentId: "racine",
      authorId: "u1",
      body: "Texte",
      mentionIds: [],
      alsoInChannel: false,
      aboutTaskId: "t1",
      createdAt: at("2026-10-01T10:00:00Z"),
      editedAt: at("2026-10-01T11:00:00Z"),
      deletedAt: at("2026-10-02T09:00:00Z"),
    });
  });
});

describe("journal", () => {
  it("libellés lisibles des nouvelles actions", () => {
    expect(journalLabel("deliverable.commented")).toBe("a commenté un livrable");
    expect(journalLabel("task.commented")).toBe("a commenté une tâche");
    expect(journalLabel("task.comments_moved")).toBe(
      "a repris les anciens commentaires dans la discussion de la tâche",
    );
    expect(journalLabel("channel.message_deleted")).toBe("a supprimé un message");
  });
});
