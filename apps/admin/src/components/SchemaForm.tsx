"use client";

/**
 * Schema-driven document form (T016/US1). Fields render from
 * RegistryView.fields in `sortOrder`; reserved names are filtered;
 * `required` ⇒ marker + attribute; `localized` fields participate in
 * per-locale editing (the parent passes the locale-scoped values).
 * Server errors map via the R-06 mapper; payload is preserved on failure.
 */
import { useEffect, useMemo, useState } from "react";
import { RESERVED_FIELD_NAMES, FieldWidget } from "./FieldWidget";
import type { WidgetContext } from "./FieldWidget";
import { MediaPicker } from "./MediaPicker";
import type { MediaSelection } from "@/lib/types";
import { mapServerError } from "@/lib/error-mapper";
import type { RegistryView } from "@/lib/types";

export interface SchemaFormProps {
  type: RegistryView;
  initialValues: Record<string, unknown>;
  translationMissing?: boolean | undefined;
  fieldErrors?: Record<string, string> | undefined;
  banner?: string | null | undefined;
  saving?: boolean | undefined;
  saveError?: unknown | undefined;
  submitLabel?: string | undefined;
  disabled?: boolean | undefined;
  ctx?: WidgetContext | undefined;
  onSubmit: (values: Record<string, unknown>) => void;
}

export function SchemaForm({
  type,
  initialValues,
  translationMissing,
  fieldErrors: fieldErrorsProp,
  banner: bannerProp,
  saving,
  saveError,
  submitLabel = "Save draft",
  disabled,
  ctx,
  onSubmit,
}: SchemaFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [pickerField, setPickerField] = useState<string | null>(null);

  // Reset when the parent loads a different document/locale.
  useEffect(() => {
    setValues(initialValues);
    setDirty(false);
  }, [initialValues]);

  const fields = useMemo(
    () =>
      [...type.fields]
        .filter((f) => !RESERVED_FIELD_NAMES.has(f.name))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [type],
  );

  const names = useMemo(() => fields.map((f) => f.name), [fields]);
  const uidField = useMemo(() => fields.find((f) => f.fieldType === "uid")?.name, [fields]);

  const mapped = useMemo(
    () => (saveError ? mapServerError(saveError, { names, uidField }) : null),
    [saveError, names, uidField],
  );
  const fieldErrors = useMemo(
    () => ({ ...(mapped?.fieldErrors ?? {}), ...(fieldErrorsProp ?? {}) }),
    [mapped, fieldErrorsProp],
  );
  const banner = bannerProp ?? mapped?.banner ?? null;

  // Payload is always preserved: `values` only change on user input or an
  // explicit `initialValues` swap (document/locale change).

  // T025: media-type fields open the shared picker; the selection populates
  // the field with the asset reference + thumbnail preview.
  const widgetCtx: WidgetContext = useMemo(
    () => ({ ...(ctx ?? { components: [] }), onOpenMediaPicker: (name: string) => setPickerField(name) }),
    [ctx],
  );

  function onPick(sel: MediaSelection) {
    if (!pickerField) return;
    setValues((prev) => ({
      ...prev,
      [pickerField]: { id: sel.assetId, thumbnailUrl: sel.thumbnailUrl ?? undefined },
    }));
    setDirty(true);
    setPickerField(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      {translationMissing ? (
        <p role="status" style={{ border: "1px solid #a60", borderRadius: 6, padding: "0.75rem", color: "#7a4d00" }}>
          No translation exists for this locale yet — fill in the fields below and save to create it.
        </p>
      ) : null}
      {banner ? (
        <p role="alert" style={{ border: "1px solid #900", borderRadius: 6, padding: "0.75rem", color: "#900" }}>
          {banner}
        </p>
      ) : null}
      {fields.length === 0 ? (
        <p style={{ color: "#555" }}>This content type has no editable fields.</p>
      ) : null}
      {fields.map((f) => (
        <FieldWidget
          key={f.name}
          field={f}
          value={values[f.name]}
          onChange={(v) => {
            setValues((prev) => ({ ...prev, [f.name]: v }));
            setDirty(true);
          }}
          error={fieldErrors[f.name]}
          disabled={disabled || saving}
          ctx={widgetCtx}
        />
      ))}
      <button type="submit" disabled={disabled || saving} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
        {saving ? "Saving…" : dirty ? `${submitLabel} (unsaved changes)` : submitLabel}
      </button>
      <MediaPicker open={pickerField !== null} onSelect={onPick} onClose={() => setPickerField(null)} />
    </form>
  );
}
