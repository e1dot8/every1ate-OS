import { describe, expect, it } from "vitest";
import {
  checkHandoffAnswer,
  checkHandoffProposal,
  handoffOwners,
  isUniqueViolation,
} from "@/features/qg/handoff-rules";
import {
  choiceFor,
  effectivePresence,
  endOfParisDay,
  presenceFromChoice,
  presenceText,
} from "@/features/presence/rules";

const base = { actorId: "johan", ownerId: "johan", toId: "pierre", open: true, note: null };

describe("proposer une passation", () => {
  it("DONNER : seul le responsable actuel passe la main, à un autre associé", () => {
    expect(checkHandoffProposal({ ...base, mode: "DONNER" })).toEqual({
      ok: true,
      data: { fromId: "johan", toId: "pierre" },
    });
    expect(checkHandoffProposal({ ...base, mode: "DONNER", ownerId: "charles" }).ok).toBe(false);
    expect(checkHandoffProposal({ ...base, mode: "DONNER", toId: null }).ok).toBe(false);
    expect(checkHandoffProposal({ ...base, mode: "DONNER", toId: "johan" }).ok).toBe(false);
  });

  it("REPRENDRE : on demande au responsable actuel de céder", () => {
    expect(
      checkHandoffProposal({ ...base, mode: "REPRENDRE", actorId: "pierre", ownerId: "johan", toId: null }),
    ).toEqual({ ok: true, data: { fromId: "pierre", toId: "johan" } });
    expect(checkHandoffProposal({ ...base, mode: "REPRENDRE" }).ok).toBe(false); // déjà à moi
    expect(checkHandoffProposal({ ...base, mode: "REPRENDRE", actorId: "pierre", ownerId: null }).ok).toBe(
      false,
    );
  });

  it("refuse un élément terminé ou une note trop longue", () => {
    expect(checkHandoffProposal({ ...base, mode: "DONNER", open: false }).ok).toBe(false);
    expect(checkHandoffProposal({ ...base, mode: "DONNER", note: "x".repeat(1001) }).ok).toBe(false);
  });
});

describe("répondre à une passation", () => {
  const pending = { status: "EN_ATTENTE" as const, fromId: "johan", toId: "pierre", isOpportunity: false };

  it("l'objet va à « to » (DONNER) ou à « from » (REPRENDRE)", () => {
    expect(handoffOwners({ mode: "DONNER", fromId: "johan", toId: "pierre" })).toEqual({
      expectedOwnerId: "johan",
      newOwnerId: "pierre",
    });
    expect(handoffOwners({ mode: "REPRENDRE", fromId: "pierre", toId: "johan" })).toEqual({
      expectedOwnerId: "johan",
      newOwnerId: "pierre",
    });
  });

  it("seul le destinataire accepte ou refuse, seul l'auteur annule", () => {
    expect(checkHandoffAnswer(pending, "pierre", { kind: "accepter" }).ok).toBe(true);
    expect(checkHandoffAnswer(pending, "johan", { kind: "accepter" }).ok).toBe(false);
    expect(checkHandoffAnswer(pending, "johan", { kind: "annuler" }).ok).toBe(true);
    expect(checkHandoffAnswer(pending, "pierre", { kind: "annuler" }).ok).toBe(false);
  });

  it("refuser exige une réponse", () => {
    expect(checkHandoffAnswer(pending, "pierre", { kind: "refuser", answer: " " }).ok).toBe(false);
    expect(checkHandoffAnswer(pending, "pierre", { kind: "refuser", answer: "Trop chargé" }).ok).toBe(true);
  });

  it("un client n'est accepté qu'avec une prochaine action datée", () => {
    const opp = { ...pending, isOpportunity: true };
    expect(checkHandoffAnswer(opp, "pierre", { kind: "accepter" }).ok).toBe(false);
    expect(
      checkHandoffAnswer(opp, "pierre", { kind: "accepter", nextAction: "Appeler", nextActionDate: null }).ok,
    ).toBe(false);
    expect(
      checkHandoffAnswer(opp, "pierre", {
        kind: "accepter",
        nextAction: "Appeler",
        nextActionDate: new Date("2026-11-10"),
      }).ok,
    ).toBe(true);
  });

  it("une passation déjà traitée ne se traite pas deux fois", () => {
    expect(checkHandoffAnswer({ ...pending, status: "ACCEPTEE" }, "pierre", { kind: "accepter" }).ok).toBe(
      false,
    );
  });

  it("reconnaît l'erreur d'unicité (une seule passation en attente)", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

describe("présence choisie", () => {
  const now = new Date("2026-11-04T10:00:00Z"); // 11 h à Paris

  it("focus et réunion expirent seuls", () => {
    expect(presenceFromChoice("FOCUS_25", now)).toEqual({
      state: "FOCUS",
      until: new Date("2026-11-04T10:25:00Z"),
    });
    expect(presenceFromChoice("REUNION_60", now).until).toEqual(new Date("2026-11-04T11:00:00Z"));
    expect(presenceFromChoice("DISPO", now)).toEqual({ state: "DISPO", until: null });
  });

  it("absent jusqu'à minuit, heure de Paris", () => {
    expect(endOfParisDay(now).toISOString()).toBe("2026-11-04T23:00:00.000Z");
    expect(endOfParisDay(new Date("2026-07-01T21:30:00Z")).toISOString()).toBe("2026-07-01T22:00:00.000Z");
  });

  it("libellés et choix du menu", () => {
    const focus = presenceFromChoice("FOCUS_50", now);
    expect(presenceText(focus)).toBe("En focus · jusqu'à 11:50");
    expect(choiceFor(focus, now)).toBe("FOCUS_50");
    expect(presenceText({ state: "DISPO", until: null })).toBe("Disponible");
  });

  it("un statut non partagé reste « Disponible » pour les autres", () => {
    const p = { ...presenceFromChoice("FOCUS_90", now), note: "Montage", shared: false };
    expect(effectivePresence(p, now).state).toBe("DISPO");
    expect(effectivePresence(p, now, true).state).toBe("FOCUS");
  });
});
