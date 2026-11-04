import { withDb } from "./db";

/** Nom unique par test (la base de test cumule les associés et les tâches). */
export const uniqueName = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`;

export async function userIdByEmail(email: string): Promise<string> {
  return withDb(async (c) => (await c.query(`select id from "user" where email = $1`, [email])).rows[0].id);
}

/** Identifiants des tâches d'un projet, dans l'ordre du modèle. */
export async function projectTaskIds(projectId: string): Promise<string[]> {
  return withDb(async (c) =>
    (
      await c.query(`select id from task where "projectId" = $1 order by position asc`, [projectId])
    ).rows.map((r: { id: string }) => r.id),
  );
}

export async function assignTasks(taskIds: string[], ownerId: string) {
  await withDb((c) => c.query(`update task set "ownerId" = $1 where id = any($2::text[])`, [ownerId, taskIds]));
}

export async function setTaskStatus(taskIds: string[], status: string) {
  await withDb((c) =>
    c.query(`update task set status = $1::"TaskStatus" where id = any($2::text[])`, [status, taskIds]),
  );
}

export async function renameTask(taskId: string, title: string, dueDate?: string) {
  await withDb((c) =>
    c.query(`update task set title = $2, "dueDate" = coalesce($3::date, "dueDate") where id = $1`, [
      taskId,
      title,
      dueDate ?? null,
    ]),
  );
}

export async function taskRow(taskId: string) {
  return withDb(
    async (c) =>
      (
        await c.query(`select status, "ownerId", "wipOverrideReason" from task where id = $1`, [taskId])
      ).rows[0] as { status: string; ownerId: string | null; wipOverrideReason: string | null },
  );
}

/** Limite de tâches en cours réglée pour l'agence (3 par défaut). */
export async function wipLimit(): Promise<number> {
  return withDb(
    async (c) => (await c.query(`select "wipLimit" from agency_setting where id = 'default'`)).rows[0]?.wipLimit ?? 3,
  );
}
