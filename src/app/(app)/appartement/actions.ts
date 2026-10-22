"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { placeItem, saveAvatar, setAvailability, type Availability } from "@/features/maison/service";

const refresh = () => {
  revalidatePath("/appartement");
  revalidatePath("/bureau");
  revalidatePath("/");
};

const lookSchema = z.object({
  skin: z.string().min(1).max(30),
  hat: z.string().min(1).max(30),
  apron: z.string().min(1).max(30),
  accessory: z.string().min(1).max(30),
  backdrop: z.string().min(1).max(30),
});

export async function saveAvatarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = lookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choisissez une option dans chaque groupe." };
  const result = await saveAvatar(parsed.data, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "success", message: "Avatar enregistré." };
}

export async function placeItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ slot: z.string().min(1).max(30), itemKey: z.string().min(1).max(40) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choix invalide." };
  const result = await placeItem(parsed.data.slot, parsed.data.itemKey, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "success", message: "C'est installé." };
}

export async function setAvailabilityAction(formData: FormData) {
  const user = await requireUser();
  const value = String(formData.get("availability") ?? "");
  const status = ["DISPONIBLE", "CONCENTRE", "ABSENT"].includes(value) ? (value as Availability) : null;
  await setAvailability(status, user);
  refresh();
}
