import { createAuth } from "./auth.js";
import { createAuthPort } from "./port.js";
import { hasPermission } from "./rbac.js";
import type { AuthUser } from "./port.js";

export interface AuthContext {
  user: AuthUser | null;
  scopes: string[];
  method: "session" | "token" | "none";
}

export async function sessionCookieAuth(req: { headers?: { cookie?: string } }): Promise<AuthContext> {
  const auth = createAuth();
  const port = createAuthPort(auth);
  const cookieHeader = req.headers?.cookie ?? "";
  try {
    const res = await port.getSession(cookieHeader);
    if (!res) return { user: null, scopes: [], method: "none" };
    const u = res.user;
    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        displayName: u.displayName ?? null,
        isActive: u.isActive ?? true,
        isSuperAdmin: u.isSuperAdmin ?? false,
      },
      scopes: [],
      method: "session",
    };
  } catch {
    return { user: null, scopes: [], method: "none" };
  }
}

export async function bearerTokenAuth(req: { headers?: { authorization?: string } }): Promise<AuthContext> {
  const authHeader = req.headers?.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) return { user: null, scopes: [], method: "none" };
  const token = authHeader.slice(7);
  const auth = createAuth();
  const port = createAuthPort(auth);
  const result = await port.validateToken(token);
  if (!result) return { user: null, scopes: [], method: "none" };
  const u = result.user;
  if (!u.isActive) return { user: null, scopes: [], method: "none" };

  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      displayName: u.displayName ?? null,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    },
    scopes: result.scopes,
    method: "token",
  };
}

export async function authenticate(req: { headers?: { authorization?: string; cookie?: string } }): Promise<AuthContext> {
  const authHeader = req.headers?.authorization ?? "";
  if (authHeader.startsWith("Bearer ")) {
    return bearerTokenAuth(req);
  }
  return sessionCookieAuth(req);
}

export function requireAuth(ctx: AuthContext): boolean {
  return ctx.user !== null && (ctx.user?.isActive ?? false);
}

export async function requirePermission(
  ctx: AuthContext,
  resource: string,
  action: string,
  ownerId?: string,
): Promise<boolean> {
  if (!ctx.user) return false;
  if (ctx.user.isSuperAdmin) return true;
  if (ctx.method === "token") {
    return ctx.scopes.includes(`${resource}.${action}`);
  }
  return hasPermission(ctx.user.id, resource, action, ownerId);
}
