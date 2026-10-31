"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { addEvidence, endorse, setSkillLevel, setSkillTarget } from "@/features/skills/service";

const refresh = (key: string) => {
  revalidatePath("/competences");
  revalidatePath(`/competences/${key}`);
  revalidatePath("/progression");
};

export async function setSkillLevelAction(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("skillKey") ?? "");
  const level = Number(formData.get("level"));
  await setSkillLevel(key, level, user);
  refresh(key);
}

export async function setSkillTargetAction(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("skillKey") ?? "");
  await setSkillTarget(key, formData.get("on") === "true", user);
  refresh(key);
}

const evidenceSchema = z.object({
  skillKey: z.string().min(1),
  text: z.string().trim().min(3, "Décrivez la preuve en quelques mots.").max(500),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^https:\/\//.test(v)) ctx.addIssue({ code: "custom", message: "Lien https:// uniquement." });
      return v;
    }),
});

export async function addEvidenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = evidenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const { skillKey, ...input } = parsed.data;
  const result = await addEvidence(skillKey, input, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh(skillKey);
  return { status: "success", message: "Preuve ajoutée." };
}

const endorseSchema = z.object({
  userId: z.string().min(1),
  skillKey: z.string().min(1),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export async function endorseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = endorseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Vérifiez le message." };
  const result = await endorse(parsed.data.userId, parsed.data.skillKey, parsed.data.note, user);
  if (!result.ok) return { status: "error", message: result.error };
  refresh(parsed.data.skillKey);
  return { status: "success", message: "Reconnaissance envoyée." };
}
