"use client";

/**
 * Schema-driven document table (T015/US1). Columns derive from
 * RegistryView.fields — no per-type branches (P-07). Client-side pagination
 * (25/page) over the unpaginated GET /documents array (R-05).
 */
import { useMemo, useState } from "react";
import { documentStatus } from "@/lib/types";
import type { DocumentRow, DocumentStatus, RegistryField, RegistryView } from "@/lib/types";

export const TABLE_PAGE_SIZE = 25;

/** Badge rule: `publishedVersionId != null` ⇒ published, row ⇒ draft, none ⇒ untranslated. */
export function statusOf(row: DocumentRow | null | undefined): DocumentStatus {
  return documentStatus(row);
}

/** Scalar-ish field types rendered as text. */
const TEXT_TYPES = new Set([
  "text",
  "email",
  "uid",
  "number",
  "date",
  "datetime",
  "time",
  "enumeration",
]);

/** Complex field types rendered as compact placeholders. */
const PLACEHOLDER_TYPES = new Set([
  "media",
  "relation",
  "component",
  "dynamiczone",
  "richtext",
  "markdown",
  "json",
]);

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** Render one cell value. Unknown field types fall back to a JSON dump. */
export function cellText(field: RegistryField, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const t = field.fieldType;
  if (TEXT_TYPES.has(t)) {
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }
  if (t === "boolean") {
    if (raw === true) return "Yes";
    if (raw === false) return "No";
    return "—";
  }
  if (PLACEHOLDER_TYPES.has(t)) {
    if (t === "media") {
      if (Array.isArray(raw)) return raw.length === 0 ? "—" : pluralize(raw.length, "asset", "assets");
      return "1 asset";
    }
    if (t === "dynamiczone") {
      if (Array.isArray(raw)) return raw.length === 0 ? "—" : pluralize(raw.length, "entry", "entries");
      return "dynamic zone";
    }
    if (t === "relation") return "relation";
    if (t === "component") return "component";
    return t === "json" ? "JSON" : "rich text";
  }
  console.warn(`[SchemaTable] Unknown fieldType "${t}" for field "${field.name}" — rendering JSON dump.`);
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export interface SchemaTableProps {
  type: RegistryView;
  rows: DocumentRow[];
  locale: string;
  pageSize?: number | undefined;
  selectedId?: string | null | undefined;
  onSelect?: ((row: DocumentRow) => void) | undefined;
}

export function SchemaTable({
  type,
  rows,
  locale,
  pageSize = TABLE_PAGE_SIZE,
  selectedId,
  onSelect,
}: SchemaTableProps) {
  const [page, setPage] = useState(0);
  const columns = useMemo(
    () => [...type.fields].sort((a, b) => a.sortOrder - b.sortOrder),
    [type],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visible = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return <p style={{ color: "#555" }}>No documents yet — use the form below to create one.</p>;
  }

  return (
    <div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {columns.map((f) => (
              <th
                key={f.name}
                style={{ textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem" }}
              >
                {f.label ?? f.name}
              </th>
            ))}
            <th style={{ textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem" }}>
              Status
            </th>
            <th style={{ textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem" }}>
              Locale
            </th>
            <th style={{ textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem" }}>
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const status = statusOf(row);
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect?.(row)}
                aria-selected={selected}
                style={{
                  cursor: onSelect ? "pointer" : undefined,
                  background: selected ? "#eef4ff" : undefined,
                  borderBottom: "1px solid #eee",
                }}
              >
                {columns.map((f) => (
                  <td key={f.name} style={{ padding: "0.4rem" }}>
                    {cellText(f, row.data?.[f.name])}
                  </td>
                ))}
                <td style={{ padding: "0.4rem" }}>
                  <span data-status={status}>
                    {status === "published" ? "Published" : "Draft"}
                  </span>
                </td>
                <td style={{ padding: "0.4rem" }}>{row.locale || locale}</td>
                <td style={{ padding: "0.4rem" }}>{formatUpdatedAt(row.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pageCount > 1 ? (
        <nav aria-label="Table pages" style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem" }}>
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            style={{ cursor: "pointer" }}
          >
            Previous
          </button>
          <span>
            Page {safePage + 1} of {pageCount} ({rows.length} documents)
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            style={{ cursor: "pointer" }}
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
