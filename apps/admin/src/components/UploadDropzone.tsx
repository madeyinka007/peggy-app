"use client";

/**
 * Signed-upload dropzone (T022/US2). XHR state machine
 * `idle → precheck → signing → uploading{progress%} → confirming → done |
 * failed{reason}`: client pre-check (SVG + MIME/size) → `POST /media/sign`
 * → multipart POST of bytes to `url` with `params` fields via XHR (progress
 * events — fetch lacks upload progress) → `POST /media` confirm. FR-009
 * human messages for coded errors.
 */
import { useCallback, useRef, useState } from "react";
import { confirmUpload, signUpload } from "@/lib/api-client";
import {
  IDLE_UPLOAD,
  humanUploadMessage,
  precheckFile,
} from "@/lib/upload-machine";
import type { UploadState } from "@/lib/upload-machine";
import type { MediaAsset } from "@/lib/types";

export interface UploadDropzoneProps {
  folderId?: string | null | undefined;
  alt?: string | undefined;
  onDone?: ((asset: MediaAsset) => void) | undefined;
}

export function UploadDropzone({ folderId, alt, onDone }: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>(IDLE_UPLOAD);
  const inputRef = useRef<HTMLInputElement>(null);

  const putBytes = useCallback(
    (url: string, params: Record<string, string | number | undefined>, file: File) =>
      new Promise<unknown>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setState((s) => ({ ...s, phase: "uploading", progress: Math.round((ev.loaded / ev.total) * 100) }));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({});
            }
          } else {
            reject(new Error(`Provider upload failed with status ${xhr.status}.`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during provider upload."));
        const form = new FormData();
        // Cloudinary wire names differ from the API's camelCase contract:
        // apiKey→api_key, publicId→public_id; cloudName rides in the URL,
        // not the form (an unknown field breaks signature verification).
        const wireName = (k: string): string | null => {
          if (k === "apiKey") return "api_key";
          if (k === "publicId") return "public_id";
          if (k === "cloudName") return null;
          return k;
        };
        for (const [k, v] of Object.entries(params)) {
          if (v === undefined) continue;
          const w = wireName(k);
          if (w) form.append(w, String(v));
        }
        form.append("file", file);
        xhr.send(form);
      }),
    [],
  );

  const run = useCallback(
    async (file: File) => {
      setState({ phase: "precheck", progress: 0, fileName: file.name });
      const blocked = precheckFile({ type: file.type, size: file.size, name: file.name });
      if (blocked) {
        setState({ phase: "failed", progress: 0, fileName: file.name, reason: blocked.message });
        return;
      }
      try {
        setState((s) => ({ ...s, phase: "signing" }));
        const signed = await signUpload({
          filename: file.name,
          mime: file.type,
          sizeBytes: file.size,
          ...(folderId ? { folderId } : {}),
        });
        setState((s) => ({ ...s, phase: "uploading", progress: 0 }));
        const providerRes = (await putBytes(signed.url, signed.params, file)) as {
          public_id?: string;
          secure_url?: string;
        };
        setState((s) => ({ ...s, phase: "confirming", progress: 100 }));
        const asset = await confirmUpload({
          providerKey: providerRes.public_id ?? file.name,
          mime: file.type,
          sizeBytes: file.size,
          ...(folderId ? { folderId } : {}),
          ...(alt ? { alt } : {}),
        });
        setState({ phase: "done", progress: 100, fileName: file.name });
        onDone?.(asset);
      } catch (e) {
        setState({ phase: "failed", progress: 0, fileName: file.name, reason: humanUploadMessage(e) });
      }
    },
    [folderId, alt, onDone, putBytes],
  );

  const busy = state.phase === "precheck" || state.phase === "signing" || state.phase === "uploading" || state.phase === "confirming";

  return (
    <div
      style={{ border: "2px dashed #999", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && !busy) void run(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        aria-label="Choose a file to upload"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(f);
          e.target.value = "";
        }}
      />
      <p role="status" style={{ color: "#555" }}>
        {state.phase === "idle" && "Drop a file here or choose one to upload."}
        {state.phase === "precheck" && `Checking “${state.fileName}”…`}
        {state.phase === "signing" && `Signing upload for “${state.fileName}”…`}
        {state.phase === "uploading" && `Uploading “${state.fileName}”… ${state.progress}%`}
        {state.phase === "confirming" && `Confirming “${state.fileName}”…`}
        {state.phase === "done" && `Uploaded “${state.fileName}”.`}
        {state.phase === "failed" && `Upload failed.`}
      </p>
      {state.phase === "uploading" ? (
        <progress value={state.progress} max={100} style={{ width: "100%" }} aria-label="Upload progress" />
      ) : null}
      {state.phase === "failed" && state.reason ? (
        <p role="alert" style={{ color: "#900" }}>
          {state.reason}
        </p>
      ) : null}
      {state.phase === "done" ? (
        <button type="button" onClick={() => setState(IDLE_UPLOAD)} style={{ cursor: "pointer" }}>
          Upload another
        </button>
      ) : null}
    </div>
  );
}
