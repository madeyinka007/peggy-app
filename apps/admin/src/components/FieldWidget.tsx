"use client";

/**
 * Widget map for the 16 registry field types (T016/US1).
 *
 * One widget per `VALID_FIELD_TYPES` entry, keyed by field type — no
 * per-content-type branches. The media widget renders a T025 slot: a disabled
 * placeholder button until the MediaPicker wiring lands.
 */
import { useState } from "react";
import { RESERVED_FIELD_NAMES } from "@/lib/types";
import type { RegistryComponent, RegistryField } from "@/lib/types";

export { RESERVED_FIELD_NAMES };

/** Extract the enum options for an enumeration field (T009: `validation.options`, also `validation.enum`). */
export function enumOptionsOf(field: RegistryField): string[] {
  const v = (field.validation ?? {}) as Record<string, unknown>;
  for (const key of ["options", "enum"]) {
    const raw = v[key];
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

export interface WidgetContext {
  components: RegistryComponent[];
  onOpenMediaPicker?: ((fieldName: string) => void) | undefined;
}

export interface FieldWidgetProps {
  field: RegistryField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
  ctx?: WidgetContext | undefined;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.4rem", boxSizing: "border-box" };

function Label({ field }: { field: RegistryField }) {
  return (
    <label htmlFor={`field-${field.name}`} style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}>
      {field.label ?? field.name}
      {field.required ? <span aria-hidden="true" style={{ color: "#900" }}> *</span> : null}
    </label>
  );
}

function ErrorText({ error, fieldName }: { error: string | undefined; fieldName: string }) {
  if (!error) return null;
  return (
    <p role="alert" id={`field-${fieldName}-error`} style={{ color: "#900", margin: "0.25rem 0 0" }}>
      {error}
    </p>
  );
}

function TextWidget({ field, value, onChange, error, disabled, type }: FieldWidgetProps & { type: string }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <input
        id={`field-${field.name}`}
        type={type}
        value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function TextareaWidget({ field, value, onChange, error, disabled, rows }: FieldWidgetProps & { rows: number }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <textarea
        id={`field-${field.name}`}
        value={typeof value === "string" ? value : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

/** Parse a text input as a number; empty string clears to undefined. */
export function parseNumberInput(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

function NumberWidget(props: FieldWidgetProps) {
  const { field, value, onChange, error, disabled } = props;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <input
        id={`field-${field.name}`}
        type="number"
        value={typeof value === "number" ? value : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        onChange={(e) => {
          const n = parseNumberInput(e.target.value);
          onChange(n === undefined && e.target.value.trim() !== "" ? e.target.value : (n as unknown));
        }}
        style={inputStyle}
      />
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function BooleanWidget({ field, value, onChange, error, disabled }: FieldWidgetProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <label htmlFor={`field-${field.name}`} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          id={`field-${field.name}`}
          type="checkbox"
          checked={value === true}
          aria-invalid={!!error}
          aria-describedby={error ? `field-${field.name}-error` : undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span style={{ fontWeight: 600 }}>
          {field.label ?? field.name}
          {field.required ? <span aria-hidden="true" style={{ color: "#900" }}> *</span> : null}
        </span>
      </label>
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function DateTimeWidget({ field, value, onChange, error, disabled }: FieldWidgetProps) {
  const type = field.fieldType === "date" ? "date" : field.fieldType === "time" ? "time" : "datetime-local";
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <input
        id={`field-${field.name}`}
        type={type}
        value={typeof value === "string" ? value : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function EnumWidget({ field, value, onChange, error, disabled }: FieldWidgetProps) {
  const options = enumOptionsOf(field);
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <select
        id={`field-${field.name}`}
        value={typeof value === "string" ? value : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function MediaWidget({ field, value, error, disabled, ctx }: FieldWidgetProps) {
  // Media values are asset references: a bare id string, or an object with
  // an id (the server ledger accepts both — documents.ts writeMediaUsageRefs).
  const obj = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as { id?: unknown; thumbnailUrl?: unknown })
    : null;
  const ref = typeof value === "string" ? value : typeof obj?.id === "string" ? obj.id : "";
  const thumb = typeof obj?.thumbnailUrl === "string" ? obj.thumbnailUrl : null;
  const open = ctx?.onOpenMediaPicker;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{ display: "block", maxWidth: 160, maxHeight: 90, objectFit: "cover", borderRadius: 4, marginBottom: "0.4rem", background: "#f0f0f0" }}
        />
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          id={`field-${field.name}`}
          value={ref}
          aria-invalid={!!error}
          aria-describedby={error ? `field-${field.name}-error` : undefined}
          disabled
          readOnly
          placeholder="No asset selected"
          style={{ ...inputStyle, background: "#f5f5f5" }}
        />
        <button
          type="button"
          disabled={disabled || !open}
          title={open ? "Choose from media library" : "Media picker wiring lands in T025"}
          onClick={() => open?.(field.name)}
          style={{ cursor: open && !disabled ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
        >
          Select media
        </button>
      </div>
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function RelationWidget({ field, value, onChange, error, disabled }: FieldWidgetProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <input
        id={`field-${field.name}`}
        value={typeof value === "string" ? value : ""}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        placeholder="Related document id or slug"
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

function JsonWidget({ field, value, onChange, error, disabled }: FieldWidgetProps) {
  const [text, setText] = useState(() =>
    value === undefined || value === null ? "" : JSON.stringify(value, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      <textarea
        id={`field-${field.name}`}
        value={text}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error || !!parseError}
        aria-describedby={error || parseError ? `field-${field.name}-error` : undefined}
        disabled={disabled}
        rows={4}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") {
            setParseError(null);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(e.target.value));
            setParseError(null);
          } catch {
            setParseError("Invalid JSON — fix the syntax before saving.");
          }
        }}
        style={{ ...inputStyle, fontFamily: "monospace" }}
      />
      <ErrorText error={error ?? parseError ?? undefined} fieldName={field.name} />
    </div>
  );
}

/** Resolve a component definition by id or name. */
export function resolveComponent(
  components: RegistryComponent[],
  ref: string | undefined,
): RegistryComponent | undefined {
  if (!ref) return undefined;
  return components.find((c) => c.id === ref || c.name === ref);
}

export interface SubFormProps {
  fields: RegistryField[];
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  errors?: Record<string, string> | undefined;
  disabled?: boolean | undefined;
  ctx: WidgetContext;
  path?: string | undefined;
}

/** Recursive sub-form for component fields (nested object). */
export function ComponentSubForm({ fields, value, onChange, errors, disabled, ctx, path }: SubFormProps) {
  const ordered = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <fieldset style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", margin: 0 }}>
      {ordered
        .filter((f) => !RESERVED_FIELD_NAMES.has(f.name))
        .map((f) => {
          const key = path ? `${path}.${f.name}` : f.name;
          return (
            <FieldWidget
              key={f.name}
              field={f}
              value={value[f.name]}
              onChange={(v) => onChange({ ...value, [f.name]: v })}
              error={errors?.[key] ?? errors?.[f.name]}
              disabled={disabled}
              ctx={ctx}
            />
          );
        })}
    </fieldset>
  );
}

function ComponentWidget({ field, value, onChange, error, disabled, ctx }: FieldWidgetProps) {
  const cfg = (field.componentConfig ?? {}) as { componentId?: string; component?: string };
  const comp = resolveComponent(ctx?.components ?? [], cfg.componentId ?? cfg.component);
  const obj = (value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      {comp?.fields ? (
        <ComponentSubForm
          fields={comp.fields}
          value={obj}
          onChange={onChange}
          disabled={disabled}
          ctx={ctx ?? { components: [] }}
          path={field.name}
        />
      ) : (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Component{cfg.componentId ?? cfg.component ? ` “${cfg.componentId ?? cfg.component}”` : ""} has no
          visible fields.
        </p>
      )}
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

let dzKey = 0;
function nextDzKey(): string {
  dzKey += 1;
  return `dz-${dzKey}`;
}

function DynamicZoneWidget({ field, value, onChange, error, disabled, ctx }: FieldWidgetProps) {
  const cfg = (field.dynamiczoneConfig ?? {}) as { components?: string[] };
  const allowed = Array.isArray(cfg.components) ? cfg.components.filter((c) => typeof c === "string") : [];
  const entries = Array.isArray(value) ? (value as unknown[]) : [];
  const [adding, setAdding] = useState<string>(allowed[0] ?? "");

  function setEntry(i: number, v: unknown) {
    const next = [...entries];
    next[i] = v;
    onChange(next);
  }
  function removeEntry(i: number) {
    onChange(entries.filter((_, j) => j !== i));
  }
  function moveEntry(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function addEntry() {
    if (!adding) return;
    const comp = resolveComponent(ctx?.components ?? [], adding);
    onChange([...entries, { __component: adding, ...(comp ? {} : {}) }]);
  }

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <Label field={field} />
      {entries.map((entry, i) => {
        const obj = (entry !== null && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
        const compName = typeof obj.__component === "string" ? obj.__component : adding;
        const comp = resolveComponent(ctx?.components ?? [], compName);
        return (
          <div key={i} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>{compName || "Entry"}</strong>
              <span style={{ display: "flex", gap: "0.25rem" }}>
                <button type="button" disabled={disabled || i === 0} title="Move entry up" aria-label={`Move ${compName || "entry"} ${i + 1} up`} onClick={() => moveEntry(i, -1)} style={{ cursor: "pointer" }}>
                  ↑
                </button>
                <button type="button" disabled={disabled || i === entries.length - 1} title="Move entry down" aria-label={`Move ${compName || "entry"} ${i + 1} down`} onClick={() => moveEntry(i, 1)} style={{ cursor: "pointer" }}>
                  ↓
                </button>
                <button type="button" disabled={disabled} onClick={() => removeEntry(i)} style={{ cursor: "pointer" }}>
                  Remove
                </button>
              </span>
            </div>
            {comp?.fields ? (
              <ComponentSubForm
                fields={comp.fields}
                value={obj}
                onChange={(v) => setEntry(i, { ...v, __component: compName })}
                disabled={disabled}
                ctx={ctx ?? { components: [] }}
                path={`${field.name}[${i}]`}
              />
            ) : (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No field definition for this entry.</p>
            )}
          </div>
        );
      })}
      {allowed.length > 0 ? (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select aria-label={`Add entry to ${field.name}`} value={adding} disabled={disabled} onChange={(e) => setAdding(e.target.value)} style={{ padding: "0.4rem" }}>
            {allowed.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" disabled={disabled || !adding} onClick={addEntry} style={{ cursor: "pointer" }}>
            Add entry
          </button>
        </div>
      ) : (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>No allowed components configured.</p>
      )}
      <ErrorText error={error} fieldName={field.name} />
    </div>
  );
}

/** Widget dispatch — one branch per registry field type. */
export function FieldWidget(props: FieldWidgetProps) {
  const { field } = props;
  switch (field.fieldType) {
    case "text":
      return <TextWidget {...props} type="text" />;
    case "email":
      return <TextWidget {...props} type="email" />;
    case "uid":
      return <TextWidget {...props} type="text" />;
    case "richtext":
    case "markdown":
      return <TextareaWidget {...props} rows={6} />;
    case "number":
      return <NumberWidget {...props} />;
    case "boolean":
      return <BooleanWidget {...props} />;
    case "date":
    case "datetime":
    case "time":
      return <DateTimeWidget {...props} />;
    case "enumeration":
      return <EnumWidget {...props} />;
    case "media":
      return <MediaWidget {...props} />;
    case "relation":
      return <RelationWidget {...props} />;
    case "component":
      return <ComponentWidget {...props} />;
    case "dynamiczone":
      return <DynamicZoneWidget {...props} />;
    case "json":
      return <JsonWidget {...props} />;
    default:
      console.warn(`[FieldWidget] Unknown fieldType "${field.fieldType}" for field "${field.name}" — rendering JSON editor.`);
      return <JsonWidget {...props} />;
  }
}
