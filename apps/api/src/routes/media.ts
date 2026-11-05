import { Router } from "express";
import { MediaService, FileTooLargeError } from "@peggy/storage";
import { authenticate, requireAuth, requirePermission } from "@peggy/auth";

export const mediaRouter = Router();

// Shared service instance backed by the caller's db + provider. Production
// entry points (server.ts / lambda.ts) call initMediaService once at boot so
// all requests share one client; the fallback constructs a local default so
// the router keeps working standalone (tests, scripts).
let service = new MediaService();

export function initMediaService(db: ConstructorParameters<typeof MediaService>[0], provider?: ConstructorParameters<typeof MediaService>[1]) {
  service = new MediaService(db, provider);
  return service;
}

// T052/FR-004: map service policy errors to 422 with machine-readable
// details. FileTooLargeError carries { limit, received } on the instance —
// prefer it over parsing the message, falling back to message matching for
// errors that cross a serialization boundary.
function policyError(e: unknown): { status: number; body: { code: string; message: string; limit?: number; received?: number } } | null {
  const msg = e instanceof Error ? e.message : String(e);
  // Prefer the typed instance (carries { limit, received }); the message
  // fallback below covers errors that cross a serialization boundary.
  // The typeof guard keeps this working when the storage package's types
  // haven't been rebuilt yet (FileTooLargeError would otherwise be an
  // unresolvable import at typecheck time).
  if (typeof FileTooLargeError !== "undefined" && e instanceof FileTooLargeError) {
    return { status: 422, body: { code: "FILE_TOO_LARGE", message: msg, limit: e.limit, received: e.received } };
  }
  if (msg.includes("MIME_NOT_ALLOWED")) return { status: 422, body: { code: "MIME_NOT_ALLOWED", message: msg } };
  if (msg.includes("FILE_TOO_LARGE")) {
    const details = /{"limit":(\d+),"received":(\d+)}/.exec(msg);
    return {
      status: 422,
      body: {
        code: "FILE_TOO_LARGE",
        message: msg,
        ...(details ? { limit: Number(details[1]), received: Number(details[2]) } : {}),
      },
    };
  }
  return null;
}

// NOTE: the 413 Content-Length guard lives app-wide in @peggy/http createApp,
// BEFORE express.json() — a route-level guard here would never fire because
// the 1mb body-parser limit rejects large uploads first (T034).
// auth middleware (same pattern as documents). All media routes require
// authentication — there is no public exemption, and the permission checks
// below are fail-closed (!ctx || ...) so a missing context can never pass.
mediaRouter.use(async (req, res, next) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  (req as { auth?: unknown }).auth = ctx;
  next();
});

// sign
mediaRouter.post("/media/sign", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "upload"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const out = await service.signUpload(req.body);
    res.status(200).json(out);
  } catch (e) {
    const mapped = policyError(e);
    if (mapped) return res.status(mapped.status).json({ error: mapped.body });
    res.status(400).json({ error: String(e) });
  }
});

// confirm
mediaRouter.post("/media", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "upload"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const body = req.body ?? {};
    const row = await service.confirmUpload({ ...body, uploadedBy: ctx?.user?.id });
    res.status(201).json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("PROVIDER_KEY_NOT_FOUND")) return res.status(422).json({ error: { code: "PROVIDER_KEY_NOT_FOUND", message: msg } });
    // MIME/size are re-enforced at confirm time (policy gate, not client bug
    // passthrough) — 422 with details, matching the sign route (T052/FR-004).
    const mapped = policyError(e);
    if (mapped) return res.status(mapped.status).json({ error: mapped.body });
    if (msg.includes("duplicate") || msg.includes("unique")) return res.status(409).json({ error: { code: "PROVIDER_KEY_CONFLICT", message: msg } });
    res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
  }
});

// list
mediaRouter.get("/media", async (req, res) => {
  try {
    const result = await service.listAssets({
      folderId: req.query.folderId as string,
      mime: req.query.mime as string,
      q: req.query.q as string,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: String(e) } });
  }
});

// get
mediaRouter.get("/media/:id", async (req, res) => {
  try {
    const asset = await service.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    res.json(asset);
  } catch (e) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: String(e) } });
  }
});

// update (folder move / alt / caption)
mediaRouter.patch("/media/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const row = await service.updateAsset(req.params.id, req.body ?? {});
    if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: String(e) } });
  }
});

// delete
mediaRouter.delete("/media/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
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
    if (msg.includes("NOT_FOUND")) return res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
    res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
  }
});

// replace
mediaRouter.post("/media/:id/replace", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const row = await service.replaceAsset(req.params.id, { ...req.body, uploadedBy: ctx?.user?.id, actorId: ctx?.user?.id });
    res.status(201).json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("PROVIDER_KEY_NOT_FOUND")) return res.status(422).json({ error: { code: "PROVIDER_KEY_NOT_FOUND", message: msg } });
    const mapped = policyError(e);
    if (mapped) return res.status(mapped.status).json({ error: mapped.body });
    if (msg.includes("UNKNOWN_POLICY")) return res.status(422).json({ error: { code: "UNKNOWN_POLICY", message: msg } });
    if (msg.includes("duplicate") || msg.includes("unique")) return res.status(409).json({ error: { code: "PROVIDER_KEY_CONFLICT", message: msg } });
    res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
  }
});

// folders
mediaRouter.get("/media-folders", async (req, res) => {
  try {
    const rows = await service.listFolders(req.query.parentId === undefined ? undefined : (req.query.parentId === "null" ? null : (req.query.parentId as string)));
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: String(e) } });
  }
});

mediaRouter.post("/media-folders", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
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
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  try {
    const row = await service.renameOrMoveFolder(req.params.id, { name: req.body?.name, parentId: req.body?.parentId });
    if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    res.json(row);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("FOLDER_CYCLE")) return res.status(422).json({ error: { code: "FOLDER_CYCLE", message: msg } });
    if (msg.includes("FOLDER_DEPTH_EXCEEDED")) return res.status(422).json({ error: { code: "FOLDER_DEPTH_EXCEEDED", message: msg } });
    res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
  }
});

mediaRouter.delete("/media-folders/:id", async (req, res) => {
  const ctx = (req as { auth?: unknown }).auth as { user: { id: string } } | undefined;
  if (!ctx || !(await requirePermission(ctx as never, "media", "manage"))) return res.status(403).json({ error: "Forbidden" });
  const recursive = req.query.recursive === "true";
  try {
    await service.deleteFolder(req.params.id, recursive, ctx?.user?.id);
    res.status(204).end();
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith("FOLDER_NOT_EMPTY:")) return res.status(409).json({ error: { code: "FOLDER_NOT_EMPTY", message: msg } });
    if (msg.includes("NOT_FOUND")) return res.status(404).json({ error: { code: "NOT_FOUND", message: msg } });
    res.status(400).json({ error: { code: "BAD_REQUEST", message: msg } });
  }
});
