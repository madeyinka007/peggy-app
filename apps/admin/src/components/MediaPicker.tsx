"use client";

/**
 * Media picker modal (T023/US2). Folder browse + asset grid with server
 * pagination (`pageSize ≤ 100`) + `q` search; broken-thumbnail state for
 * provider-missing assets showing the name, not a crash. Select returns the
 * asset reference + thumbnail.
 */
import { useCallback, useEffect, useState } from "react";
import { LoadingState } from "./ErrorState";
import { listAssets, listFolders } from "@/lib/api-client";
import type { MediaAsset, MediaFolder, MediaSelection } from "@/lib/types";

export const PICKER_PAGE_SIZE = 50;

export interface MediaPickerProps {
  open: boolean;
  folderId?: string | null | undefined;
  onSelect: (sel: MediaSelection) => void;
  onClose: () => void;
}

function thumbOf(asset: MediaAsset): string | null {
  return asset.transformUrls?.thumb ?? asset.transformUrls?.card ?? null;
}

export function MediaPicker({ open, folderId, onSelect, onClose }: MediaPickerProps) {
  const [folder, setFolder] = useState<string | null | undefined>(folderId ?? null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const load = useCallback(async (f: string | null | undefined, p: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const [folderRes, assetRes] = await Promise.all([
        listFolders(f ?? null),
        listAssets({
          ...(f ? { folderId: f } : {}),
          ...(query ? { q: query } : {}),
          page: p,
          pageSize: PICKER_PAGE_SIZE,
        }),
      ]);
      setFolders(folderRes.data);
      setAssets(assetRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setFolder(folderId ?? null);
    setPage(1);
    setQ("");
    setBroken({});
    void load(folderId ?? null, 1, "");
  }, [open, folderId, load]);

  useEffect(() => {
    if (!open) return;
    void load(folder, page, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, page]);

  if (!open) return null;

  const pageSize = PICKER_PAGE_SIZE;
  const hasMore = assets.length === pageSize;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose media"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 8, padding: "1rem", width: "min(720px, 92vw)", maxHeight: "86vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Choose media</h2>
          <button type="button" onClick={onClose} aria-label="Close picker" style={{ cursor: "pointer" }}>
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => { setFolder(null); setPage(1); }} style={{ cursor: "pointer", fontWeight: folder === null ? 700 : 400 }}>
            All files
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFolder(f.id); setPage(1); }}
              style={{ cursor: "pointer", fontWeight: folder === f.id ? 700 : 400 }}
            >
              {f.name}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load(folder, 1, q);
          }}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}
        >
          <input
            aria-label="Search media"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            style={{ flex: 1, padding: "0.4rem" }}
          />
          <button type="submit" style={{ cursor: "pointer" }}>
            Search
          </button>
        </form>
        {loading ? (
          <LoadingState label="Loading media…" />
        ) : error ? (
          <p role="alert" style={{ color: "#900" }}>
            {error}{" "}
            <button type="button" onClick={() => void load(folder, page, q)} style={{ cursor: "pointer" }}>
              Retry
            </button>
          </p>
        ) : assets.length === 0 ? (
          <p style={{ color: "#555" }}>No assets here yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {assets.map((a) => {
              const thumb = thumbOf(a);
              const isBroken = broken[a.id];
              return (
                <li key={a.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem" }}>
                  {thumb && !isBroken ? (
                    <img
                      src={thumb}
                      alt={a.alt ?? a.providerKey}
                      style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4, background: "#f0f0f0" }}
                      onError={() => setBroken((b) => ({ ...b, [a.id]: true }))}
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={isBroken ? `Thumbnail unavailable for ${a.providerKey}` : a.alt ?? a.providerKey}
                      style={{ width: "100%", height: 90, borderRadius: 4, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#666", padding: "0.25rem", textAlign: "center", overflow: "hidden" }}
                    >
                      {a.providerKey}
                    </div>
                  )}
                  <p style={{ fontSize: "0.8rem", margin: "0.4rem 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.alt ?? a.providerKey}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelect({ assetId: a.id, providerKey: a.providerKey, thumbnailUrl: thumb, mime: a.mime })}
                    style={{ cursor: "pointer", width: "100%" }}
                  >
                    Select
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem" }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} style={{ cursor: "pointer" }}>
            Previous
          </button>
          <span>Page {page}</span>
          <button type="button" disabled={!hasMore || loading} onClick={() => setPage(page + 1)} style={{ cursor: "pointer" }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
