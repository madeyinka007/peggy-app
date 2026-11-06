# Contract: Admin API Client (`apps/admin/src/lib/api-client.ts`)

**Date**: 2026-11-05 | **Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md)

The admin is a pure `fetch` consumer of the Slice 1–5 API surface. This contract pins the **client-side assumptions** — verified against `apps/api/src/routes/*` and `packages/*` on 2026-11-05 — so `lib/api-client.ts` can be implemented without re-reading server code. Anything marked **verify-live** must be confirmed against a running dev API during implementation (quickstart step 1); mismatches come back as a spec amendment, never a silent client hack.

## Transport

- Base URL: `process.env.NEXT_PUBLIC_API_URL` (no default that points at production; fail fast at startup if unset).
- Every request: `credentials: 'include'` (session cookie, `Domain=.parent`). Auth endpoints additionally via the `better-auth/client` (`signIn.email`, `signOut`, `getSession`).
- Request/response JSON (`application/json`) except the provider PUT (multipart/form-data fields + raw bytes via XHR for progress).
- **Verify-live**: whether cookie-session mutations need an explicit CSRF/`origin` header (Better Auth same-origin default vs `Domain=.parent` cross-subdomain POSTs).

## Endpoints used (no new endpoints in this slice)

| Client call | Method + path | AuthZ | Success shape | Error shapes handled |
|---|---|---|---|---|
| `signIn(email, password)` | Better Auth `/api/auth/sign-in/email` | — | session + cookie | generic message, clear password field |
| `getSession()` | Better Auth `client.getSession()` | cookie | `{ user: { id, email, name, isSuperAdmin, isActive } }` | null ⇒ redirect `/login?returnTo=…` |
| `listContentTypes()` | `GET /api/v1/content-types` | session | `{ data: Type[] }` | 401 ⇒ login |
| `getContentType(id)` | `GET /api/v1/content-types/:id` | session | `{ …Type, fields: Field[] }` | 401 / 404 |
| `listComponents()` | `GET /api/v1/components` | session | `{ data: Component[] }` | 401 (feeds component/dynamic-zone widgets) |
| `listLocales()` | `GET /api/v1/locales` | session | `{ data: Locale[] }` (find `isDefault`) | 401 |
| `listDocuments(ctId, locale)` | `GET /api/v1/documents?contentTypeId=&locale=` | `document.read` | `{ data: DocRow[] }` **unpaginated** | 401 / 403 |
| `getDocument(id, locale)` | `GET /api/v1/documents/:id?locale=` | `document.read` | DocRow | **404 ⇒ translation-missing empty state**, not an error page |
| `createDocument({ contentTypeId, locale, data })` | `POST /api/v1/documents` | `document.create` | 201 DocRow | 400/422 string message → field-mapper (R-06); 409 slug conflict → slug-field error |
| `updateDocument(id, { data, locale? })` | `PUT /api/v1/documents/:id` | `document.update` | DocRow | 400/404/410 as above |
| `deleteDocument(id)` | `DELETE /api/v1/documents/:id` | `document.delete` | 204 | 400/403 |
| `publishDocument(id, locale)` | `POST /api/v1/documents/:id/publish { locale }` | `document.publish` | version pointers | 403 ⇒ "not permitted" notice; 404/409 inline |
| `unpublishDocument(id, locale)` | `POST /api/v1/documents/:id/unpublish { locale }` | `document.publish` | version pointers | as above |
| `signUpload({ filename, mime, sizeBytes, folderId })` | `POST /api/v1/media/sign` | `media.upload` | `{ url, params }` | 422 `FILE_TOO_LARGE{limit,received}` / `MIME_NOT_ALLOWED`; 400 otherwise |
| `confirmUpload({ providerKey, mime, sizeBytes, folderId, alt?, … })` | `POST /api/v1/media` | `media.upload` | asset row | re-validated policy errors (same codes) |
| `listAssets({ folderId?, mime?, q?, page, pageSize≤100 })` | `GET /api/v1/media?…` | session | `{ data, meta: { page, pageSize } }` | 400 |
| `updateAsset(id, { folderId?, alt?, caption? })` | `PATCH /api/v1/media/:id` | `media.manage` | asset row | 403/404 |
| `deleteAsset(id, force?)` | `DELETE /api/v1/media/:id[?force=true]` | `media.manage` for force | 204 | **409 `MEDIA_REFERENCED{references[]}`** ⇒ blocking dialog; force requires `media.manage` |
| `replaceAsset(id, …)` | `POST /api/v1/media/:id/replace` | `media.manage` | 201 row | 422 provider-key/policy codes |
| folder CRUD | `GET/POST /api/v1/media-folders`, `PATCH/DELETE /api/v1/media-folders/:id` | session / `media.manage` (verify-live per op) | folder rows | 422 `FOLDER_DEPTH_EXCEEDED` / `FOLDER_CYCLE` |
| `myPermissions()` | `GET /api/v1/users/{id}/roles` → per-role `GET /api/v1/roles/{roleId}/permissions` (+ `GET /api/v1/permissions` catalogue) | session | union of `resource.action` | any 403 ⇒ progressive-disclosure fallback (R-04) |

## Client error model

```ts
type ApiError = {
  status: number;            // HTTP status
  code?: string;             // coded errors where the API provides one
  message: string;           // human-mappable message (string bodies included)
  requestId?: string;        // rendered when present; absent today — never assumed
  fieldErrors?: { path: string; message: string }[]; // derived by the R-06 mapper, not the wire
  references?: unknown[];    // 409 MEDIA_REFERENCED payload
  limit?: number; received?: number; // 422 FILE_TOO_LARGE details
};
```

Every API failure renders a user-visible state with retry where applicable (FR-012); forms preserve payload on failure; 401 anywhere ⇒ login redirect with return-to + in-memory draft stash.

## Explicit non-goals (not contracted)

Content-type/field/component **mutations**, user/role administration, token management, webhooks/audit/outbox views — no client calls, no UI.
