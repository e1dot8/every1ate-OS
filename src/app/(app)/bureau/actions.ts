"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { awardPeerBadge } from "@/features/badges/service";
import { cheer } from "@/features/brigade/service";

const message = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => v || null);

export async function cheerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ eventId: z.string().min(1), message }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Message trop long." };
  const result = await cheer(parsed.data.eventId, parsed.data.message, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/bureau");
  return { status: "success", message: "Bravo envoyé." };
}

const peerSchema = z.object({
  targetId: z.string().min(1, "Choisissez un associé."),
  badgeKey: z.string().min(1, "Choisissez un badge."),
  message: z.string().trim().min(3, "Dites en un mot pourquoi.").max(300),
});

export async function peerBadgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = peerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const result = await awardPeerBadge(parsed.data.targetId, parsed.data.badgeKey, parsed.data.message, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/bureau");
  return { status: "success", message: "Badge décerné. La brigade est prévenue." };
}
