/**
 * Passations (pur) : qui peut proposer, accepter, refuser ou annuler, et à qui va l'objet.
 * DONNER : le responsable actuel (« from ») confie l'objet à « to ».
 * REPRENDRE : « from » demande au responsable actuel (« to ») de le lui céder.
 * L'objet ne change de main qu'après acceptation par « to ».
 */
import { todayDate } from "@/lib/dates";

export type HandoffModeValue = "DONNER" | "REPRENDRE";
export type HandoffStatusValue = "EN_ATTENTE" | "ACCEPTEE" | "REFUSEE" | "ANNULEE";

export type Check<T = null> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Check<T> => ({ ok: true, data });
const fail = (error: string): Check<never> => ({ ok: false, error });

export const HANDOFF_NOTE_MAX = 1000;
export const HANDOFF_ANSWER_MIN = 2;
export const HANDOFF_ANSWER_MAX = 500;

/** Vérifie une proposition et renvoie le couple (from, to) à enregistrer. */
export function checkHandoffProposal(input: {
  mode: HandoffModeValue;
  actorId: string;
  /** Responsable actuel de la tâche ou de l'opportunité (null : sans responsable). */
  ownerId: string | null;
  /** Destinataire choisi (DONNER uniquement). */
  toId: string | null;
  /** L'objet peut encore changer de main (tâche ni terminée ni annulée, opportunité non archivée). */
  open: boolean;
  note: string | null;
}): Check<{ fromId: string; toId: string }> {
  if (!input.open) return fail("Cet élément est terminé : il ne peut plus changer de main.");
  if ((input.note?.length ?? 0) > HANDOFF_NOTE_MAX) return fail("Note trop longue (1 000 caractères).");
  if (input.mode === "DONNER") {
    if (input.ownerId !== input.actorId) return fail("Seul le responsable actuel peut passer la main.");
    if (!input.toId) return fail("Choisissez à qui passer la main.");
    if (input.toId === input.actorId) return fail("Choisissez un autre associé.");
    return ok({ fromId: input.actorId, toId: input.toId });
  }
  if (!input.ownerId) return fail("Sans responsable : prenez-la directement.");
  if (input.ownerId === input.actorId) return fail("Vous en êtes déjà responsable.");
  return ok({ fromId: input.actorId, toId: input.ownerId });
}

/** Responsable attendu au moment de l'acceptation, et nouveau responsable une fois acceptée. */
export function handoffOwners(h: { mode: HandoffModeValue; fromId: string; toId: string }) {
  return h.mode === "DONNER"
    ? { expectedOwnerId: h.fromId, newOwnerId: h.toId }
    : { expectedOwnerId: h.toId, newOwnerId: h.fromId };
}

export type HandoffAnswer =
  | { kind: "accepter"; nextAction?: string | null; nextActionDate?: Date | null }
  | { kind: "refuser"; answer: string | null }
  | { kind: "annuler" };

/**
 * Vérifie qu'un associé peut répondre à (ou annuler) une passation. Reprendre un client exige une
 * prochaine action datée d'aujourd'hui ou plus tard (`today` : jour de Paris, minuit UTC).
 */
export function checkHandoffAnswer(
  h: { status: HandoffStatusValue; fromId: string; toId: string; isOpportunity: boolean },
  actorId: string,
  answer: HandoffAnswer,
  today: Date = todayDate(),
): Check {
  if (h.status !== "EN_ATTENTE") return fail("Cette passation a déjà été traitée.");
  if (answer.kind === "annuler")
    return h.fromId === actorId ? ok(null) : fail("Seul l'auteur de la proposition peut l'annuler.");
  if (h.toId !== actorId) return fail("Cette passation ne vous est pas adressée.");
  if (answer.kind === "refuser") {
    const text = answer.answer?.trim() ?? "";
    if (text.length < HANDOFF_ANSWER_MIN) return fail("Indiquez pourquoi vous refusez.");
    if (text.length > HANDOFF_ANSWER_MAX) return fail("Réponse trop longue (500 caractères).");
    return ok(null);
  }
  if (!h.isOpportunity) return ok(null);
  if (!answer.nextAction?.trim() || !answer.nextActionDate)
    return fail("Pour reprendre un client, fixez la prochaine action et sa date.");
  if (answer.nextActionDate.getTime() < today.getTime())
    return fail("La date de la prochaine action est passée : choisissez aujourd'hui ou une date à venir.");
  return ok(null);
}

/** Erreur d'unicité Prisma (une seule passation en attente par objet). */
export const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && e.code === "P2002";

export const PENDING_HANDOFF_ERROR = "Une passation est déjà en attente pour cet élément.";
