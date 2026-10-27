export interface AuthPort {
  /** Validate a session cookie and return the user, or null. */
  getSession(cookieHeader: string): Promise<{ user: AuthUser; session: AuthSession } | null>;
  /** Validate a Bearer token and return the user + scopes, or null. */
  validateToken(token: string): Promise<{ user: AuthUser; scopes: string[] } | null>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
}

export interface AuthSession {
  id: string;
  token: string;
  expiresAt: Date;
  userId: string;
}

import { parseConfig } from "@peggy/config";
import { createDbClient } from "@peggy/db";
import { eq } from "drizzle-orm";
import { user } from "@peggy/db";
import { validateToken as validateTokenImpl } from "./tokens.js";
import type { AuthInstance } from "./auth.js";

function mapUser(u: Record<string, unknown>): AuthUser {
  return {
    id: String(u.id),
    email: String(u.email),
    name: String(u.name),
    displayName: u.displayName == null ? null : String(u.displayName),
    isActive: Boolean(u.isActive ?? true),
    isSuperAdmin: Boolean(u.isSuperAdmin ?? false),
  };
}

export function createAuthPort(auth: AuthInstance): AuthPort {
  return {
    async getSession(cookieHeader: string) {
      const session = await (auth as unknown as { api: { getSession: (a: { headers: { cookie: string } }) => Promise<{ user: unknown; session: { id: unknown; token: unknown; expiresAt: unknown; userId: unknown } } | null> } }).api.getSession({ headers: { cookie: cookieHeader } });
      if (!session?.user) return null;
      return {
        user: mapUser(session.user as Record<string, unknown>),
        session: {
          id: String(session.session.id),
          token: String(session.session.token),
          expiresAt: new Date(String(session.session.expiresAt)),
          userId: String(session.session.userId),
        },
      };
    },
    async validateToken(token: string) {
      const r = await validateTokenImpl(token);
      if (!r) return null;
      const config = parseConfig();
      const dbClient = createDbClient(config.DATABASE_URL);
      const db = dbClient.db;
      const [u] = await db.select().from(user).where(eq(user.id, r.userId));
      if (!u || !(u as { isActive?: boolean }).isActive) return null;
      return { user: mapUser(u as Record<string, unknown>), scopes: r.scopes };
    },
  };
}
