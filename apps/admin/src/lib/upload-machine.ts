"use client";

/**
 * Upload state machine + coded-error mapping (T022/US2).
 *
 * `idle → precheck → signing → uploading{progress%} → confirming → done |
 * failed{reason}`. The machine is UI-framework-free so the dropzone component
 * and its tests share the transition logic; the XHR byte transfer lives in
 * the component (fetch lacks upload progress).
 */
import type { ApiError } from "@/lib/types";

/** Client-side policy mirror (server: media-service.ts `allowedMime`/`maxForMime`). */
export const SVG_MIME = "image/svg+xml";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export function maxForMime(mime: string): number {
  if (mime.startsWith("image/")) return MAX_IMAGE_BYTES;
  if (mime.startsWith("video/")) return MAX_VIDEO_BYTES;
  if (mime === "application/pdf") return MAX_PDF_BYTES;
  if (mime.startsWith("audio/")) return MAX_AUDIO_BYTES;
  return MAX_IMAGE_BYTES;
}

export function allowedMime(mime: string): boolean {
  if (mime === SVG_MIME) return false;
  if (mime === "application/pdf") return true;
  return ["image/", "video/", "audio/"].some((p) => mime.startsWith(p));
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export interface PrecheckFailure {
  code: "SVG_REJECTED" | "MIME_NOT_ALLOWED" | "FILE_TOO_LARGE";
  message: string;
  limit?: number | undefined;
  received?: number | undefined;
}

/** Client pre-check: reject SVG and over-limit MIME/size before signing. */
export function precheckFile(file: { type: string; size: number; name: string }): PrecheckFailure | null {
  if (file.type === SVG_MIME) {
    return {
      code: "SVG_REJECTED",
      message: `“${file.name}” is an SVG file, which cannot be uploaded (active-content risk). Convert it to PNG first.`,
    };
  }
  if (!allowedMime(file.type || "")) {
    return {
      code: "MIME_NOT_ALLOWED",
      message: `“${file.name}” has an unsupported type (${file.type || "unknown"}). Upload images, video, audio, or PDF.`,
    };
  }
  const limit = maxForMime(file.type);
  if (file.size > limit) {
    return {
      code: "FILE_TOO_LARGE",
      message: `“${file.name}” is ${formatBytes(file.size)} — the limit for this type is ${formatBytes(limit)}.`,
      limit,
      received: file.size,
    };
  }
  return null;
}

/** FR-009 human messages for coded upload errors. */
export function humanUploadMessage(err: unknown): string {
  const fallback = err instanceof Error ? err.message : "Upload failed.";
  if (typeof err !== "object" || err === null) return fallback;
  const e = err as Partial<ApiError>;
  const status = e.status;
  const code = e.code;
  if (status === 413) {
    return "The file was too large for a direct request — use the signed upload flow (it chunks via the media library).";
  }
  switch (code) {
    case "FILE_TOO_LARGE": {
      const limit = typeof e.limit === "number" ? formatBytes(e.limit) : null;
      const received = typeof e.received === "number" ? formatBytes(e.received) : null;
      if (limit && received) return `File is too large: received ${received}, limit ${limit}.`;
      if (limit) return `File is too large: the limit is ${limit}.`;
      return "File is too large for this media type.";
    }
    case "MIME_NOT_ALLOWED":
      return "This file type is not allowed. Upload images, video, audio, or PDF (SVG is never allowed).";
    case "FOLDER_DEPTH_EXCEEDED":
      return "Folder nesting is too deep — choose a shallower parent folder.";
    case "FOLDER_CYCLE":
      return "A folder cannot be moved inside itself or one of its children.";
    case "FOLDER_NAME_INVALID":
      return "Folder names must be 1–64 characters with no slashes.";
    case "PROVIDER_KEY_CONFLICT":
      return "This image was already uploaded — pick it from the library instead of uploading again.";
    default:
      return e.message ?? fallback;
  }
}

export type UploadPhase =
  | "idle"
  | "precheck"
  | "signing"
  | "uploading"
  | "confirming"
  | "done"
  | "failed";

export interface UploadState {
  phase: UploadPhase;
  progress: number;
  fileName: string;
  reason?: string | undefined;
}

export const IDLE_UPLOAD: UploadState = { phase: "idle", progress: 0, fileName: "" };
