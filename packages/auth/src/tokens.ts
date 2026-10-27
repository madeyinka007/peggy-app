import { createHash, randomBytes } from "node:crypto";
import { parseConfig } from "@peggy/config";
import { createDbClient } from "@peggy/db";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { apiTokens } from "@peggy/db";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createToken(userId: string, name: string, scopes: string[], prefix: "pk_" | "sk_" = "pk_") {
  if (prefix !== "pk_" && prefix !== "sk_") throw new Error("invalid token prefix");
  const db = getDb();
  const raw = randomBytes(32).toString("hex");
  const token = `${prefix}${raw}`;
  const hashed = hashToken(token);
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name, prefix, hashedToken: hashed, scopes })
    .returning();
  // Return plaintext token only at creation
  return { ...row, token };
}

export async function listTokens(userId: string) {
  const db = getDb();
  return db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
}

export async function revokeToken(id: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning();
  return row ?? null;
}

export async function validateToken(token: string): Promise<{ userId: string; scopes: string[] } | null> {
  const db = getDb();
  const hashed = hashToken(token);
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.hashedToken, hashed));

  if (!row) return null;
  if (row.revokedAt) return null;

  // Update lastUsedAt
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));

  return { userId: row.userId, scopes: row.scopes };
}

export { hashToken };
