import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { notify } from "@/features/notifications/service";
import type { ServiceResult } from "@/features/projects/service";
import { SKILLS, skillByKey, suggestedLevel } from "./tree";

type Actor = { id: string };

/** Profil de compétences : niveau (1 par défaut), preuves, reconnaissances, cible. */
export async function skillProfile(userId: string) {
  const db = getDb();
  const [levels, evidence, endorsements] = await Promise.all([
    db.userSkill.findMany({ where: { userId } }),
    db.skillEvidence.groupBy({ by: ["skillKey"], where: { userId }, _count: { _all: true } }),
    db.skillEndorsement.groupBy({ by: ["skillKey"], where: { userId }, _count: { _all: true } }),
  ]);
  const level = new Map(levels.map((l) => [l.skillKey, l]));
  const ev = new Map(evidence.map((e) => [e.skillKey, e._count._all]));
  const en = new Map(endorsements.map((e) => [e.skillKey, e._count._all]));
  return SKILLS.map((sk) => {
    const own = level.get(sk.key);
    const evidenceCount = ev.get(sk.key) ?? 0;
    const endorsementCount = en.get(sk.key) ?? 0;
    return {
      ...sk,
      level: own?.level ?? 1,
      target: own?.target ?? false,
      evidenceCount,
      endorsementCount,
      suggested: suggestedLevel(evidenceCount, endorsementCount),
    };
  });
}

export async function skillDetail(userId: string, skillKey: string) {
  const db = getDb();
  const [own, evidence, endorsements] = await Promise.all([
    db.userSkill.findUnique({ where: { userId_skillKey: { userId, skillKey } } }),
    db.skillEvidence.findMany({ where: { userId, skillKey }, orderBy: { createdAt: "desc" } }),
    db.skillEndorsement.findMany({
      where: { userId, skillKey },
      orderBy: { createdAt: "desc" },
      include: { by: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    level: own?.level ?? 1,
    target: own?.target ?? false,
    evidence,
    endorsements,
    suggested: suggestedLevel(evidence.length, endorsements.length),
  };
}

/** Auto-évaluation : chacun corrige son propre profil, à tout moment. */
export async function setSkillLevel(
  skillKey: string,
  level: number,
  actor: Actor,
): Promise<ServiceResult<null>> {
  if (!skillByKey(skillKey)) return { ok: false, error: "Compétence inconnue." };
  if (!Number.isInteger(level) || level < 1 || level > 5) return { ok: false, error: "Niveau entre 1 et 5." };
  const db = getDb();
  const before = await db.userSkill.findUnique({
    where: { userId_skillKey: { userId: actor.id, skillKey } },
  });
  await db.userSkill.upsert({
    where: { userId_skillKey: { userId: actor.id, skillKey } },
    create: { userId: actor.id, skillKey, level },
    update: { level },
  });
  await recordAudit({
    action: "progression.skill_level",
    actorId: actor.id,
    targetType: "skill",
    targetId: skillKey,
    before: { level: before?.level ?? 1 },
    after: { level },
  });
  return { ok: true, data: null };
}

/** Une seule compétence cible à la fois (celle du mois ou du trimestre). */
export async function setSkillTarget(
  skillKey: string,
  on: boolean,
  actor: Actor,
): Promise<ServiceResult<null>> {
  if (!skillByKey(skillKey)) return { ok: false, error: "Compétence inconnue." };
  const db = getDb();
  await db.$transaction([
    db.userSkill.updateMany({ where: { userId: actor.id, target: true }, data: { target: false } }),
    db.userSkill.upsert({
      where: { userId_skillKey: { userId: actor.id, skillKey } },
      create: { userId: actor.id, skillKey, target: on },
      update: { target: on },
    }),
  ]);
  return { ok: true, data: null };
}

export async function addEvidence(
  skillKey: string,
  input: { text: string; url: string | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  if (!skillByKey(skillKey)) return { ok: false, error: "Compétence inconnue." };
  await getDb().skillEvidence.create({ data: { userId: actor.id, skillKey, ...input } });
  return { ok: true, data: null };
}

/** Reconnaître la compétence d'un associé : facultatif, constructif, une fois par compétence. */
export async function endorse(
  userId: string,
  skillKey: string,
  note: string | null,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const skill = skillByKey(skillKey);
  if (!skill) return { ok: false, error: "Compétence inconnue." };
  if (userId === actor.id) return { ok: false, error: "La reconnaissance vient d'un autre associé." };
  const db = getDb();
  const created = await db.skillEndorsement.createMany({
    data: [{ userId, byId: actor.id, skillKey, note }],
    skipDuplicates: true,
  });
  if (!created.count) return { ok: false, error: "Vous avez déjà reconnu cette compétence." };
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  await notify({
    userId,
    kind: "felicitations",
    title: `${me?.name ?? "Un associé"} reconnaît votre compétence « ${skill.name} »`,
    body: note ?? undefined,
    href: `/competences/${skillKey}`,
    dedupeKey: `endorse:${skillKey}:${actor.id}`,
  });
  return { ok: true, data: null };
}

export async function targetSkill(userId: string) {
  const t = await getDb().userSkill.findFirst({ where: { userId, target: true } });
  return t ? { ...skillByKey(t.skillKey)!, level: t.level } : null;
}
