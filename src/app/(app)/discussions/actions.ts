"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { zonedToUtc } from "@/features/calendar/rules";
import {
  ATTACHMENT_TITLE_MAX,
  CHANNEL_NAME_MAX,
  MESSAGE_MAX_LENGTH,
  REACTIONS,
  REMINDER_CHOICES,
  TOPIC_MAX,
  ambiguousMentionWarning,
  formatMomentFr,
  isCommand,
  nextMondayAt9,
  parseCommand,
  tomorrowAt9,
  type ComposerState,
} from "@/features/discussions/rules";
import {
  addChannelMember,
  cancelScheduled,
  convertMessageToTask,
  createChannel,
  createJitsiRoom,
  deleteMessage,
  deleteReminder,
  editMessage,
  partnerFocusEnd,
  postMessage,
  remindAboutMessage,
  removeChannelMember,
  runCommand,
  scheduleMessage,
  setChannelArchived,
  toggleReaction,
  togglePin,
  toggleSaved,
  updateChannel,
} from "@/features/discussions/service";

/**
 * Actions des discussions : session exigée, entrée validée (Zod), contrôle d'accès dans le
 * service (chaque salon et chaque message sont revérifiés), puis revalidation des pages.
 */

const id = z.string().trim().min(1).max(100);
const optionalId = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || null);
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
const refresh = () => revalidatePath("/discussions", "layout");
const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
};
const failure = (message: string, formData: FormData): FormState => ({
  status: "error",
  message,
  values: keptValues(formData),
});

// ─── Compositeur ────────────────────────────────────────────────────────────

const composerSchema = z.object({
  channelId: id,
  parentId: optionalId,
  body: z
    .string()
    .max(MESSAGE_MAX_LENGTH * 2, `Message trop long (${MESSAGE_MAX_LENGTH} caractères au plus).`)
    .transform((s) => s.trim()),
  alsoInChannel: checkbox,
  attachmentTitle: z.string().trim().max(ATTACHMENT_TITLE_MAX, "Titre du lien trop long.").optional(),
  attachmentUrl: z.string().trim().max(2000, "Lien trop long.").optional(),
  intent: z.enum(["envoyer", "programmer", "demain9", "lundi9", "finfocus"]).catch("envoyer"),
  sendAt: z.string().trim().max(20).optional(),
});

/** Envoyer, programmer ou exécuter une commande. Les réponses des commandes sont éphémères. */
export async function sendMessageAction(_prev: ComposerState, formData: FormData): Promise<ComposerState> {
  const user = await requireUser();
  const parsed = composerSchema.safeParse({
    channelId: field(formData, "channelId"),
    parentId: field(formData, "parentId"),
    body: field(formData, "body") ?? "",
    alsoInChannel: field(formData, "alsoInChannel"),
    attachmentTitle: field(formData, "attachmentTitle"),
    attachmentUrl: field(formData, "attachmentUrl"),
    intent: field(formData, "intent"),
    sendAt: field(formData, "sendAt"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);
  const input = parsed.data;
  const now = new Date();
  const attachmentUrl = input.attachmentUrl || null;

  if (input.intent === "envoyer" && isCommand(input.body)) {
    const command = parseCommand(input.body, now)!;
    const result = await runCommand(user, input.channelId, command, now);
    refresh();
    if (!result.ok) return { ...failure(result.error, formData), lines: undefined };
    return { status: "success", message: result.data.message, lines: result.data.lines };
  }

  if (input.intent !== "envoyer") {
    if (attachmentUrl)
      return failure("Les liens joints ne se programment pas : envoie-les tout de suite.", formData);
    let sendAt: Date | null = null;
    if (input.intent === "programmer") sendAt = input.sendAt ? zonedToUtc(input.sendAt) : null;
    else if (input.intent === "demain9") sendAt = tomorrowAt9(now);
    else if (input.intent === "lundi9") sendAt = nextMondayAt9(now);
    else sendAt = await partnerFocusEnd(input.channelId, user.id, now);
    if (!sendAt)
      return failure(
        input.intent === "finfocus"
          ? "Cette personne n'est plus en focus : envoie ton message."
          : "Indique la date et l'heure d'envoi.",
        formData,
      );
    const result = await scheduleMessage(
      user,
      { channelId: input.channelId, parentId: input.parentId, body: input.body, sendAt },
      now,
    );
    if (!result.ok) return failure(result.error, formData);
    refresh();
    return {
      status: "success",
      message: `Message programmé ${/^\d/.test(formatMomentFr(sendAt, now)) ? "à " : ""}${formatMomentFr(sendAt, now)}.`,
      lines: [{ text: "Voir les messages programmés", href: "/discussions/programmes" }],
    };
  }

  let attachment: { title: string; url: string } | null = null;
  if (attachmentUrl) {
    let host = "";
    try {
      host = new URL(attachmentUrl).hostname;
    } catch {
      return failure("Le lien joint doit commencer par https://.", formData);
    }
    attachment = { title: input.attachmentTitle || host, url: attachmentUrl };
  }
  const result = await postMessage(user, {
    channelId: input.channelId,
    parentId: input.parentId,
    body: input.body,
    alsoInChannel: input.alsoInChannel,
    attachment,
  });
  if (!result.ok) return failure(result.error, formData);
  refresh();
  // Prénom porté par plusieurs associés : le message est parti, l'auteur est averti (lui seul).
  const warning = ambiguousMentionWarning(result.data.ambiguous);
  return warning ? { status: "success", message: warning } : { status: "success" };
}

// ─── Actions sur un message ─────────────────────────────────────────────────

const RETURN_PATH = /^\/discussions\/[A-Za-z0-9-]+(\/fil\/[A-Za-z0-9]+)?$/;

const editSchema = z.object({
  messageId: id,
  body: z.string().max(MESSAGE_MAX_LENGTH * 2),
  retour: z.string().regex(RETURN_PATH).catch("/discussions"),
});

export async function editMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    messageId: field(formData, "messageId"),
    body: field(formData, "body") ?? "",
    retour: field(formData, "retour"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await editMessage(user, parsed.data.messageId, parsed.data.body);
  if (!result.ok) return failure(result.error, formData);
  refresh();
  // Prénom ambigu : la modification est enregistrée ; le formulaire reste ouvert avec l'avertissement
  // (visible par l'auteur seul) pour qu'il puisse écrire le nom complet.
  const warning = ambiguousMentionWarning(result.data.ambiguous);
  if (warning)
    return {
      status: "success",
      message: `Modification enregistrée. ${warning}`,
      values: { body: parsed.data.body.trim() },
    };
  redirect(`${parsed.data.retour}#m-${parsed.data.messageId}`);
}

const menuSchema = z.object({
  messageId: id,
  intent: z.union([
    z.enum(["pin", "save", "delete"]),
    z.enum(REACTIONS.map((r) => `react:${r}`) as [string, ...string[]]),
    z.enum(REMINDER_CHOICES.map((c) => `remind:${c.value}`) as [string, ...string[]]),
  ]),
});

/** Menu d'un message : réagir, épingler, Plus tard, me rappeler, supprimer (son propre message). */
export async function messageMenuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = menuSchema.safeParse({
    messageId: field(formData, "messageId"),
    intent: field(formData, "intent"),
  });
  if (!parsed.success) return { status: "error", message: "Action inconnue." };
  const { messageId, intent } = parsed.data;
  const now = new Date();
  let message: string;
  if (intent.startsWith("react:")) {
    const result = await toggleReaction(user, messageId, intent.slice("react:".length));
    if (!result.ok) return { status: "error", message: result.error };
    message = "Réaction mise à jour.";
  } else if (intent.startsWith("remind:")) {
    const choice = REMINDER_CHOICES.find((c) => `remind:${c.value}` === intent)!.value;
    const result = await remindAboutMessage(user, messageId, choice, now);
    if (!result.ok) return { status: "error", message: result.error };
    const when = formatMomentFr(result.data.remindAt, now);
    message = `Rappel programmé ${/^\d/.test(when) ? `à ${when}` : when}.`;
  } else if (intent === "pin") {
    const result = await togglePin(user, messageId);
    if (!result.ok) return { status: "error", message: result.error };
    message = result.data.pinned ? "Message épinglé." : "Message désépinglé.";
  } else if (intent === "save") {
    const result = await toggleSaved(user, messageId);
    if (!result.ok) return { status: "error", message: result.error };
    message = result.data.saved ? "Ajouté à Plus tard." : "Retiré de Plus tard.";
  } else {
    const result = await deleteMessage(user, messageId);
    if (!result.ok) return { status: "error", message: result.error };
    message = "Message supprimé.";
  }
  refresh();
  return { status: "success", message };
}

const reactionSchema = z.object({ messageId: id, emoji: z.enum(REACTIONS) });

/** Pastille de réaction sous un message : ajoute ou retire sa réaction. */
export async function toggleReactionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = reactionSchema.safeParse({
    messageId: field(formData, "messageId"),
    emoji: field(formData, "emoji"),
  });
  if (!parsed.success) return;
  const result = await toggleReaction(user, parsed.data.messageId, parsed.data.emoji);
  if (result.ok) refresh();
}

/** « Retirer » depuis la page Plus tard. */
export async function unsaveMessageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = id.safeParse(field(formData, "messageId"));
  if (!parsed.success) return;
  const result = await toggleSaved(user, parsed.data);
  // Déjà retiré (double clic) : on le remet pas.
  if (result.ok && result.data.saved) await toggleSaved(user, parsed.data);
  refresh();
}

export async function cancelScheduledAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = id.safeParse(field(formData, "scheduledId"));
  if (!parsed.success) return;
  await cancelScheduled(user, parsed.data);
  refresh();
}

export async function deleteReminderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = id.safeParse(field(formData, "reminderId"));
  if (!parsed.success) return;
  await deleteReminder(user, parsed.data);
  refresh();
}

// ─── Transformer en tâche ───────────────────────────────────────────────────

const taskSchema = z.object({
  messageId: id,
  title: z.string().trim().min(1, "Titre requis.").max(300, "Titre trop long (300 caractères)."),
  projectId: z.string().trim().min(1, "Choisis un projet.").max(100),
  ownerId: optionalId,
  dueDate: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = parseDateInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
      return d;
    }),
});

export async function convertToTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse({
    messageId: field(formData, "messageId"),
    title: field(formData, "title") ?? "",
    projectId: field(formData, "projectId") ?? "",
    ownerId: field(formData, "ownerId"),
    dueDate: field(formData, "dueDate"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);
  const { messageId, ...input } = parsed.data;
  const result = await convertMessageToTask(user, messageId, input);
  if (!result.ok) return failure(result.error, formData);
  refresh();
  revalidatePath("/taches");
  redirect(`/discussions/${result.data.slug}/fil/${result.data.rootId}?tache=creee#m-${messageId}`);
}

// ─── Salons ─────────────────────────────────────────────────────────────────

const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nom requis.")
    .max(CHANNEL_NAME_MAX, `${CHANNEL_NAME_MAX} caractères au plus.`),
  topic: z.string().trim().max(TOPIC_MAX, `${TOPIC_MAX} caractères au plus.`).optional(),
  isPrivate: checkbox,
  memberIds: z.array(id).max(100),
});

export async function createChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = channelSchema.safeParse({
    name: field(formData, "name") ?? "",
    topic: field(formData, "topic"),
    isPrivate: field(formData, "isPrivate"),
    memberIds: formData.getAll("memberIds").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await createChannel(user, {
    name: parsed.data.name,
    topic: parsed.data.topic ?? null,
    isPrivate: parsed.data.isPrivate,
    memberIds: parsed.data.memberIds,
  });
  if (!result.ok) return failure(result.error, formData);
  refresh();
  redirect(`/discussions/${result.data.slug}`);
}

const settingsSchema = z.object({
  channelId: id,
  name: z.string().trim().max(CHANNEL_NAME_MAX, `${CHANNEL_NAME_MAX} caractères au plus.`).optional(),
  topic: z.string().trim().max(TOPIC_MAX, `${TOPIC_MAX} caractères au plus.`).optional(),
  meetUrl: z.string().trim().max(500, "Lien trop long.").optional(),
});

export async function updateChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse({
    channelId: field(formData, "channelId"),
    name: field(formData, "name"),
    topic: field(formData, "topic"),
    meetUrl: field(formData, "meetUrl"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await updateChannel(user, parsed.data.channelId, {
    name: parsed.data.name ?? null,
    topic: parsed.data.topic ?? null,
    meetUrl: parsed.data.meetUrl ?? null,
  });
  if (!result.ok) return failure(result.error, formData);
  refresh();
  return { status: "success", message: "Réglages enregistrés." };
}

export async function createJitsiAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = id.safeParse(field(formData, "channelId"));
  if (!parsed.success) return;
  const result = await createJitsiRoom(user, parsed.data);
  if (result.ok) refresh();
}

const memberSchema = z.object({ channelId: id, userId: id });

export async function addMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = memberSchema.safeParse({
    channelId: field(formData, "channelId"),
    userId: field(formData, "userId"),
  });
  if (!parsed.success) return { status: "error", message: "Choisis un associé." };
  const result = await addChannelMember(user, parsed.data.channelId, parsed.data.userId);
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "success", message: "Membre ajouté." };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = memberSchema.safeParse({
    channelId: field(formData, "channelId"),
    userId: field(formData, "userId"),
  });
  if (!parsed.success) return;
  const result = await removeChannelMember(user, parsed.data.channelId, parsed.data.userId);
  if (!result.ok) return;
  refresh();
  if (result.data.left) redirect("/discussions");
}

const archiveSchema = z.object({ channelId: id, archived: z.enum(["true", "false"]) });

export async function archiveChannelAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = archiveSchema.safeParse({
    channelId: field(formData, "channelId"),
    archived: field(formData, "archived"),
  });
  if (!parsed.success) return;
  const result = await setChannelArchived(user, parsed.data.channelId, parsed.data.archived === "true");
  if (!result.ok) return;
  refresh();
  redirect(`/discussions/${result.data.slug}`);
}
