import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDbClient, session } from "@peggy/db";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { parseConfig } from "@peggy/config";

export function createAuth() {
  const config = parseConfig();
  const dbClient = createDbClient(config.DATABASE_URL);
  const db = dbClient.db;

  return betterAuth({
    database: drizzleAdapter(db as Parameters<typeof drizzleAdapter>[0], { provider: "pg" }),
    emailAndPassword: { enabled: true },
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    databaseHooks: {
      session: {
        delete: {
          before: async (sess: Record<string, unknown>) => {
            const drizzleDb = db as ReturnType<typeof drizzle>;
            await drizzleDb.update(session).set({ revokedAt: new Date() }).where(eq(session.id, String(sess.id)));
            return false;
          },
        },
      },
    },
    advanced: {
      database: { generateId: false },
      defaultCookieAttributes: {
        domain: ".parent",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        httpOnly: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * config.SESSION_EXPIRES_DAYS,
      updateAge: 60 * 60 * config.SESSION_UPDATE_AGE_H,
      cookieCache: { enabled: true, maxAge: config.COOKIE_CACHE_S, strategy: "jwe" },
    },
    user: {
      additionalFields: {
        displayName: { type: "string", required: false },
        avatarAssetId: { type: "string", required: false },
        isActive: { type: "boolean", required: false, defaultValue: true },
        isSuperAdmin: { type: "boolean", required: false, defaultValue: false },
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
