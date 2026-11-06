"use client";

/**
 * Content-type read views (T027/US3). Read-only registry browser: list of
 * collections/singles/components plus a per-type field table (name / type /
 * required / localized / unique flags), relations with on-delete policies,
 * draft-publish and i18n toggles, and schema version. All rendered from
 * `GET /api/v1/content-types[/:id]` + `GET /api/v1/components` at visit time
 * — refetch on every visit so registry edits appear with no rebuild.
 * Gated on section permission per the US4 guard.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorState, EmptyState, LoadingState } from "@/components/ErrorState";
import { RouteGuard } from "@/components/RouteGuard";
import { getContentType, listComponents, listContentTypes } from "@/lib/api-client";
import type { RegistryComponent, RegistryField, RegistryView } from "@/lib/types";

function flag(v: boolean): string {
  return v ? "Yes" : "—";
}

/** Relation target + on-delete policy from the free-form relationConfig. */
function relationDetail(field: RegistryField): string {
  const cfg = (field.relationConfig ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["target", "targetContentType", "targetType", "type"]) {
    if (typeof cfg[key] === "string" && cfg[key]) {
      parts.push(`target: ${cfg[key]}`);
      break;
    }
  }
  for (const key of ["onDelete", "on_delete", "deletePolicy"]) {
    if (typeof cfg[key] === "string" && cfg[key]) {
      parts.push(`on delete: ${cfg[key]}`);
      break;
    }
  }
  if (parts.length === 0 && Object.keys(cfg).length > 0) {
    try {
      return JSON.stringify(cfg);
    } catch {
      return "relation";
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "relation";
}

function configDetail(label: string, cfg: Record<string, unknown> | null): string | null {  if (!cfg || Object.keys(cfg).length === 0) return null;
  const idKeys = ["componentId", "component", "components", "allowedComponents"];
  for (const k of idKeys) {
    const v = cfg[k];
    if (typeof v === "string" && v) return `${label}: ${v}`;
    if (Array.isArray(v) && v.length > 0) return `${label}: ${v.join(", ")}`;
  }
  try {
    return `${label}: ${JSON.stringify(cfg)}`;
  } catch {
    return label;
  }
}

function enumDetail(field: RegistryField): string | null {
  const v = (field.validation ?? {}) as Record<string, unknown>;
  const opts = Array.isArray(v.options) ? v.options : Array.isArray(v.enum) ? v.enum : null;
  if (!opts) return null;
  return `options: ${opts.map(String).join(", ")}`;
}

/** One-line detail for the field table: relation policy, component/media refs, or enum options. */
function fieldDetail(f: RegistryField): string {
  if (f.fieldType === "relation") return relationDetail(f);
  if (f.fieldType === "enumeration") return enumDetail(f) ?? "—";
  return (
    configDetail("component", (f.componentConfig ?? {}) as Record<string, unknown>) ??
    configDetail("allowed", (f.dynamiczoneConfig ?? {}) as Record<string, unknown>) ??
    configDetail("media", (f.mediaConfig ?? {}) as Record<string, unknown>) ??
    "—"
  );
}

function FieldTable({ fields }: { fields: RegistryField[] }) {
  const ordered = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length === 0) return <p style={{ color: "#555" }}>No fields defined.</p>;
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          {["Name", "Type", "Required", "Localized", "Unique", "Details"].map((h) => (
            <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ordered.map((f) => {
          return (
            <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.4rem" }}>
                {f.label ?? f.name}
                {f.label ? <span style={{ color: "#777" }}> ({f.name})</span> : null}
              </td>
              <td style={{ padding: "0.4rem" }}>
                <code>{f.fieldType}</code>
              </td>
              <td style={{ padding: "0.4rem" }}>{flag(f.required)}</td>
              <td style={{ padding: "0.4rem" }}>{flag(f.localized)}</td>
              <td style={{ padding: "0.4rem" }}>{f.uniqueScope ?? "—"}</td>
              <td style={{ padding: "0.4rem", fontSize: "0.9rem" }}>{fieldDetail(f)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TypeDetail({ entry }: { entry: { kind: string; type: RegistryView } }) {
  const { type } = entry;
  return (
    <section aria-label="Type detail" style={{ marginTop: "1rem" }}>
      <h2>
        {type.displayName ?? type.name}{" "}
        <span style={{ fontWeight: 400, fontSize: "0.9rem", color: "#555" }}>({type.kind})</span>
      </h2>
      {type.description ? <p style={{ color: "#555" }}>{type.description}</p> : null}
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1rem", maxWidth: 480 }}>
        <dt>Slug</dt>
        <dd style={{ margin: 0 }}>
          <code>{type.collectionSlug}</code>
        </dd>
        <dt>Draft &amp; publish</dt>
        <dd style={{ margin: 0 }}>{type.hasDraftPublish ? "Enabled" : "Disabled"}</dd>
        <dt>Localized (i18n)</dt>
        <dd style={{ margin: 0 }}>{type.isLocalized ? "Yes" : "No"}</dd>
        <dt>Schema version</dt>
        <dd style={{ margin: 0 }}>v{type.activeSchemaVersion}</dd>
      </dl>
      <h3>Fields ({type.fields.length})</h3>
      <FieldTable fields={type.fields} />
    </section>
  );
}

function ComponentDetail({ component }: { component: RegistryComponent }) {
  return (
    <section aria-label="Component detail" style={{ marginTop: "1rem" }}>
      <h2>
        {component.displayName ?? component.name}{" "}
        <span style={{ fontWeight: 400, fontSize: "0.9rem", color: "#555" }}>(component)</span>
      </h2>
      {component.category ? <p style={{ color: "#555" }}>Category: {component.category}</p> : null}
      <h3>Fields ({component.fields?.length ?? 0})</h3>
      <FieldTable fields={component.fields ?? []} />
    </section>
  );
}

function ContentTypesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("type");

  const [types, setTypes] = useState<RegistryView[]>([]);
  const [components, setComponents] = useState<RegistryComponent[]>([]);
  const [detail, setDetail] = useState<RegistryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [detailNonce, setDetailNonce] = useState(0);

  // Refetch on every visit so registry edits appear with no rebuild.
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([listContentTypes(), listComponents()]);
      setTypes(t.data);
      setComponents(c.data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    const cached = types.find((t) => t.id === selected || t.name === selected);
    if (cached && cached.fields) {
      setDetail(cached);
      return;
    }
    let live = true;
    setDetailLoading(true);
    setDetailError(null);
    getContentType(selected)
      .then((t) => {
        if (live) setDetail(t);
      })
      .catch((e) => {
        if (live) setDetailError(e);
      })
      .finally(() => {
        if (live) setDetailLoading(false);
      });
    return () => {
      live = false;
    };
    // detailNonce re-runs the fetch for the T034 retry action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, types, detailNonce]);

  const selectedComponent = !detail && selected
    ? (components.find((c) => c.id === selected || c.name === selected) ?? null)
    : null;

  return (
    <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
      <h1>Content-Types</h1>
      {loading ? (
        <LoadingState label="Loading registry…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refresh()} />
      ) : (
        <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
          <nav aria-label="Registry" style={{ minWidth: 220 }}>
            <h2>Collections &amp; singles</h2>
            {types.length === 0 ? <EmptyState title="No content types yet." /> : null}
            <ul style={{ listStyle: "none", padding: 0 }}>
              {types.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => router.replace(`/content-types/?type=${encodeURIComponent(t.id)}`)}
                    style={{ cursor: "pointer", fontWeight: selected === t.id || selected === t.name ? 700 : 400, background: "none", border: "none", padding: "0.25rem 0", textAlign: "left" }}
                  >
                    {t.displayName ?? t.name} <span style={{ color: "#777" }}>({t.kind})</span>
                  </button>
                </li>
              ))}
            </ul>
            <h2>Components</h2>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {components.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => router.replace(`/content-types/?type=${encodeURIComponent(c.id)}`)}
                    style={{ cursor: "pointer", fontWeight: selected === c.id || selected === c.name ? 700 : 400, background: "none", border: "none", padding: "0.25rem 0", textAlign: "left" }}
                  >
                    {c.displayName ?? c.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div style={{ flex: 1 }}>
            {!selected ? (
              <p style={{ color: "#555" }}>Select a type or component to inspect its schema.</p>
            ) : detailLoading ? (
              <LoadingState label="Loading schema…" />
            ) : detailError ? (
              <ErrorState error={detailError} onRetry={() => setDetailNonce((n) => n + 1)} />
            ) : detail ? (
              <TypeDetail entry={{ kind: detail.kind, type: detail }} />
            ) : selectedComponent ? (
              <ComponentDetail component={selectedComponent} />
            ) : (
              <ErrorState error={new Error(`Unknown registry entry "${selected}".`)} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function ContentTypesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RouteGuard requiredPermission="content-type.read">
        <ContentTypesInner />
      </RouteGuard>
    </Suspense>
  );
}
