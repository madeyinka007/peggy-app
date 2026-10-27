import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import { clearPermissionCache } from "./rbac.js";

// Integration over real Postgres (peggy-dev-pg). Tests require DATABASE_URL.

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

let rawPg: pg.Client;

beforeAll(async () => {
  rawPg = new pg.Client({ connectionString: mustEnv("DATABASE_URL") });
  await rawPg.connect();
});

afterAll(async () => {
  await rawPg.end();
});

beforeEach(async () => {
  await rawPg.query("DELETE FROM user_roles");
  await rawPg.query("DELETE FROM role_permissions");
  await rawPg.query("DELETE FROM permissions");
  await rawPg.query("DELETE FROM roles");
  // users table may have rows; clear only test-scoped ones seeded below
  clearPermissionCache();
});

describe("hasPermission integration (seeded RBAC fixture)", () => {
  it("allow when user has the resource.action via role assignment", async () => {
    const { hasPermission, createRole, createPermission, assignPermissionToRole, assignRoleToUser } = await import("./rbac.js");
    const { randomUUID } = await import("node:crypto");
    const uid = randomUUID();
    await rawPg.query("INSERT INTO \"user\" (id, name, email) VALUES ($1, 'u', $2)", [uid, `${uid}@example.com`]);
    const role = await createRole(`r-${uid.slice(0, 8)}`);
    const perm = await createPermission("content-type", "read");
    if (!role?.id || !perm?.id) throw new Error("fixture setup failed");
    await assignPermissionToRole(role.id, perm.id);
    await assignRoleToUser(uid, role.id);
    const r = await hasPermission(uid, "content-type", "read");
    expect(r).toBe(true);
    await rawPg.query("DELETE FROM \"user\" WHERE id=$1", [uid]);
  });

  it("deny when permission not held", async () => {
    const { hasPermission, createRole, createPermission, assignPermissionToRole, assignRoleToUser } = await import("./rbac.js");
    const { randomUUID } = await import("node:crypto");
    const uid = randomUUID();
    await rawPg.query("INSERT INTO \"user\" (id, name, email) VALUES ($1, 'u', $2)", [uid, `${uid}@example.com`]);
    const role = await createRole(`r2-${uid.slice(0, 8)}`);
    const perm = await createPermission("content-type", "read");
    if (!role?.id || !perm?.id) throw new Error("fixture setup failed");
    await assignPermissionToRole(role.id, perm.id);
    await assignRoleToUser(uid, role.id);
    const r = await hasPermission(uid, "content-type", "delete");
    expect(r).toBe(false);
    await rawPg.query("DELETE FROM \"user\" WHERE id=$1", [uid]);
  });

  it("owner-only: non-owner denied, owner allowed", async () => {
    const { hasPermission, createRole, createPermission, assignPermissionToRole, assignRoleToUser } = await import("./rbac.js");
    const { randomUUID } = await import("node:crypto");
    const uid = randomUUID();
    const owner = randomUUID();
    await rawPg.query("INSERT INTO \"user\" (id, name, email) VALUES ($1, 'u', $2)", [uid, `${uid}@example.com`]);
    const role = await createRole(`r3-${uid.slice(0, 8)}`);
    const perm = await createPermission("document", "delete");
    if (!role?.id || !perm?.id) throw new Error("fixture setup failed");
    await assignPermissionToRole(role.id, perm.id);
    await assignRoleToUser(uid, role.id);

    const deny = await hasPermission(uid, "document", "delete", owner);
    expect(deny).toBe(false);

    const allow = await hasPermission(uid, "document", "delete", uid);
    expect(allow).toBe(true);

    await rawPg.query("DELETE FROM \"user\" WHERE id=$1", [uid]);
  });

  it("deny when user has no roles", async () => {
    const { hasPermission } = await import("./rbac.js");
    const { randomUUID } = await import("node:crypto");
    const uid = randomUUID();
    await rawPg.query("INSERT INTO \"user\" (id, name, email) VALUES ($1, 'u', $2)", [uid, `${uid}@example.com`]);
    const r = await hasPermission(uid, "content-type", "read");
    expect(r).toBe(false);
    await rawPg.query("DELETE FROM \"user\" WHERE id=$1", [uid]);
  });
});
