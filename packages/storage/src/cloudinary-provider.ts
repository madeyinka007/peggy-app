import { parseConfig } from "@peggy/config";

function cfg() {
  return parseConfig();
}

function cloudName(): string { return cfg().CLOUDINARY_CLOUD_NAME ?? "demo"; }
function apiKey(): string { return cfg().CLOUDINARY_API_KEY ?? ""; }
function apiSecret(): string { return cfg().CLOUDINARY_API_SECRET ?? ""; }

function configured(): boolean {
  return Boolean(cfg().CLOUDINARY_CLOUD_NAME && cfg().CLOUDINARY_API_KEY && cfg().CLOUDINARY_API_SECRET);
}

export class CloudinaryProvider {
  async signUpload(req: { filename: string; mime: string; sizeBytes: number; folderId?: string }): Promise<{ url: string; params: Record<string, string | number | undefined> }> {
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
    if (!configured()) return { exists: true };
    try {
      const fetcher = (globalThis as { fetch?: (...a: unknown[]) => Promise<{ ok: boolean; headers: { get: (k: string) => string | null } }> }).fetch;
      if (!fetcher) return { exists: true };
      const res = await fetcher(`https://res.cloudinary.com/${cloudName()}/image/upload/${providerKey}`, { method: "HEAD" }) as { ok: boolean; headers: { get: (k: string) => string | null } };
      if (!res.ok) return { exists: false };
      const mime = res.headers.get("content-type") ?? undefined;
      const sizeBytes = Number(res.headers.get("content-length") ?? 0) || undefined;
      const out: { exists: boolean; width?: number; height?: number; mime?: string; sizeBytes?: number } = { exists: true };
      if (mime) out.mime = mime;
      if (sizeBytes) out.sizeBytes = sizeBytes;
      return out;
    } catch {
      return { exists: true };
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
    if (!configured()) return;
    try {
      const fetcher2 = (globalThis as { fetch?: (...a: unknown[]) => Promise<{ ok: boolean; headers: { get: (k: string) => string | null } }> }).fetch;
      if (fetcher2) await fetcher2(`https://api.cloudinary.com/v1_1/${cloudName()}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `public_id=${encodeURIComponent(providerKey)}&api_key=${apiKey()}&timestamp=${Math.floor(Date.now() / 1000)}`,
      });
    } catch {
      // fire-and-forget
    }
  }
}

async function sha1(input: string): Promise<string> {
  const crypto = (await (new Function("return import(\"node:crypto\")")() as Promise<Record<string, unknown>>)) as { createHash: (a: string) => { update: (s: string) => void; digest: (e: string) => string } };
  const h = crypto.createHash("sha1");
  h.update(input);
  return h.digest("hex");
}
