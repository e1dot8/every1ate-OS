"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FileKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { addFile, archiveFile, checkFile } from "@/features/documents/service";

const id = z
  .string()
  .optional()
  .transform((v) => v || null);

const schema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  url: z.string().trim().min(1, "Lien requis.").max(2000),
  kind: z
    .enum(["DOCUMENT", "DOSSIER", "MEDIA", "AUTRE", ""])
    .optional()
    .transform((v) => (v ? (v as FileKind) : null)),
  ownerLabel: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || null),
  documentDate: z
    .string()
    .optional()
    .transform((v) => parseDateInput(v)),
  projectId: id,
  workPackageId: id,
  taskId: id,
  clientId: id,
  back: z.string().optional(),
});

function refresh(back?: string | null) {
  revalidatePath("/documents");
  if (back && /^\/(?!\/)/.test(back)) revalidatePath(back.split("?")[0]);
}

export async function addFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { back, ...input } = parsed.data;
  const result = await addFile(input, user);
  if (!result.ok) return { status: "error", message: result.error, values: keptValues(formData) };
  refresh(back);
  return { status: "success", message: "Document référencé." };
}

export async function checkFileAction(formData: FormData) {
  const user = await requireUser();
  await checkFile(String(formData.get("fileId")), user);
  refresh(String(formData.get("back") ?? ""));
}

export async function archiveFileAction(formData: FormData) {
  const user = await requireUser();
  await archiveFile(String(formData.get("fileId")), user);
  refresh(String(formData.get("back") ?? ""));
}
