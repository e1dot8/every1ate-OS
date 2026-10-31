"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { abandonQuest, acceptQuest, completeQuest } from "@/features/quests/service";

const schema = z.object({
  questKey: z.string().min(1).max(40),
  intent: z.enum(["accepter", "abandonner", "valider"]),
});

const refresh = () => {
  revalidatePath("/quetes");
  revalidatePath("/");
};

export async function questAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Action invalide." };
  const { questKey, intent } = parsed.data;
  if (intent === "accepter") {
    const r = await acceptQuest(questKey, user);
    if (!r.ok) return { status: "error", message: r.error };
    refresh();
    return { status: "success", message: "Quête acceptée." };
  }
  if (intent === "abandonner") {
    const r = await abandonQuest(questKey, user);
    if (!r.ok) return { status: "error", message: r.error };
    refresh();
    return { status: "success", message: "Quête abandonnée : la place est libre." };
  }
  const r = await completeQuest(questKey, user);
  if (!r.ok) return { status: "error", message: r.error };
  refresh();
  return {
    status: "success",
    message: `Quête accomplie : ${r.data.title}.${r.data.xp ? ` +${r.data.xp.amount} XP` : ""}${
      r.data.xp?.levelUp ? ` · niveau ${r.data.xp.levelUp.level} !` : ""
    }`,
  };
}
