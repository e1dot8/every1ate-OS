import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

/** Accès direct à la base de test (jamais de données réelles). */
const connectionString = process.env.DATABASE_URL ?? "postgresql://e1:e1@localhost:5432/every1ate_os";

export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Adresse unique par test : les compteurs de tentatives et le journal ne se mélangent pas. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${randomBytes(3).toString("hex")}@example.test`;
}

export async function insertInvitation(
  email: string,
  name: string,
  expiresInMs = 72 * 3600 * 1000,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await withDb((c) =>
    c.query(
      `insert into invitation (id, email, name, "tokenHash", "expiresAt", "createdAt") values ($1, $2, $3, $4, $5, now())`,
      [`inv_${randomBytes(8).toString("hex")}`, email, name, tokenHash, new Date(Date.now() + expiresInMs)],
    ),
  );
  return token;
}

export async function lastEmailTo(email: string): Promise<{ subject: string; text: string } | null> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select subject, text from email_outbox where "to" = $1 order by "createdAt" desc limit 1`,
      [email],
    );
    return rows[0] ?? null;
  });
}

export async function auditActions(fingerprintOrActor: { actorEmail?: string }): Promise<string[]> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select a.action from audit_event a join "user" u on u.id = a."actorId" where u.email = $1 order by a."createdAt"`,
      [fingerprintOrActor.actorEmail],
    );
    return rows.map((r: { action: string }) => r.action);
  });
}
