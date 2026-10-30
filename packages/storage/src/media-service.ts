import { createDbClient } from "@peggy/db";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { mediaFolders, mediaAssets, mediaUsage, contentTypes, contentFields } from "@peggy/db";
import { CloudinaryProvider } from "./cloudinary-provider.js";
import { parseConfig } from "@peggy/config";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_EXACT = new Set(["application/pdf"]);
const MAX_IMAGE_BYTES = Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024);
const MAX_VIDEO_BYTES = Number(process.env.MEDIA_MAX_VIDEO_BYTES ?? 100 * 1024 * 1024);
const MAX_PDF_BYTES = Number(process.env.MEDIA_MAX_PDF_BYTES ?? 20 * 1024 * 1024);
const MAX_AUDIO_BYTES = Number(process.env.MEDIA_MAX_AUDIO_BYTES ?? 20 * 1024 * 1024);

function maxForMime(mime: string): number {
  if (mime.startsWith("image/")) return MAX_IMAGE_BYTES;
  if (mime.startsWith("video/")) return MAX_VIDEO_BYTES;
  if (mime === "application/pdf") return MAX_PDF_BYTES;
  if (mime.startsWith("audio/")) return MAX_AUDIO_BYTES;
  return MAX_IMAGE_BYTES;
}

function allowedMime(mime: string): boolean {
  if (mime === "image/svg+xml") return process.env.CLOUDINARY_ALLOW_SVG === "true";
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export class MediaService {
  private provider = new CloudinaryProvider();

  async signUpload(req: { filename: string; mime: string; sizeBytes: number; folderId?: string }) {
    if (!allowedMime(req.mime)) throw new Error("MIME_NOT_ALLOWED");
    const limit = maxForMime(req.mime);
    if (req.sizeBytes > limit) throw new Error(`FILE_TOO_LARGE`);
    return this.provider.signUpload(req);
  }

  async confirmUpload(req: {
    providerKey: string;
    mime: string;
    sizeBytes: number;
    folderId?: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    durationS?: number;
    hashSha256?: string;
    uploadedBy?: string;
  }) {
    const verified = await this.provider.verifyAsset(req.providerKey);
    if (!verified.exists) throw new Error("PROVIDER_KEY_NOT_FOUND");
    const db = getDb();
    const mime = verified.mime ?? req.mime;
    const sizeBytes = verified.sizeBytes ?? req.sizeBytes;
    const [row] = await db.insert(mediaAssets).values({
      provider: "cloudinary",
      providerKey: req.providerKey,
      url: `https://res.cloudinary.com/${cfg().CLOUDINARY_CLOUD_NAME ?? "demo"}/image/upload/${req.providerKey}`,
      secureUrl: `https://res.cloudinary.com/${cfg().CLOUDINARY_CLOUD_NAME ?? "demo"}/image/upload/${req.providerKey}`,
      mime,
      sizeBytes,
      width: req.width ?? verified.width,
      height: req.height ?? verified.height,
      durationS: req.durationS,
      hashSha256: req.hashSha256,
      folderId: req.folderId,
      alt: req.alt,
      caption: req.caption,
      uploadedBy: req.uploadedBy,
    }).returning();
    if (!row) throw new Error("Failed to create asset");
    return row;
  }

  async listAssets(opts: { folderId?: string; mime?: string; q?: string; page?: number; pageSize?: number } = {}) {
    const db = getDb();
    const page = opts.page ?? 1;
    const pageSize = Math.min(opts.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;
    const conditions: unknown[] = [sql`${mediaAssets.deletedAt} IS NULL`];
    if (opts.folderId) conditions.push(sql`${mediaAssets.folderId} = ${opts.folderId}`);
    if (opts.mime) conditions.push(sql`${mediaAssets.mime} = ${opts.mime}`);
    if (opts.q) conditions.push(sql`${mediaAssets.alt} ILIKE ${"%" + opts.q + "%"}`);
    const where = conditions.reduce((a, b) => sql`${a} AND ${b}`);
    const rows = await db.select().from(mediaAssets).where(where as never).limit(pageSize).offset(offset);
    return { data: rows, meta: { page, pageSize } };
  }

  async getAsset(id: string) {
    const db = getDb();
    const [row] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), sql`${mediaAssets.deletedAt} IS NULL`));
    if (!row) return null;
    return { ...row, transformUrls: this.transformUrls(row.providerKey) };
  }

  transformUrls(providerKey: string) {
    const p = this.provider;
    const cloud = cfg().CLOUDINARY_CLOUD_NAME ?? "demo";
    return {
      thumb: p.transformUrl(providerKey, { preset: "thumb" }, cloud),
      card: p.transformUrl(providerKey, { preset: "card" }, cloud),
      hero: p.transformUrl(providerKey, { preset: "hero" }, cloud),
      original: p.transformUrl(providerKey, { preset: "original" }, cloud),
    };
  }

  async updateAsset(id: string, data: { folderId?: string | null; alt?: string; caption?: string }) {
    const db = getDb();
    const [row] = await db.update(mediaAssets).set({
      folderId: data.folderId ?? undefined,
      alt: data.alt,
      caption: data.caption,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    return row ?? null;
  }

  // Folders
  async createFolder(data: { name: string; parentId?: string | null; createdBy?: string }) {
    const db = getDb();
    if (!data.name) throw new Error("folder name required");
    const [row] = await db.insert(mediaFolders).values({
      name: data.name,
      parentId: data.parentId ?? null,
      createdBy: data.createdBy,
      path: "/placeholder",
    }).returning();
    // path is recomputed by trigger; re-read
    if (!row) throw new Error("Failed to create folder");
    const [fresh] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, row.id));
    return fresh ?? row;
  }

  async renameOrMoveFolder(id: string, data: { name?: string; parentId?: string | null }) {
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.parentId !== undefined) updates.parentId = data.parentId;
    try {
      const [row] = await db.update(mediaFolders).set(updates as never).where(eq(mediaFolders.id, id)).returning();
      return row ?? null;
    } catch (e) {
      const msg = String(e);
      if (msg.includes("FOLDER_CYCLE")) throw new Error("FOLDER_CYCLE");
      if (msg.includes("FOLDER_DEPTH_EXCEEDED")) throw new Error("FOLDER_DEPTH_EXCEEDED");
      throw e;
    }
  }

  async deleteFolder(id: string, recursive = false) {
    const db = getDb();
    if (!recursive) {
      const children = await db.select().from(mediaFolders).where(eq(mediaFolders.parentId, id));
      const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.folderId, id));
      if (children.length > 0 || assets.length > 0) {
        throw new Error(`FOLDER_NOT_EMPTY:${children.length + assets.length}`);
      }
    }
    await db.delete(mediaFolders).where(eq(mediaFolders.id, id));
    return true;
  }

  async listFolders(parentId?: string | null) {
    const db = getDb();
    if (parentId === undefined) {
      return db.select().from(mediaFolders);
    }
    if (parentId === null) {
      return db.select().from(mediaFolders).where(sql`${mediaFolders.parentId} IS NULL`);
    }
    return db.select().from(mediaFolders).where(eq(mediaFolders.parentId, parentId));
  }

  async deleteAsset(id: string, force = false) {
    const db = getDb();
    const usage = await db.select().from(mediaUsage).where(eq(mediaUsage.assetId, id));
    if (usage.length > 0 && !force) {
      // check if any referenced doc is published
      const refs: { documentId: string; locale: string; fieldPath: string }[] = [];
      for (const u of usage) {
        const [loc] = await db.select().from((await import("@peggy/db")).documentLocales).where(
          and(eq((await import("@peggy/db")).documentLocales.documentId, u.documentId), eq((await import("@peggy/db")).documentLocales.locale, u.locale)),
        );
        if (loc && (loc as { publishedVersionId: string | null }).publishedVersionId) {
          refs.push({ documentId: u.documentId, locale: u.locale, fieldPath: u.fieldPath });
        }
      }
      if (refs.length > 0) {
        throw new Error(`MEDIA_REFERENCED:${JSON.stringify(refs)}`);
      }
    }
    await db.update(mediaAssets).set({ deletedAt: new Date() }).where(eq(mediaAssets.id, id));
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    if (row) {
      try { await this.provider.destroy(row.providerKey); } catch { /* ignore */ }
    }
    return true;
  }

  async replaceAsset(oldId: string, req: {
    providerKey: string;
    policy: "update-references" | "keep-both";
    mime: string;
    sizeBytes: number;
    folderId?: string;
    alt?: string;
    caption?: string;
    uploadedBy?: string;
  }) {
    const verified = await this.provider.verifyAsset(req.providerKey);
    if (!verified.exists) throw new Error("PROVIDER_KEY_NOT_FOUND");
    const db = getDb();
    const cloud = (await import("@peggy/config")).parseConfig().CLOUDINARY_CLOUD_NAME ?? "demo";
    const [newRow] = await db.insert(mediaAssets).values({
      provider: "cloudinary",
      providerKey: req.providerKey,
      url: `https://res.cloudinary.com/${cloud}/image/upload/${req.providerKey}`,
      secureUrl: `https://res.cloudinary.com/${cloud}/image/upload/${req.providerKey}`,
      mime: verified.mime ?? req.mime,
      sizeBytes: verified.sizeBytes ?? req.sizeBytes,
      folderId: req.folderId,
      alt: req.alt,
      caption: req.caption,
      uploadedBy: req.uploadedBy,
    }).returning();
    if (!newRow) throw new Error("Failed to create asset");
    if (req.policy === "update-references") {
      await db.update(mediaUsage).set({ assetId: newRow.id }).where(eq(mediaUsage.assetId, oldId));
    }
    return newRow;
  }
}


function cfg() {
  return parseConfig();
}
