import { Router } from "express";
import { MediaService } from "@peggy/storage";
import { authenticate, requireAuth, requirePermission } from "@peggy/auth";

export const mediaRouter = Router();

const service = new MediaService();

// NOTE: the 413 Content-Length guard lives app-wide in @peggy/http createApp,
// BEFORE express.json() — a route-level guard here would never fire because
// the 1mb body-parser limit rejects large uploads first (T034).
// auth middleware (same pattern as documents)
mediaRouter.use(async (req, res, next) => {
  if (req.path.startsWith("/media/public")) return next();
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

// sign
mediaRouter.post("/media/sign", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "upload"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const out = await service.signUpload(req.body);
    res.status(200).json(out);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("MIME_NOT_ALLOWED")) return res.status(422).json({ error: { code: "MIME_NOT_ALLOWED", message: msg } });
    if (msg.includes("FILE_TOO_LARGE")) return res.status(422).json({ error: { code: "FILE_TOO_LARGE", message: msg } });
    res.status(400).json({ error: msg });
  }
});

// confirm
mediaRouter.post("/media", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "upload"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const body = req.body ?? {};
    const row = await service.confirmUpload({ ...body, uploadedBy: ctx?.user?.id });
    res.status(201).json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("PROVIDER_KEY_NOT_FOUND")) return res.status(422).json({ error: { code: "PROVIDER_KEY_NOT_FOUND", message: msg } });
    if (msg.includes("duplicate") || msg.includes("unique")) return res.status(409).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

// list
mediaRouter.get("/media", async (req, res) => {
  const result = await service.listAssets({
    folderId: req.query.folderId as string,
    mime: req.query.mime as string,
    q: req.query.q as string,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
  });
  res.json(result);
});

// get
mediaRouter.get("/media/:id", async (req, res) => {
  const asset = await service.getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: "Not found" });
  res.json(asset);
});

// update (folder move / alt / caption)
mediaRouter.patch("/media/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  const row = await service.updateAsset(req.params.id, req.body ?? {});
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// delete
mediaRouter.delete("/media/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  const force = req.query.force === "true";
  try {
    await service.deleteAsset(req.params.id, force, ctx?.user?.id);
    res.status(204).end();
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith("MEDIA_REFERENCED:")) {
      try {
        const refs = JSON.parse(msg.slice("MEDIA_REFERENCED:".length));
        return res.status(409).json({ error: { code: "MEDIA_REFERENCED", message: "Asset is referenced", references: refs } });
      } catch {
        return res.status(409).json({ error: { code: "MEDIA_REFERENCED", message: msg } });
      }
    }
    res.status(400).json({ error: msg });
  }
});

// replace
mediaRouter.post("/media/:id/replace", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const row = await service.replaceAsset(req.params.id, { ...req.body, uploadedBy: ctx?.user?.id, actorId: ctx?.user?.id });
    res.status(201).json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("PROVIDER_KEY_NOT_FOUND")) return res.status(422).json({ error: { code: "PROVIDER_KEY_NOT_FOUND", message: msg } });
    res.status(400).json({ error: msg });
  }
});

// folders
mediaRouter.get("/media-folders", async (req, res) => {
  const rows = await service.listFolders(req.query.parentId === undefined ? undefined : (req.query.parentId === "null" ? null : (req.query.parentId as string)));
  res.json({ data: rows });
});

mediaRouter.post("/media-folders", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const folderName: string = req.body?.name ?? "";
    const folderBody: { name: string; parentId?: string | null; createdBy?: string } = { name: folderName };
    if (req.body?.parentId !== undefined) folderBody.parentId = req.body.parentId;
    if (ctx?.user?.id) folderBody.createdBy = ctx.user.id;
    const row = await service.createFolder(folderBody);
    res.status(201).json(row);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

mediaRouter.patch("/media-folders/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const row = await service.renameOrMoveFolder(req.params.id, { name: req.body?.name, parentId: req.body?.parentId });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("FOLDER_CYCLE")) return res.status(422).json({ error: { code: "FOLDER_CYCLE", message: msg } });
    if (msg.includes("FOLDER_DEPTH_EXCEEDED")) return res.status(422).json({ error: { code: "FOLDER_DEPTH_EXCEEDED", message: msg } });
    res.status(400).json({ error: msg });
  }
});

mediaRouter.delete("/media-folders/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (ctx && !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  const recursive = req.query.recursive === "true";
  try {
    await service.deleteFolder(req.params.id, recursive, ctx?.user?.id);
    res.status(204).end();
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith("FOLDER_NOT_EMPTY:")) return res.status(409).json({ error: { code: "FOLDER_NOT_EMPTY", message: msg } });
    res.status(400).json({ error: msg });
  }
});
