"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { markRead } from "@/features/notifications/service";

export async function markReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "all");
  await markRead(user.id, id);
  revalidatePath("/", "layout");
  const href = formData.get("href");
  if (typeof href === "string" && /^\/(?!\/)/.test(href)) redirect(href);
}
