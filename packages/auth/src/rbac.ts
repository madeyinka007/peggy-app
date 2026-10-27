import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import { roles, permissions, rolePermissions, userRoles } from "@peggy/db";

const permCache = new Map<string, { perms: { resource: string; action: string }[]; expires: number }>();

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

// --- Roles ---

export async function createRole(name: string, description?: string) {
  const db = getDb();
  const [role] = await db.insert(roles).values({ name, description }).returning();
  return role;
}

export async function getRole(id: string) {
  const db = getDb();
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  return role ?? null;
}

export async function listRoles() {
  const db = getDb();
  return db.select().from(roles);
}

export async function updateRole(id: string, data: { name?: string; description?: string }) {
  const db = getDb();
  const [role] = await db.update(roles).set({ ...data, updatedAt: new Date() }).where(eq(roles.id, id)).returning();
  return role ?? null;
}

export async function deleteRole(id: string) {
  const db = getDb();
  await db.delete(roles).where(eq(roles.id, id));
}

// --- Permissions ---

export async function createPermission(resource: string, action: string, description?: string) {
  const db = getDb();
  const [perm] = await db.insert(permissions).values({ resource, action, description }).returning();
  return perm;
}

export async function listPermissions() {
  const db = getDb();
  return db.select().from(permissions);
}

// --- Role-Permission assignment ---

export async function assignPermissionToRole(roleId: string, permissionId: string) {
  const db = getDb();
  await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  const db = getDb();
  await db.delete(rolePermissions).where(
    and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)),
  );
}

// --- User-Role assignment ---

export async function assignRoleToUser(userId: string, roleId: string) {
  const db = getDb();
  await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  const db = getDb();
  await db.delete(userRoles).where(
    and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)),
  );
}

// --- Permission evaluator ---


export function clearPermissionCache(userId?: string) {
  if (userId) permCache.delete(userId);
  else permCache.clear();
}

export async function hasPermission(
  userId: string,
  resource: string,
  action: string,
  ownerId?: string,
): Promise<boolean> {
  const db = getDb();
  const cached = permCache.get(userId);
  let perms: { resource: string; action: string }[];
  if (cached && cached.expires > Date.now()) {
    perms = cached.perms;
  } else {
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    if (userRoleRows.length === 0) return false;
    const roleIds = userRoleRows.map((r) => r.roleId);

    perms = await db
      .select({ resource: permissions.resource, action: permissions.action })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    permCache.set(userId, { perms, expires: Date.now() + 60_000 });
  }

  const userPerms = perms.map((p) => `${p.resource}.${p.action}`);
  return evaluatePermission(userPerms, resource, action, userId, ownerId);
}



// Pure evaluator — unit-testable without DB. Given the user's permission strings,
// returns whether (resource, action) is allowed, with owner-only semantics:
// when ownerId is supplied and differs from userId, access is denied (the
// caller — e.g. document service — is the one that has the createdBy truth).
export function evaluatePermission(
  userPerms: string[],
  resource: string,
  action: string,
  userId: string,
  ownerId?: string,
): boolean {
  const want = `${resource}.${action}`;
  if (!userPerms.includes(want)) return false;
  if (ownerId !== undefined && ownerId !== userId) return false;
  return true;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const db = getDb();
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRoleRows.length === 0) return [];

  const roleIds = userRoleRows.map((r) => r.roleId);
  const perms = await db
    .select({ resource: permissions.resource, action: permissions.action })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));

  const permSet = new Set(perms.map((p) => `${p.resource}.${p.action}`));
  return Array.from(permSet);
}
