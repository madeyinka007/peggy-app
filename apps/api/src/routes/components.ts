import { Router } from "express";
import {
  createComponent, getComponent, listComponents, updateComponent, deleteComponent,
  createField, getFields,
} from "@peggy/auth";
import { authenticate, requireAuth, requirePermission } from "@peggy/auth";

export const componentsRouter = Router();

componentsRouter.use(async (req, res, next) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

componentsRouter.post("/components", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "component", "create"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const comp = await createComponent(req.body);
    res.status(201).json(comp);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

componentsRouter.get("/components", async (_req, res) => {
  const comps = await listComponents();
  res.json({ data: comps });
});

componentsRouter.get("/components/:id", async (req, res) => {
  const comp = await getComponent(req.params.id);
  if (!comp) return res.status(404).json({ error: "Not found" });
  const fields = await getFields(undefined, req.params.id);
  res.json({ ...comp, fields });
});

componentsRouter.put("/components/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "component", "update"))) return res.status(403).json({ error: "Forbidden" });
  const comp = await updateComponent(req.params.id, req.body);
  if (!comp) return res.status(404).json({ error: "Not found" });
  res.json(comp);
});

componentsRouter.delete("/components/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "component", "delete"))) return res.status(403).json({ error: "Forbidden" });
  try {
    await deleteComponent(req.params.id);
    res.status(204).end();
  } catch (e) {
    res.status(409).json({ error: String(e) });
  }
});

componentsRouter.post("/components/:id/fields", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "component", "update"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const field = await createField({ ...req.body, componentId: req.params.id });
    res.status(201).json(field);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Reserved") || msg.includes("Invalid field type")) {
      res.status(422).json({ error: msg });
    } else {
      res.status(400).json({ error: msg });
    }
  }
});

componentsRouter.get("/components/:id/fields", async (req, res) => {
  const fields = await getFields(undefined, req.params.id);
  res.json({ data: fields });
});
