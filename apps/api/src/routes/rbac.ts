import { Router } from "express";
import { authenticate, requireAuth } from "@peggy/auth";
import {
  createRole, getRole, listRoles, updateRole, deleteRole,
  createPermission, listPermissions,
  assignPermissionToRole, removePermissionFromRole,
  assignRoleToUser, removeRoleFromUser,
} from "@peggy/auth";

export const rbacRouter = Router();

rbacRouter.use(async (req, res, next) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

// Roles
rbacRouter.post("/roles", async (req, res) => {
  const role = await createRole(req.body.name, req.body.description);
  res.status(201).json(role);
});

rbacRouter.get("/roles", async (_req, res) => {
  const roles = await listRoles();
  res.json({ data: roles });
});

rbacRouter.get("/roles/:id", async (req, res) => {
  const role = await getRole(req.params.id);
  if (!role) return res.status(404).json({ error: "Not found" });
  res.json(role);
});

rbacRouter.put("/roles/:id", async (req, res) => {
  const role = await updateRole(req.params.id, req.body);
  if (!role) return res.status(404).json({ error: "Not found" });
  res.json(role);
});

rbacRouter.delete("/roles/:id", async (req, res) => {
  await deleteRole(req.params.id);
  res.status(204).end();
});

// Permissions
rbacRouter.post("/permissions", async (req, res) => {
  const perm = await createPermission(req.body.resource, req.body.action, req.body.description);
  res.status(201).json(perm);
});

rbacRouter.get("/permissions", async (_req, res) => {
  const perms = await listPermissions();
  res.json({ data: perms });
});

// Role-Permission assignment
rbacRouter.post("/roles/:roleId/permissions", async (req, res) => {
  await assignPermissionToRole(req.params.roleId, req.body.permissionId);
  res.status(201).json({ roleId: req.params.roleId, permissionId: req.body.permissionId });
});

rbacRouter.delete("/roles/:roleId/permissions/:permissionId", async (req, res) => {
  await removePermissionFromRole(req.params.roleId, req.params.permissionId);
  res.status(204).end();
});

// User-Role assignment
rbacRouter.post("/users/:userId/roles", async (req, res) => {
  await assignRoleToUser(req.params.userId, req.body.roleId);
  res.status(201).json({ userId: req.params.userId, roleId: req.body.roleId });
});

rbacRouter.delete("/users/:userId/roles/:roleId", async (req, res) => {
  await removeRoleFromUser(req.params.userId, req.params.roleId);
  res.status(204).end();
});
