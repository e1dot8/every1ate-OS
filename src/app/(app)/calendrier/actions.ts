"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EventVisibility } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { addDays, parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { zonedToUtc } from "@/features/calendar/rules";
import { cancelEvent, deleteFeed, rotateFeed, saveEvent } from "@/features/calendar/service";

export type EventFormState = FormState & {
  concurrent?: {
    version: number;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    updatedAt: string;
  };
  conflicts?: { id: string; title: string; when: string }[];
  savedId?: string;
};

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schema = z.object({
  eventId: z.string().optional(),
  version: z.coerce.number().int().optional(),
  force: z.string().optional(),
  title: z.string().trim().min(1, "Titre requis.").max(200),
  description: optional(5000),
  location: optional(300),
  allDay: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  start: z.string().min(1, "Début requis."),
  end: z.string().min(1, "Fin requise."),
  visibility: z.enum(["OCCUPE", "PARTAGE"]),
  projectId: optional(50),
  clientId: optional(50),
  opportunityId: optional(50),
});

export async function saveEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const d = parsed.data;
  let startsAt: Date | null;
  let endsAt: Date | null;
  if (d.allDay) {
    // Journée entière : dates calendrier (fin incluse), stockées de minuit à minuit (Paris).
    const s = parseDateInput(d.start.slice(0, 10));
    const e = parseDateInput(d.end.slice(0, 10));
    startsAt = s && zonedToUtc(`${d.start.slice(0, 10)}T00:00`);
    endsAt = e && zonedToUtc(`${addDays(e, 1).toISOString().slice(0, 10)}T00:00`);
  } else {
    startsAt = zonedToUtc(d.start);
    endsAt = zonedToUtc(d.end);
  }
  if (!startsAt)
    return {
      status: "error",
      fieldErrors: { start: "Date ou heure invalide." },
      values: keptValues(formData),
    };
  if (!endsAt)
    return { status: "error", fieldErrors: { end: "Date ou heure invalide." }, values: keptValues(formData) };
  const result = await saveEvent(
    d.eventId || null,
    {
      title: d.title,
      description: d.description,
      location: d.location,
      startsAt,
      endsAt,
      allDay: d.allDay,
      visibility: d.visibility as EventVisibility,
      attendeeIds: formData.getAll("attendeeIds").map(String),
      projectId: d.projectId,
      clientId: d.clientId,
      opportunityId: d.opportunityId,
    },
    d.version ?? null,
    d.force === "true",
    user,
  );
  if (!result.ok)
    return {
      status: "error",
      message: result.error,
      values: keptValues(formData),
      concurrent: result.concurrent,
    };
  revalidatePath("/calendrier");
  revalidatePath("/");
  if (result.conflicts.length)
    return {
      status: "success",
      message: "Enregistré, mais des conflits d'agenda existent.",
      conflicts: result.conflicts,
      savedId: result.id,
    };
  redirect(`/calendrier/${result.id}`);
}

export async function cancelEventAction(formData: FormData) {
  const user = await requireUser();
  await cancelEvent(String(formData.get("eventId")), user);
  revalidatePath("/calendrier");
  redirect("/calendrier");
}

export type FeedState = { status: "idle" | "success"; url?: string };

export async function rotateFeedAction(_prev: FeedState, formData: FormData): Promise<FeedState> {
  const user = await requireUser();
  const { url } = await rotateFeed(user, formData.get("includeTasks") === "on");
  revalidatePath("/calendrier/abonnement");
  return { status: "success", url };
}

export async function deleteFeedAction() {
  const user = await requireUser();
  await deleteFeed(user);
  revalidatePath("/calendrier/abonnement");
}
