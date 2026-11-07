/**
 * Typed fetch wrapper for the Peggy API (Slice 6).
 * Pure API consumer: runtime fetch only, session cookie via credentials:include.
 * See specs/006-admin-spa/contracts/admin-api-client.md.
 */
import type {
  ApiError,
  DocumentRow,
  Locale,
  MediaAsset,
  MediaFolder,
  RegistryComponent,
  RegistryField,
  RegistryView,
} from "./types";

/** Client-side API failure. Thrown by every call below on non-2xx or network error. */
export class ApiRequestError extends Error implements ApiError {
  status: number;
  code?: string | undefined;
  requestId?: string | undefined;
  fieldErrors?: { path: string; message: string }[] | undefined;
  references?: unknown[] | undefined;
  limit?: number | undefined;
  received?: number | undefined;

  constructor(status: number, message: string, extra?: Partial<ApiError>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    Object.assign(this, extra);
  }
}

function apiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (!v) throw new Error("NEXT_PUBLIC_API_URL is not set — the admin cannot reach the API.");
  return v.replace(/\/$/, "");
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number };
}

export interface Listed<T> {
  data: T[];
}

/** Normalize the API's two error shapes ({ error: string } | { error: { code, message, … } }). */
function toApiError(status: number, body: unknown): ApiRequestError {
  const fallback = `Request failed with status ${status}`;
  if (body !== null && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const requestId = typeof b.requestId === "string" ? b.requestId : undefined;
    const err = b.error;
    if (typeof err === "string") return new ApiRequestError(status, err || fallback, { requestId });
    if (err !== null && typeof err === "object") {
      const e = err as Record<string, unknown>;
      return new ApiRequestError(
        status,
        typeof e.message === "string" ? e.message : fallback,
        {
          code: typeof e.code === "string" ? e.code : undefined,
          requestId: typeof e.requestId === "string" ? e.requestId : requestId,
          references: Array.isArray(e.references) ? e.references : undefined,
          limit: typeof e.limit === "number" ? e.limit : undefined,
          received: typeof e.received === "number" ? e.received : undefined,
        },
      );
    }
  }
  if (typeof body === "string" && body.length > 0) return new ApiRequestError(status, body);
  return new ApiRequestError(status, fallback);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/v1${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (e) {
    throw new ApiRequestError(0, e instanceof Error ? `Network error: ${e.message}` : "Network error");
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

function withBody(method: string, data: unknown): RequestInit {
  return { method, body: JSON.stringify(data ?? {}) };
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// --- Registry / locales ---

export function listContentTypes(): Promise<Listed<RegistryView>> {
  return request("/content-types");
}

export function getContentType(id: string): Promise<RegistryView> {
  return request(`/content-types/${encodeURIComponent(id)}`);
}

export interface CreateContentTypeInput {
  name: string;
  kind: "collection" | "single";
  collectionSlug: string;
  displayName?: string | undefined;
  description?: string | undefined;
  isLocalized?: boolean | undefined;
  hasDraftPublish?: boolean | undefined;
}

export function createContentType(input: CreateContentTypeInput): Promise<RegistryView> {
  return request("/content-types", withBody("POST", input));
}

export function updateContentType(
  id: string,
  patch: Partial<CreateContentTypeInput>,
): Promise<RegistryView> {
  return request(`/content-types/${encodeURIComponent(id)}`, withBody("PUT", patch));
}

export async function deleteContentType(id: string, force = false): Promise<void> {
  await request(`/content-types/${encodeURIComponent(id)}${query({ force: force ? "true" : undefined })}`, {
    method: "DELETE",
  });
}

export interface CreateComponentInput {
  name: string;
  displayName?: string | undefined;
  category?: string | undefined;
}

export function createComponent(input: CreateComponentInput): Promise<RegistryComponent> {
  return request("/components", withBody("POST", input));
}

export function getComponent(id: string): Promise<RegistryComponent> {
  return request(`/components/${encodeURIComponent(id)}`);
}

export function updateComponent(
  id: string,
  patch: Partial<CreateComponentInput>,
): Promise<RegistryComponent> {
  return request(`/components/${encodeURIComponent(id)}`, withBody("PUT", patch));
}

export async function deleteComponent(id: string): Promise<void> {
  await request(`/components/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface CreateFieldInput {
  name: string;
  label?: string | undefined;
  fieldType: string;
  required?: boolean | undefined;
  uniqueScope?: string | null | undefined;
  defaultValue?: unknown;
  localized?: boolean | undefined;
  searchable?: boolean | undefined;
  validation?: Record<string, unknown> | undefined;
  relationConfig?: Record<string, unknown> | null | undefined;
  componentConfig?: Record<string, unknown> | null | undefined;
  dynamiczoneConfig?: Record<string, unknown> | null | undefined;
  mediaConfig?: Record<string, unknown> | null | undefined;
  sortOrder?: number | undefined;
}

export function createContentTypeField(
  contentTypeId: string,
  input: CreateFieldInput,
): Promise<RegistryField> {
  return request(`/content-types/${encodeURIComponent(contentTypeId)}/fields`, withBody("POST", input));
}

export function createComponentField(
  componentId: string,
  input: CreateFieldInput,
): Promise<RegistryField> {
  return request(`/components/${encodeURIComponent(componentId)}/fields`, withBody("POST", input));
}

export function updateField(
  contentTypeId: string,
  fieldId: string,
  patch: Partial<CreateFieldInput>,
): Promise<RegistryField> {
  return request(
    `/content-types/${encodeURIComponent(contentTypeId)}/fields/${encodeURIComponent(fieldId)}`,
    withBody("PUT", patch),
  );
}

export async function deleteContentTypeField(contentTypeId: string, fieldId: string): Promise<void> {
  await request(
    `/content-types/${encodeURIComponent(contentTypeId)}/fields/${encodeURIComponent(fieldId)}`,
    { method: "DELETE" },
  );
}

export function updateComponentField(
  componentId: string,
  fieldId: string,
  patch: Partial<CreateFieldInput>,
): Promise<RegistryField> {
  return request(
    `/components/${encodeURIComponent(componentId)}/fields/${encodeURIComponent(fieldId)}`,
    withBody("PUT", patch),
  );
}

export async function deleteComponentField(componentId: string, fieldId: string): Promise<void> {
  await request(
    `/components/${encodeURIComponent(componentId)}/fields/${encodeURIComponent(fieldId)}`,
    { method: "DELETE" },
  );
}

export function listComponents(): Promise<Listed<RegistryComponent>> {
  return request("/components");
}

export function listLocales(): Promise<Listed<Locale>> {
  return request("/locales");
}

export function listPermissions(): Promise<Listed<{ resource: string; action: string }>> {
  return request("/permissions");
}

// --- Documents ---

export function listDocuments(contentTypeId: string, locale?: string): Promise<Listed<DocumentRow>> {
  return request(`/documents${query({ contentTypeId, locale })}`);
}

export function getDocument(id: string, locale?: string): Promise<DocumentRow> {
  return request(`/documents/${encodeURIComponent(id)}${query({ locale })}`);
}

export interface SaveDocumentInput {
  contentTypeId: string;
  locale?: string;
  data: Record<string, unknown>;
}

export function createDocument(input: SaveDocumentInput): Promise<DocumentRow> {
  return request("/documents", withBody("POST", input));
}

export function updateDocument(
  id: string,
  data: Record<string, unknown>,
  locale?: string,
): Promise<DocumentRow> {
  return request(`/documents/${encodeURIComponent(id)}`, withBody("PUT", { data, locale }));
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function publishDocument(id: string, locale: string): Promise<DocumentRow> {
  return request(`/documents/${encodeURIComponent(id)}/publish`, withBody("POST", { locale }));
}

export function unpublishDocument(id: string, locale: string): Promise<DocumentRow> {
  return request(`/documents/${encodeURIComponent(id)}/unpublish`, withBody("POST", { locale }));
}

// --- Media ---

export interface SignUploadInput {
  filename: string;
  mime: string;
  sizeBytes: number;
  folderId?: string;
}

export interface SignUploadResult {
  url: string;
  params: Record<string, string | number | undefined>;
}

export function signUpload(input: SignUploadInput): Promise<SignUploadResult> {
  return request("/media/sign", withBody("POST", input));
}

export interface ConfirmUploadInput {
  providerKey: string;
  mime: string;
  sizeBytes: number;
  folderId?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export function confirmUpload(input: ConfirmUploadInput): Promise<MediaAsset> {
  return request("/media", withBody("POST", input));
}

export interface ListAssetsOptions {
  folderId?: string;
  mime?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listAssets(opts: ListAssetsOptions = {}): Promise<Paged<MediaAsset>> {
  return request(`/media${query(opts as Record<string, string | number | undefined>)}`);
}

export function updateAsset(
  id: string,
  patch: { folderId?: string | null; alt?: string; caption?: string },
): Promise<MediaAsset> {
  return request(`/media/${encodeURIComponent(id)}`, withBody("PATCH", patch));
}

export async function deleteAsset(id: string, force = false): Promise<void> {
  await request(`/media/${encodeURIComponent(id)}${query({ force: force ? "true" : undefined })}`, {
    method: "DELETE",
  });
}

export function replaceAsset(id: string, input: ConfirmUploadInput): Promise<MediaAsset> {
  return request(`/media/${encodeURIComponent(id)}/replace`, withBody("POST", input));
}

// --- Folders ---

export function listFolders(parentId?: string | null): Promise<Listed<MediaFolder>> {
  return request(`/media-folders${query({ parentId: parentId === null ? "null" : parentId })}`);
}

export function createFolder(name: string, parentId?: string | null): Promise<MediaFolder> {
  return request("/media-folders", withBody("POST", { name, parentId }));
}

export function updateFolder(
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<MediaFolder> {
  return request(`/media-folders/${encodeURIComponent(id)}`, withBody("PATCH", patch));
}

export async function deleteFolder(id: string, recursive = false): Promise<void> {
  await request(
    `/media-folders/${encodeURIComponent(id)}${query({ recursive: recursive ? "true" : undefined })}`,
    { method: "DELETE" },
  );
}

// --- Caller permissions (R-04) ---
//
// NOTE (verified 2026-11-06): the API has NO GET /users/:id/roles and NO
// GET /roles/:roleId/permissions — only assignment (POST/DELETE) endpoints.
// The chain below is still attempted so the client adapts automatically if
// those reads ever appear, but today it resolves to null and callers use
// progressive disclosure (show mutation controls; hide-on-403 with a
// session-cached negative). Super-admins bypass via the session flag.

interface UserRoleRow {
  roleId: string;
}

interface RolePermissionRow {
  resource: string;
  action: string;
}

export async function myPermissions(userId: string): Promise<string[] | null> {
  try {
    const roles = await request<Listed<UserRoleRow> | UserRoleRow[]>(
      `/users/${encodeURIComponent(userId)}/roles`,
    );
    const rows = Array.isArray(roles) ? roles : roles.data;
    const sets = await Promise.all(
      rows.map((r) =>
        request<Listed<RolePermissionRow> | RolePermissionRow[]>(
          `/roles/${encodeURIComponent(r.roleId)}/permissions`,
        ).catch(() => null),
      ),
    );
    const union = new Set<string>();
    for (const s of sets) {
      if (!s) continue;
      const list = Array.isArray(s) ? s : s.data;
      for (const p of list) union.add(`${p.resource}.${p.action}`);
    }
    return [...union];
  } catch {
    return null;
  }
}
