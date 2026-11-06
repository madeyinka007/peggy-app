"use client";

/**
 * R-06 validation-error mapper (T016/US1). The API returns validation
 * failures as string messages (`Missing required field: <name>`,
 * `Invalid type for field <name>: expected …`, `Validation failed for
 * <name>: …`, slug `Conflict…` → 409). This maps known shapes to field
 * paths, shows the raw message as a field error when matched, otherwise
 * degrades to a form-level banner. Payload is always preserved by the
 * caller — this function never mutates form values.
 */
import type { ApiError } from "@/lib/types";

export interface MappedErrors {
  fieldErrors: Record<string, string>;
  banner: string | null;
}

/** A field name in this registry (optionally: the uid field for 409s). */
export interface MapperFields {
  names: string[];
  uidField?: string | undefined;
}

const MISSING_REQUIRED = /Missing required field:\s*([A-Za-z0-9_]+)/;
const INVALID_TYPE = /[Ff]ield\s+([A-Za-z0-9_]+)\s*:/;
const VALIDATION_FAILED = /Validation failed for\s+([A-Za-z0-9_]+)\s*:/;

function knownField(name: string, fields: MapperFields): boolean {
  return fields.names.includes(name);
}

export function mapServerError(err: unknown, fields: MapperFields): MappedErrors {
  const fallback = err instanceof Error ? err.message : "Save failed.";
  const status = typeof err === "object" && err !== null ? (err as Partial<ApiError>).status : undefined;
  const message =
    typeof err === "object" && err !== null && typeof (err as Partial<ApiError>).message === "string"
      ? String((err as Partial<ApiError>).message)
      : fallback;

  // 409 slug conflict → the uid field (slug derives from the uid field).
  if (status === 409) {
    const target = fields.uidField ?? fields.names.find((n) => n === "slug");
    if (target) return { fieldErrors: { [target]: message }, banner: null };
    return { fieldErrors: {}, banner: message };
  }

  const patterns = [MISSING_REQUIRED, INVALID_TYPE, VALIDATION_FAILED];
  for (const re of patterns) {
    const m = message.match(re);
    const name = m?.[1];
    if (name && knownField(name, fields)) {
      return { fieldErrors: { [name]: message }, banner: null };
    }
  }
  return { fieldErrors: {}, banner: message };
}
