import { createHash } from "node:crypto";
import { parseConfig } from "@peggy/config";
import type { SignRequest, StorageProvider } from "./provider.js";

function cfg() {
  return parseConfig();
}

function cloudName(): string { return cfg().CLOUDINARY_CLOUD_NAME ?? "demo"; }
function apiKey(): string { return cfg().CLOUDINARY_API_KEY ?? ""; }
function apiSecret(): string { return cfg().CLOUDINARY_API_SECRET ?? ""; }

function configured(): boolean {
  return Boolean(cfg().CLOUDINARY_CLOUD_NAME && cfg().CLOUDINARY_API_KEY && cfg().CLOUDINARY_API_SECRET);
}

export class CloudinaryProvider implements StorageProvider {
  async signUpload(req: SignRequest): Promise<{ url: string; params: Record<string, string | number | undefined> }> {
    const ts = Math.floor(Date.now() / 1000);
    const folder = req.folderId ? `folder_${req.folderId}` : undefined;
    const publicId = req.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const paramsToSign: Record<string, string | number> = { timestamp: ts };
    if (folder) paramsToSign.folder = folder;
    paramsToSign.public_id = publicId;
    // sort params
    const sortedKeys = Object.keys(paramsToSign).sort();
    const toSign = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join("&");
    const signature = await sha1(toSign + (apiSecret() || ""));
    return {
      url: `https://api.cloudinary.com/v1_1/${cloudName()}/image/upload`,
      params: { timestamp: ts, signature, apiKey: apiKey(), cloudName: cloudName(), folder, publicId },
    };
  }

  async verifyAsset(providerKey: string): Promise<{ exists: boolean; width?: number; height?: number; mime?: string; sizeBytes?: number }> {
    // Fail closed: never report an asset as existing when we could not
    // actually check. Callers (confirm/replace) depend on this to enforce
    // the signed-upload trust boundary. Local dev without credentials can
    // set CLOUDINARY_ALLOW_UNVERIFIED=true to skip verification explicitly
    // (mirrors the CLOUDINARY_ALLOW_SVG pattern), but never in production.
    if (!configured()) {
      if (process.env.CLOUDINARY_ALLOW_UNVERIFIED === "true") {
        console.warn("[cloudinary] verify skipped: unconfigured provider + CLOUDINARY_ALLOW_UNVERIFIED=true");
        return { exists: true };
      }
      throw new Error("STORAGE_NOT_CONFIGURED");
    }
    const fetcher = (globalThis as { fetch?: (...a: unknown[]) => Promise<{ ok: boolean; headers: { get: (k: string) => string | null } }> }).fetch;
    if (!fetcher) throw new Error("PROVIDER_VERIFY_FAILED: fetch unavailable");
    try {
      const res = await fetcher(`https://res.cloudinary.com/${cloudName()}/image/upload/${encodeURIComponent(providerKey)}`, { method: "HEAD" }) as { ok: boolean; headers: { get: (k: string) => string | null } };
      if (!res.ok) return { exists: false };
      const mime = res.headers.get("content-type") ?? undefined;
      const sizeBytes = Number(res.headers.get("content-length") ?? 0) || undefined;
      const out: { exists: boolean; width?: number; height?: number; mime?: string; sizeBytes?: number } = { exists: true };
      if (mime) out.mime = mime;
      if (sizeBytes) out.sizeBytes = sizeBytes;
      return out;
    } catch (e) {
      throw new Error(`PROVIDER_VERIFY_FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  transformUrl(providerKey: string, opts: { preset?: string; w?: number; h?: number; q?: string | number; format?: string }, _cloudName?: string): string {
    const cloud = cloudName();
    const presetW: Record<string, number | undefined> = { thumb: 150, card: 600, hero: 1600, original: undefined };
    let w = opts.w;
    let h = opts.h;
    const q = opts.q;
    const format = opts.format;
    if (opts.preset && opts.preset in presetW && w === undefined) {
      w = presetW[opts.preset];
    }
    const transforms: string[] = [];
    if (w) transforms.push(`w_${w}`);
    if (h) transforms.push(`h_${h}`);
    if (q) transforms.push(`q_${q}`);
    if (format) transforms.push(`f_${format}`);
    if (!q && !format) {
      // defaults
      transforms.push("f_auto", "q_auto");
    } else {
      if (!format) transforms.push("f_auto");
      if (!q) transforms.push("q_auto");
    }
    const t = transforms.join(",");
    return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${providerKey}`;
  }

  async destroy(providerKey: string): Promise<void> {
    if (!configured()) throw new Error("STORAGE_NOT_CONFIGURED");
    const fetcher = (globalThis as { fetch?: (...a: unknown[]) => Promise<{ ok: boolean; text?: () => Promise<string> }> }).fetch;
    if (!fetcher) throw new Error("PROVIDER_DESTROY_FAILED: fetch unavailable");
    // Cloudinary destroy requires a signed request: sign the request
    // the same way signUpload does (sorted params + api secret).
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${providerKey}&timestamp=${timestamp}${apiSecret()}`;
    const signature = await sha1(toSign);
    let res;
    try {
      res = await fetcher(`https://api.cloudinary.com/v1_1/${cloudName()}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `public_id=${encodeURIComponent(providerKey)}&api_key=${encodeURIComponent(apiKey())}&timestamp=${timestamp}&signature=${signature}`,
      });
    } catch (e) {
      throw new Error(`PROVIDER_DESTROY_FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) {
      const detail = typeof res.text === "function" ? await res.text().catch(() => "") : "";
      throw new Error(`PROVIDER_DESTROY_FAILED: ${detail}`.trim());
    }
  }
}

async function sha1(input: string): Promise<string> {
  return createHash("sha1").update(input).digest("hex");
}
