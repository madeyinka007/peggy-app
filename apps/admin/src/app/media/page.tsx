"use client";

/**
 * Media library (T024/US2). Search param `folder`. Folder tree/breadcrumb
 * with create/rename/move/delete + recursive-delete confirmation; asset grid
 * with server `page`/`pageSize` and search; asset update (folder move /
 * alt / caption, `media.manage`); delete → 409 MEDIA_REFERENCED dialog
 * listing `references[]` with the force path gated on `media.manage`;
 * large-folder pagination per the API clamp.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorState, EmptyState, LoadingState } from "@/components/ErrorState";
import { RouteGuard } from "@/components/RouteGuard";
import { UploadDropzone } from "@/components/UploadDropzone";
import {
  createFolder,
  deleteAsset,
  deleteFolder,
  listAssets,
  listFolders,
  updateAsset,
  updateFolder,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { MediaAsset, MediaFolder } from "@/lib/types";
import { isUnauthorized } from "@/lib/types";

const LIBRARY_PAGE_SIZE = 25;

function humanDeleteError(err: unknown): { message: string; references: unknown[] | null } {
  if (typeof err !== "object" || err === null) {
    return { message: err instanceof Error ? err.message : "Delete failed.", references: null };
  }
  const e = err as { code?: unknown; message?: unknown; references?: unknown };
  if (e.code === "MEDIA_REFERENCED") {
    return {
      message: typeof e.message === "string" ? e.message : "Asset is referenced by documents.",
      references: Array.isArray(e.references) ? e.references : null,
    };
  }
  return { message: typeof e.message === "string" ? e.message : "Delete failed.", references: null };
}

/** FR-009 human messages for folder-constraint failures (server codes FOLDER_*). */
function humanFolderError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (code === "FOLDER_DEPTH_EXCEEDED") {
      return "Folder nesting is too deep — choose a shallower parent folder.";
    }
    if (code === "FOLDER_CYCLE") {
      return "A folder cannot be moved inside itself or one of its children.";
    }
    if (code === "FOLDER_NAME_INVALID") {
      return "Folder names must be 1–64 characters with no slashes.";
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return err instanceof Error ? err.message : fallback;
}

interface DeleteTarget {
  asset: MediaAsset;
  references: unknown[] | null;
  message: string;
}

function MediaLibraryInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can, stashDraft, takeDraft } = useAuth();
  const canManage = can("media.manage");

  const folder = params.get("folder");
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [allFolders, setAllFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [folderError, setFolderError] = useState<unknown>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState("__root");
  const [newFolderName, setNewFolderName] = useState("");
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editFolder, setEditFolder] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [childFolders, rootFolders, assetRes] = await Promise.all([
        listFolders(folder ?? null),
        listFolders(null),
        listAssets({
          ...(folder ? { folderId: folder } : {}),
          ...(q ? { q } : {}),
          page,
          pageSize: LIBRARY_PAGE_SIZE,
        }),
      ]);
      setFolders(childFolders.data);
      // Flat folder list for the move targets: root + current children.
      const seen = new Map<string, MediaFolder>();
      for (const f of [...rootFolders.data, ...childFolders.data]) seen.set(f.id, f);
      setAllFolders([...seen.values()]);
      setAssets(assetRes.data.filter((a) => !a.deletedAt));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [folder, page, q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // R-07: restore inputs stashed when a 401 interrupted editing.
  useEffect(() => {
    const stashed = takeDraft("media:inputs") as
      | { newFolderName?: string; renameValue?: string; editAlt?: string; editCaption?: string }
      | undefined;
    if (!stashed) return;
    if (typeof stashed.newFolderName === "string") setNewFolderName(stashed.newFolderName);
    if (typeof stashed.renameValue === "string") setRenameValue(stashed.renameValue);
    if (typeof stashed.editAlt === "string") setEditAlt(stashed.editAlt);
    if (typeof stashed.editCaption === "string") setEditCaption(stashed.editCaption);
    // takeDraft is a one-shot resume; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setParam(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setPage(1);
    router.replace(`/media/?${next.toString()}`);
  }

  /** R-07: stash in-progress inputs and redirect to login with return-to. */
  function redirectOnUnauthorized() {
    stashDraft("media:inputs", { newFolderName, renameValue, editAlt, editCaption });
    const returnTo = `/media/?${params.toString()}`;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function onCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderBusy(true);
    setFolderError(null);
    try {
      await createFolder(name, folder);
      setNewFolderName("");
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      setFolderError(humanFolderError(e, "Could not create folder."));
    } finally {
      setFolderBusy(false);
    }
  }

  async function onRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setFolderBusy(true);
    setFolderError(null);
    try {
      await updateFolder(id, { name });
      setRenaming(null);
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      setFolderError(humanFolderError(e, "Could not rename folder."));
    } finally {
      setFolderBusy(false);
    }
  }

  /** T031: reparent a folder via PATCH parentId; server enforces depth/cycle. */
  async function onMoveFolder(id: string) {
    const parentId = moveTarget === "__root" ? null : moveTarget;
    if (parentId === id) {
      setFolderError("A folder cannot be moved inside itself.");
      return;
    }
    setFolderBusy(true);
    setFolderError(null);
    try {
      await updateFolder(id, { parentId });
      setMoving(null);
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      setFolderError(humanFolderError(e, "Could not move folder."));
    } finally {
      setFolderBusy(false);
    }
  }

  async function onDeleteFolder(id: string, name: string, recursive: boolean) {
    const confirmed = window.confirm(
      recursive
        ? `Delete folder “${name}” and everything inside it? This cannot be undone.`
        : `Delete folder “${name}”? It must be empty.`,
    );
    if (!confirmed) return;
    setFolderBusy(true);
    setFolderError(null);
    try {
      await deleteFolder(id, recursive);
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      setFolderError(humanFolderError(e, "Could not delete folder."));
    } finally {
      setFolderBusy(false);
    }
  }

  async function onDeleteAsset(asset: MediaAsset, force: boolean) {
    if (force) setForceDeleting(true);
    try {
      await deleteAsset(asset.id, force);
      setDeleting(null);
      setForceDeleting(false);
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      const { message, references } = humanDeleteError(e);
      setDeleting({ asset, references, message });
      setForceDeleting(false);
    }
  }

  async function onSaveEdit() {
    if (!editing) return;
    try {
      const folderId: string | null | undefined =
        editFolder === "__root" ? null : editFolder === "" ? undefined : editFolder;
      const patch: { folderId?: string | null; alt?: string; caption?: string } = {
        alt: editAlt,
        caption: editCaption,
      };
      if (folderId !== undefined) patch.folderId = folderId;
      await updateAsset(editing.id, patch);
      setEditing(null);
      await refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        redirectOnUnauthorized();
        return;
      }
      setError(e);
    }
  }

  const crumb: Array<{ id: string | null; name: string }> = [{ id: null, name: "Root" }];
  if (folder) {
    const current = allFolders.find((f) => f.id === folder);
    if (current) crumb.push({ id: current.id, name: current.name });
  }

  return (
    <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
      <h1>Media library</h1>

      <nav aria-label="Folder breadcrumb" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {crumb.map((c, i) => (
          <span key={c.id ?? "root"}>
            {i > 0 ? " / " : null}
            <button
              type="button"
              onClick={() => setParam({ folder: c.id })}
              style={{ cursor: "pointer", fontWeight: i === crumb.length - 1 ? 700 : 400 }}
            >
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      <section aria-label="Folders" style={{ marginBottom: "1rem" }}>
        <h2>Folders</h2>
        {folderError ? (
          <ErrorState error={folderError} onRetry={() => { setFolderError(null); void refresh(); }} />
        ) : null}
        <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {folders.map((f) => (
            <li key={f.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem" }}>
              {renaming === f.id ? (
                <span>
                  <input
                    aria-label={`Rename ${f.name}`}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    style={{ padding: "0.3rem" }}
                  />{" "}
                  <button type="button" disabled={folderBusy} onClick={() => void onRename(f.id)} style={{ cursor: "pointer" }}>
                    Save
                  </button>{" "}
                  <button type="button" onClick={() => setRenaming(null)} style={{ cursor: "pointer" }}>
                    Cancel
                  </button>
                </span>
              ) : moving === f.id ? (
                <span>
                  <label>
                    Move “{f.name}” to{" "}
                    <select
                      aria-label={`Move ${f.name} to folder`}
                      value={moveTarget}
                      onChange={(e) => setMoveTarget(e.target.value)}
                      style={{ padding: "0.3rem" }}
                    >
                      <option value="__root">Root (no parent)</option>
                      {allFolders
                        .filter((t) => t.id !== f.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>{" "}
                  <button type="button" disabled={folderBusy} onClick={() => void onMoveFolder(f.id)} style={{ cursor: "pointer" }}>
                    Move
                  </button>{" "}
                  <button type="button" onClick={() => setMoving(null)} style={{ cursor: "pointer" }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span>
                  <button type="button" onClick={() => setParam({ folder: f.id })} style={{ cursor: "pointer", fontWeight: 600 }}>
                    {f.name}
                  </button>{" "}
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(f.id);
                          setRenameValue(f.name);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        Rename
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMoving(f.id);
                          setMoveTarget(f.parentId ?? "__root");
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        Move
                      </button>{" "}
                      <button type="button" onClick={() => void onDeleteFolder(f.id, f.name, false)} style={{ cursor: "pointer" }}>
                        Delete
                      </button>{" "}
                      <button
                        type="button"
                        title="Delete folder and everything inside it"
                        onClick={() => void onDeleteFolder(f.id, f.name, true)}
                        style={{ cursor: "pointer" }}
                      >
                        Delete recursively
                      </button>
                    </>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onCreateFolder();
            }}
            style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
          >
            <input
              aria-label="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              style={{ padding: "0.4rem" }}
            />
            <button type="submit" disabled={folderBusy || !newFolderName.trim()} style={{ cursor: "pointer" }}>
              Create folder
            </button>
          </form>
        ) : null}
      </section>

      <section aria-label="Upload" style={{ marginBottom: "1rem" }}>
        <h2>Upload</h2>
        <UploadDropzone folderId={folder} onDone={() => void refresh()} />
      </section>

      <section aria-label="Assets">
        <h2>Assets</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void refresh();
          }}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}
        >
          <input
            aria-label="Search assets"
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
          <LoadingState label="Loading assets…" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refresh()} />
        ) : assets.length === 0 ? (
          <EmptyState title="No assets here yet." hint="Upload a file above to get started." />
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              {assets.map((a) => {
                const thumb = a.transformUrls?.thumb ?? a.transformUrls?.card ?? null;
                return (
                  <li key={a.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem" }}>
                    {thumb ? (
                      <img src={thumb} alt={a.alt ?? a.providerKey} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 4, background: "#f0f0f0" }} />
                    ) : (
                      <div
                        role="img"
                        aria-label={a.alt ?? a.providerKey}
                        style={{ width: "100%", height: 110, borderRadius: 4, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#666", padding: "0.25rem", textAlign: "center", overflow: "hidden" }}
                      >
                        {a.providerKey}
                      </div>
                    )}
                    <p style={{ fontSize: "0.8rem", margin: "0.4rem 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.alt ?? a.providerKey}
                    </p>
                    {canManage ? (
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(a);
                            setEditAlt(a.alt ?? "");
                            setEditCaption(a.caption ?? "");
                            setEditFolder(a.folderId ?? "__root");
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleting({ asset: a, references: null, message: `Delete “${a.alt ?? a.providerKey}”?` })} style={{ cursor: "pointer" }}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem" }}>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} style={{ cursor: "pointer" }}>
                Previous
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                disabled={assets.length < LIBRARY_PAGE_SIZE || loading}
                onClick={() => setPage(page + 1)}
                style={{ cursor: "pointer" }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {deleting ? (
        <div role="dialog" aria-modal="true" aria-label="Delete asset" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "1rem", width: "min(480px, 92vw)" }}>
            <h2 style={{ marginTop: 0 }}>Delete asset</h2>
            <p>{deleting.message}</p>
            {deleting.references && deleting.references.length > 0 ? (
              <>
                <p>
                  <strong>Referenced by {deleting.references.length} document{deleting.references.length === 1 ? "" : "s"}:</strong>
                </p>
                <ul>
                  {deleting.references.slice(0, 10).map((r, i) => (
                    <li key={i} style={{ fontSize: "0.85rem" }}>
                      {typeof r === "string" ? r : JSON.stringify(r)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button type="button" onClick={() => setDeleting(null)} style={{ cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={() => void onDeleteAsset(deleting.asset, false)} style={{ cursor: "pointer" }}>
                Delete
              </button>
              {canManage && deleting.references ? (
                <button
                  type="button"
                  disabled={forceDeleting}
                  title="Force-delete despite references (requires media.manage)"
                  onClick={() => void onDeleteAsset(deleting.asset, true)}
                  style={{ cursor: "pointer" }}
                >
                  {forceDeleting ? "Force-deleting…" : "Force delete"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div role="dialog" aria-modal="true" aria-label="Edit asset" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "1rem", width: "min(480px, 92vw)" }}>
            <h2 style={{ marginTop: 0 }}>Edit asset</h2>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Alt text
              <input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }} />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Caption
              <input value={editCaption} onChange={(e) => setEditCaption(e.target.value)} style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }} />
            </label>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              Folder
              <select value={editFolder} onChange={(e) => setEditFolder(e.target.value)} style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}>
                <option value="__root">Root (no folder)</option>
                {allFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => setEditing(null)} style={{ cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={() => void onSaveEdit()} style={{ cursor: "pointer" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function MediaPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RouteGuard>
        <MediaLibraryInner />
      </RouteGuard>
    </Suspense>
  );
}
