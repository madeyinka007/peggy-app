"use client";

/**
 * Content workspace (T019/US1). Search params: `contentType` / `doc` /
 * `locale`. Composes the type list, SchemaTable and SchemaForm; create mode
 * when `doc` is absent; re-fetches the type on save and warns on
 * `activeSchemaVersion` mismatch; a 404 on getDocument(id, locale) enters
 * the translation-missing state, not an error page; in-memory draft stash
 * survives 401 redirects (R-07).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "@/components/ErrorState";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PublishControls } from "@/components/PublishControls";
import { RouteGuard } from "@/components/RouteGuard";
import { SchemaForm } from "@/components/SchemaForm";
import { SchemaTable } from "@/components/SchemaTable";
import { useRegistry } from "@/hooks/useRegistry";
import {
  createDocument,
  getDocument,
  getContentType,
  listDocuments,
  updateDocument,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { isUnauthorized } from "@/lib/types";
import type { DocumentRow, DocumentStatus, RegistryView, WorkingSet } from "@/lib/types";

function statusOf(row: DocumentRow | null): DocumentStatus {
  if (!row) return "untranslated";
  return row.publishedVersionId != null ? "published" : "draft";
}

interface DocState {
  loading: boolean;
  error: unknown;
  row: DocumentRow | null;
  values: Record<string, unknown>;
  schemaVersionAtOpen: number;
  translationState: "present" | "missing";
}

const EMPTY: DocState = {
  loading: false,
  error: null,
  row: null,
  values: {},
  schemaVersionAtOpen: 0,
  translationState: "present",
};

function ContentInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can, stashDraft, takeDraft } = useAuth();
  const { types, components, locales, loading: registryLoading, error: registryError, reload: reloadRegistry, defaultLocale } = useRegistry();

  const contentTypeId = params.get("contentType");
  const docId = params.get("doc");
  const locale = params.get("locale") || defaultLocale;

  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<unknown>(null);
  const [doc, setDoc] = useState<DocState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<RegistryView | null>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [detailNonce, setDetailNonce] = useState(0);

  const type: RegistryView | undefined = useMemo(
    () => types.find((t) => t.id === contentTypeId || t.name === contentTypeId),
    [types, contentTypeId],
  );

  // Resolve the working type: the registry list rows lack fields, so fetch
  // the detail (fields + activeSchemaVersion) when selected. The list row
  // is intentionally NEVER assigned to currentType: rendering SchemaTable /
  // SchemaForm with a field-less row throws `type.fields is not iterable`.
  // A failed detail fetch leaves the previous type's fields stale-but-valid
  // and surfaces the error with a retry instead of corrupting the render.
  useEffect(() => {
    if (!contentTypeId) {
      setCurrentType(null);
      setDetailError(null);
      return;
    }
    let live = true;
    const selected = types.find((t) => t.id === contentTypeId || t.name === contentTypeId);
    if (selected?.fields?.length) {
      setCurrentType(selected);
      setDetailError(null);
      return;
    }
    setDetailError(null);
    getContentType(contentTypeId)
      .then((t) => {
        if (live) {
          setCurrentType(t);
          setDetailError(null);
        }
      })
      .catch((e) => {
        if (live) setDetailError(e);
      });
    return () => {
      live = false;
    };
    // detailNonce re-runs the fetch for the retry action; `type` is read
    // inside but must not reset an in-flight detail fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentTypeId, types, detailNonce]);

  const canPublish = can("document.publish");
  const showPublish = (currentType ?? type)?.hasDraftPublish !== false;

  function setParam(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`/content/?${next.toString()}`);
  }

  // List rows for the selected type + locale (R-05: unpaginated array).
  useEffect(() => {
    if (!contentTypeId) {
      setRows([]);
      return;
    }
    let live = true;
    setRowsLoading(true);
    setRowsError(null);
    listDocuments(contentTypeId, locale)
      .then((res) => {
        if (live) setRows(res.data);
      })
      .catch((e) => {
        if (live) setRowsError(e);
      })
      .finally(() => {
        if (live) setRowsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [contentTypeId, locale]);

  // Load the open document + locale version. A stashed post-401 draft
  // always wins over server values; otherwise a 404 (or an empty row) ⇒
  // translation-missing state (blank fields, "untranslated" badge), never
  // an error page.
  useEffect(() => {
    if (!docId || !contentTypeId) {
      setDoc(EMPTY);
      return;
    }
    let live = true;
    setDoc((d) => ({ ...d, loading: true, error: null }));
    const stashKey = `draft:${contentTypeId}:${docId ?? "new"}:${locale}`;
    const stashed = takeDraft(stashKey) as Record<string, unknown> | undefined;
    getDocument(docId, locale)
      .then((row) => {
        if (!live) return;
        setDoc({
          loading: false,
          error: null,
          row,
          values: stashed ?? { ...(row.data ?? {}) },
          schemaVersionAtOpen: (row as { schemaVersion?: number }).schemaVersion ?? 0,
          translationState: (stashed || row.data != null ? "present" : "missing") as WorkingSet["translationState"],
        });
      })
      .catch((e) => {
        if (!live) return;
        if (typeof e === "object" && e !== null && (e as { status?: number }).status === 404) {
          // Translation missing: blank translatable fields, never en values.
          setDoc({
            loading: false,
            error: null,
            row: null,
            values: stashed ?? {},
            schemaVersionAtOpen: 0,
            translationState: "missing",
          });
          return;
        }
        setDoc({ ...EMPTY, loading: false, error: e });
      });
    return () => {
      live = false;
    };
    // takeDraft is a one-shot resume; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, contentTypeId, locale]);

  const refreshRows = useCallback(() => {
    if (!contentTypeId) return;
    listDocuments(contentTypeId, locale)
      .then((res) => setRows(res.data))
      .catch((e) => setRowsError(e));
  }, [contentTypeId, locale]);

  async function onSave(values: Record<string, unknown>) {
    if (!contentTypeId) return;
    setSaving(true);
    setSaveError(null);
    setSchemaWarning(null);
    try {
      // Mid-edit schema check: re-fetch the type and compare
      // activeSchemaVersion against the snapshot at open.
      const fresh = await getContentType(contentTypeId);
      setCurrentType(fresh);
      if (doc.schemaVersionAtOpen && fresh.activeSchemaVersion !== doc.schemaVersionAtOpen) {
        setSchemaWarning(
          `The schema changed while you were editing (v${doc.schemaVersionAtOpen} → v${fresh.activeSchemaVersion}). ` +
            "Your input was kept — review the new fields before saving again.",
        );
        setSaving(false);
        return;
      }
      let saved: DocumentRow;
      if (!docId) {
        saved = await createDocument({ contentTypeId, locale, data: values });
        setParam({ doc: saved.id });
      } else if (doc.translationState === "missing") {
        // No locale row exists server-side (PUT would 404), so the first
        // save in a new locale goes through the create path.
        saved = await createDocument({ contentTypeId, locale, data: values });
        if (saved.id !== docId) setParam({ doc: saved.id });
      } else {
        saved = await updateDocument(docId, values, locale);
      }
      setDoc({
        loading: false,
        error: null,
        row: saved,
        values: { ...(saved.data ?? values) },
        schemaVersionAtOpen: fresh.activeSchemaVersion,
        translationState: "present",
      });
      refreshRows();
    } catch (e) {
      if (isUnauthorized(e)) {
        // R-07: stash the in-memory draft, redirect with return-to. The
        // load effect consumes the stash on return, so the key must match
        // the `draft:<ct>:<doc|new>:<locale>` shape read there.
        const key = `draft:${contentTypeId}:${docId ?? "new"}:${locale}`;
        stashDraft(key, values);
        const returnTo = `/content/?${params.toString()}`;
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      // Payload preserved: values stay in the form; error maps inline.
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  function onPublished(fresh: DocumentRow) {
    setDoc((d) => ({ ...d, row: fresh, values: { ...(fresh.data ?? d.values) } }));
    refreshRows();
  }

  if (registryLoading) return <LoadingState label="Loading registry…" />;
  if (registryError) return <ErrorState error={registryError} onRetry={reloadRegistry} />;

  // workingType is ONLY a detail row (fields present). The registry list row
  // (`type`) never renders: it lacks `fields`, and spreading it into
  // SchemaTable/SchemaForm throws `type.fields is not iterable`.
  const selectionKnown = type ?? null;
  const currentMatches =
    currentType && (currentType.id === contentTypeId || currentType.name === contentTypeId)
      ? currentType
      : null;
  const workingType = currentMatches;
  const activeId = docId ?? doc.row?.id ?? null;
  const status = statusOf(doc.row);

  return (
    <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
      <h1>Content</h1>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label htmlFor="content-type-select">Content type</label>
        <select
          id="content-type-select"
          value={contentTypeId ?? ""}
          onChange={(e) => setParam({ contentType: e.target.value || null, doc: null })}
        >
          <option value="">— Select —</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName ?? t.name}
            </option>
          ))}
        </select>
        {workingType ? (
          <LocaleSwitcher
            locales={locales}
            value={locale}
            onChange={(code) => setParam({ locale: code })}
            translationState={docId ? doc.translationState : undefined}
          />
        ) : null}
      </div>

      {!contentTypeId ? (
        <p style={{ color: "#555" }}>Select a content type to list and edit documents.</p>
      ) : !selectionKnown ? (
        <ErrorState error={new Error(`Unknown content type "${contentTypeId}".`)} />
      ) : detailError && !workingType ? (
        <ErrorState error={detailError} onRetry={() => setDetailNonce((n) => n + 1)} />
      ) : !workingType ? (
        <LoadingState label="Loading schema…" />
      ) : (
        <>
          {workingType.kind === "single" ? (
            <p style={{ color: "#555" }}>Singleton type — the editor below edits its single entry.</p>
          ) : rowsLoading ? (
            <LoadingState label="Loading documents…" />
          ) : rowsError ? (
            <ErrorState error={rowsError} onRetry={refreshRows} />
          ) : (
            <SchemaTable
              type={workingType}
              rows={rows}
              locale={locale}
              selectedId={activeId}
              onSelect={(row) => setParam({ doc: row.id })}
            />
          )}

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", margin: "1rem 0" }}>
            <button type="button" onClick={() => setParam({ doc: null })} style={{ cursor: "pointer" }}>
              New document
            </button>
            {activeId && showPublish ? (
              <PublishControls
                documentId={activeId}
                locale={locale}
                status={status}
                canPublish={canPublish}
                onChanged={onPublished}
              />
            ) : null}
          </div>

          {doc.loading ? (
            <LoadingState label="Loading document…" />
          ) : doc.error ? (
            <ErrorState
              error={doc.error}
              onRetry={() => setParam({ doc: docId })}
            />
          ) : docId || activeId || rows.length >= 0 ? (
            <>
              {schemaWarning ? (
                <p role="alert" style={{ border: "1px solid #a60", borderRadius: 6, padding: "0.75rem", color: "#7a4d00" }}>
                  {schemaWarning}
                </p>
              ) : null}
              <SchemaForm
                type={workingType}
                initialValues={doc.values}
                translationMissing={docId ? doc.translationState === "missing" : false}
                saving={saving}
                saveError={saveError}
                ctx={{ components }}
                onSubmit={(v) => void onSave(v)}
              />
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RouteGuard>
        <ContentInner />
      </RouteGuard>
    </Suspense>
  );
}
