/**
 * Admin-side view-model types (Slice 6).
 * Mirrors specs/006-admin-spa/data-model.md. The admin owns no tables and
 * persists nothing — these types describe API payloads and derived UI state.
 */

/** The 16 registry field types (server: VALID_FIELD_TYPES in packages/auth/src/fields.ts). */
export type FieldType =
  | "text"
  | "richtext"
  | "markdown"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "json"
  | "email"
  | "uid"
  | "enumeration"
  | "media"
  | "relation"
  | "component"
  | "dynamiczone";

/** Reserved registry names — never rendered as form inputs. */
export const RESERVED_FIELD_NAMES: ReadonlySet<string> = new Set([
  "id",
  "documentId",
  "__component",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "locale",
  "contentTypeId",
  "componentId",
  "activeSchemaVersion",
  "createdBy",
]);

/** One field row from the registry (contentFields). */
export interface RegistryField {
  id: string;
  name: string;
  label: string | null;
  fieldType: FieldType | string;
  required: boolean;
  localized: boolean;
  uniqueScope: string | null;
  defaultValue: unknown;
  searchable: boolean;
  validation: Record<string, unknown>;
  relationConfig: Record<string, unknown> | null;
  componentConfig: Record<string, unknown> | null;
  dynamiczoneConfig: Record<string, unknown> | null;
  mediaConfig: Record<string, unknown> | null;
  sortOrder: number;
}

/** A content-type row + its fields (GET /api/v1/content-types/:id). */
export interface RegistryView {
  id: string;
  name: string;
  kind: "collection" | "single";
  collectionSlug: string;
  displayName: string | null;
  description: string | null;
  isLocalized: boolean;
  hasDraftPublish: boolean;
  activeSchemaVersion: number;
  fields: RegistryField[];
}

/** A component definition (GET /api/v1/components). */
export interface RegistryComponent {
  id: string;
  name: string;
  displayName: string | null;
  category: string | null;
  fields?: RegistryField[];
}

/** A locale row (GET /api/v1/locales). */
export interface Locale {
  code: string;
  name: string | null;
  isDefault: boolean;
}

/** One document row with per-locale pointers (GET /api/v1/documents). */
export interface DocumentRow {
  id: string;
  documentId: string;
  contentTypeId: string;
  locale: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Draft version payload (present when getDocument expands it). */
  data?: Record<string, unknown>;
  slug?: string | null;
}

export type DocumentStatus = "published" | "draft" | "untranslated";

export function documentStatus(row: DocumentRow | null | undefined): DocumentStatus {
  if (!row) return "untranslated";
  return row.publishedVersionId != null ? "published" : "draft";
}

/** Client-only editing state for one document + locale. */
export interface WorkingSet {
  documentId: string | null;
  contentTypeId: string;
  locale: string;
  draftData: Record<string, unknown>;
  schemaVersionAtOpen: number;
  translationState: "present" | "missing";
}

/** A media asset row (GET /api/v1/media). */
export interface MediaAsset {
  id: string;
  providerKey: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  folderId: string | null;
  alt: string | null;
  caption: string | null;
  transformUrls?: Record<string, string>;
  deletedAt: string | null;
  createdAt: string;
}

/** A media folder row (GET /api/v1/media-folders). */
export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

/** Reference held by a media-type form field or the picker. */
export interface MediaSelection {
  assetId: string;
  providerKey: string;
  thumbnailUrl: string | null;
  mime: string;
}

/** Upload state machine (R-08). */
export type UploadJobState =
  | "idle"
  | "precheck"
  | "signing"
  | "uploading"
  | "confirming"
  | "done"
  | "failed";

export interface UploadJob {
  state: UploadJobState;
  progress: number;
  fileName: string;
  reason?: string;
  code?: string;
  limit?: number;
  received?: number;
}

/** Authenticated human identity + resolved permissions. */
export interface SessionPrincipal {
  user: {
    id: string;
    email: string;
    name: string | null;
    isSuperAdmin: boolean;
    isActive: boolean;
  };
  permissions: string[];
}

/** Client-side API error (contracts/admin-api-client.md). */
export interface ApiError {
  status: number;
  code?: string | undefined;
  message: string;
  requestId?: string | undefined;
  fieldErrors?: { path: string; message: string }[] | undefined;
  references?: unknown[] | undefined;
  limit?: number | undefined;
  received?: number | undefined;
}

/** 401 signal — the caller redirects to login with return-to. */
export const UNAUTHORIZED = Symbol("UNAUTHORIZED");

export function isUnauthorized(e: unknown): boolean {
  return e === UNAUTHORIZED || (typeof e === "object" && e !== null && (e as ApiError).status === 401);
}
