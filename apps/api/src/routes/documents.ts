import { Router } from "express";
import {
  createDocument, getDocument, listDocuments, updateDocument, deleteDocument,
  publishDocument, unpublishDocument,
  getVersionHistory, restoreVersion,
  queryPublished, getPublishedBySlug,
} from "@peggy/auth";
import { authenticate, requireAuth, requirePermission } from "@peggy/auth";

export const documentsRouter = Router();
export const publicDocumentsRouter = Router();

// Public routes (no auth)
documentsRouter.use(async (req, res, next) => {
  // Public routes skip auth
  if (req.originalUrl?.includes("/public/") || req.url?.includes("/public/") || req.path?.includes("/public/")) return next();
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

// Documents CRUD
documentsRouter.post("/documents", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "create"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const doc = await createDocument(req.body);
    res.status(201).json(doc);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Missing required") || msg.includes("validation")) res.status(422).json({ error: msg });
    else if (msg.includes("conflict") || msg.includes("Conflict")) res.status(409).json({ error: msg });
    else res.status(400).json({ error: msg });
  }
});

documentsRouter.get("/documents", async (req, res) => {
  const docs = await listDocuments(req.query.contentTypeId as string, req.query.locale as string);
  res.json({ data: docs });
});

documentsRouter.get("/documents/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "read"))) return res.status(403).json({ error: "Forbidden" });
  const doc = await getDocument(req.params.id, req.query.locale as string, req.query.includeDeleted === "true");
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

documentsRouter.put("/documents/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "update"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const doc = await updateDocument(req.params.id, req.body);
    res.json(doc);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("not found") || msg.includes("Not found")) res.status(404).json({ error: msg });
    else if (msg.includes("deleted")) res.status(410).json({ error: msg });
    else res.status(400).json({ error: msg });
  }
});

documentsRouter.delete("/documents/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "delete"))) return res.status(403).json({ error: "Forbidden" });
  try {
    await deleteDocument(req.params.id);
    res.status(204).end();
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Versions
documentsRouter.get("/documents/:id/versions", async (req, res) => {
  const versions = await getVersionHistory(req.params.id, req.query.locale as string);
  res.json({ data: versions });
});

documentsRouter.post("/documents/:id/restore", async (req, res) => {
  try {
    const result = await restoreVersion(req.params.id, req.body.version, req.body.locale, req.body.createdBy);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Publishing
documentsRouter.post("/documents/:id/publish", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "publish"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await publishDocument(req.params.id, req.body.locale);
    res.json(result);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("not found") || msg.includes("Not found")) res.status(404).json({ error: msg });
    else if (msg.includes("conflict") || msg.includes("Conflict")) res.status(409).json({ error: msg });
    else res.status(400).json({ error: msg });
  }
});

documentsRouter.post("/documents/:id/unpublish", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth;
  if (ctx && !(await requirePermission(ctx as Parameters<typeof requirePermission>[0], "document", "publish"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await unpublishDocument(req.params.id, req.body.locale);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Public API (no auth)
publicDocumentsRouter.get("/:collectionSlug", async (req, res) => {
  try {
    // Look up content type by collection slug
    const { contentTypes } = await import("@peggy/db");
    const { createDbClient } = await import("@peggy/db");
    const { parseConfig } = await import("@peggy/config");
    const config = parseConfig();
    const db = createDbClient(config.DATABASE_URL);
    const { eq } = await import("drizzle-orm");
    const dbInstance = db.db as { select: (...args: unknown[]) => { from: (t: unknown) => { where: (c: unknown) => Promise<unknown[]> } } };
    const ctRows = (await dbInstance.select().from(contentTypes).where(eq(contentTypes.collectionSlug, req.params.collectionSlug))) as { id: string }[];
    const ct = ctRows[0];
    if (!ct) return res.status(404).json({ error: "Content type not found" });
    const qp: { locale?: string; page: number; pageSize: number; filters?: Record<string, unknown>; sort?: string } = {
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
    };
    if (req.query.locale) qp.locale = req.query.locale as string;
    if (req.query.filters) {
      const raw = req.query.filters;
      if (typeof raw === "string") {
        try { qp.filters = JSON.parse(raw) as Record<string, unknown>; } catch { qp.filters = { title: raw } as Record<string, unknown>; }
      } else {
        qp.filters = raw as Record<string, unknown>;
      }
    }
    if (req.query.sort) qp.sort = req.query.sort as string;
    if (req.query["pagination[page]"]) qp.page = Number(req.query["pagination[page]"]);
    if (req.query["pagination[pageSize]"]) qp.pageSize = Number(req.query["pagination[pageSize]"]);
    const result = await queryPublished(ct.id, qp);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

publicDocumentsRouter.get("/:collectionSlug/:slug", async (req, res) => {
  try {
    const { contentTypes } = await import("@peggy/db");
    const { createDbClient } = await import("@peggy/db");
    const { parseConfig } = await import("@peggy/config");
    const config = parseConfig();
    const db = createDbClient(config.DATABASE_URL);
    const { eq } = await import("drizzle-orm");
    const dbInstance = db.db as { select: (...args: unknown[]) => { from: (t: unknown) => { where: (c: unknown) => Promise<unknown[]> } } };
    const ctRows = (await dbInstance.select().from(contentTypes).where(eq(contentTypes.collectionSlug, req.params.collectionSlug))) as { id: string }[];
    const ct = ctRows[0];
    if (!ct) return res.status(404).json({ error: "Content type not found" });
    const result = await getPublishedBySlug(ct.id, req.params.slug, req.query.locale as string);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Locales
documentsRouter.get("/locales", async (_req, res) => {
  const { createDbClient } = await import("@peggy/db");
  const { parseConfig } = await import("@peggy/config");
  const config = parseConfig();
  const db = createDbClient(config.DATABASE_URL);
  const { locales } = await import("@peggy/db");
  const dbInstance = db.db as { select: (...args: unknown[]) => { from: (t: unknown) => Promise<unknown[]> } };
  const locs = await dbInstance.select().from(locales);
  res.json({ data: locs });
});

documentsRouter.post("/locales", async (req, res) => {
  try {
    const { createDbClient } = await import("@peggy/db");
    const { parseConfig } = await import("@peggy/config");
    const config = parseConfig();
    const db = createDbClient(config.DATABASE_URL);
    const { locales } = await import("@peggy/db");
    const dbInstance = db.db as { insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } } };
    const rows = await dbInstance.insert(locales).values(req.body).returning();
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});
