"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { MAX_PRIORITIES, setDayPriorities } from "@/features/cockpit/service";

const schema = z.array(z.string().min(1).max(64)).max(MAX_PRIORITIES, `Trois priorités au plus.`);

export async function setPrioritiesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(formData.getAll("taskIds").map(String));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const result = await setDayPriorities(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/");
  redirect("/");
}
