import { Router } from "express";
import {
  createContentType, getContentType, listContentTypes, updateContentType, deleteContentType,
  createField, getFields, updateField, deleteField,
  getSchemaVersions,
} from "@peggy/auth";
import { authenticate, requireAuth, requirePermission } from "@peggy/auth";

export const contentTypesRouter = Router();

contentTypesRouter.use(async (req, res, next) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

// Content Types
contentTypesRouter.post("/content-types", async (req, res) => {
  const ctx = (req as { auth?: { user: { isSuperAdmin: boolean } } }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "content-type", "create"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const ct = await createContentType(req.body);
    res.status(201).json(ct);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

contentTypesRouter.get("/content-types", async (_req, res) => {
  const cts = await listContentTypes();
  res.json({ data: cts });
});

contentTypesRouter.get("/content-types/:id", async (req, res) => {
  const ct = await getContentType(req.params.id);
  if (!ct) return res.status(404).json({ error: "Not found" });
  const fields = await getFields(req.params.id);
  res.json({ ...ct, fields });
});

contentTypesRouter.put("/content-types/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "content-type", "update"))) return res.status(403).json({ error: "Forbidden" });
  const ct = await updateContentType(req.params.id, req.body);
  if (!ct) return res.status(404).json({ error: "Not found" });
  res.json(ct);
});

contentTypesRouter.delete("/content-types/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "content-type", "delete"))) return res.status(403).json({ error: "Forbidden" });
  const force = req.query.force === "true";
  try {
    await deleteContentType(req.params.id, force);
    res.status(204).end();
  } catch (e) {
    res.status(409).json({ error: String(e) });
  }
});

// Fields
contentTypesRouter.post("/content-types/:id/fields", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "content-type", "update"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const field = await createField({ ...req.body, contentTypeId: req.params.id });
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

contentTypesRouter.get("/content-types/:id/fields", async (req, res) => {
  const fields = await getFields(req.params.id);
  res.json({ data: fields });
});

contentTypesRouter.put("/content-types/:id/fields/:fieldId", async (req, res) => {
  const field = await updateField(req.params.fieldId, req.body);
  if (!field) return res.status(404).json({ error: "Not found" });
  res.json(field);
});

contentTypesRouter.delete("/content-types/:id/fields/:fieldId", async (req, res) => {
  const field = await deleteField(req.params.fieldId);
  if (!field) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// Schema versions
contentTypesRouter.get("/content-types/:id/versions", async (req, res) => {
  const versions = await getSchemaVersions("content_type", req.params.id);
  res.json({ data: versions });
});
