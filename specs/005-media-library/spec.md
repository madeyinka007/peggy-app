# Feature Specification: Media Library (Slice 5)

**Feature Branch**: `005-media-library`
**Status**: Draft for implementation
**Decisions locked**: D1–D10 (PRD §28) + OQ-01…OQ-06 (PRD §29). Constitution v1 applies.

---

## User description

"Slice 5 — Media Library. File uploads via signed URLs (no bytes through the serverless handler), Cloudinary as the default storage provider behind a provider port, asset metadata in Postgres, hierarchical folders, transform URLs at read time, and reference-guarded deletion. Core never imports the Cloudinary SDK."

---

## Clarifications

### Session 2026-10-29

- Q: Where should media service code live? → A: New `MediaService` in `@peggy/storage` (services) + schema in `@peggy/db`, routes in `apps/api`. Cloudinary provider in `@peggy/storage`, core behind `StorageProvider` port.
- Q: Which upload flow for MVP? → A: Signed-upload flow only (`POST /api/v1/media/sign` → browser PUT direct to Cloudinary → `POST /api/v1/media` confirm). No multipart through the handler; direct POST of large files → `413 PAYLOAD_TOO_LARGE` with pointer to signed flow.
- Q: How are media references tracked? → A: `media_usage` ledger table (asset ↔ document, locale, field_path). Delete-guard is O(1) lookup, not JSON scan.

---

## User Stories

### US1 — Editor uploads an image via signed URL (Priority: P1) 🎯 MVP

As Emeka (content editor), I want to upload `hero.jpg` to folder `/landing` so that I can attach it to a Post.

**Acceptance:**
1. **Given** I am authenticated with `media.upload`, **When** I `POST /api/v1/media/sign` with `{ filename, mime, sizeBytes, folderId? }`, **Then** I receive signed Cloudinary params (or 422 for disallowed MIME / oversize).
2. **Given** signed params, **When** the browser PUTs bytes direct to Cloudinary, **Then** no file bytes traverse the API handler.
3. **Given** a successful provider upload, **When** I `POST /api/v1/media` with `{ providerKey, mime, sizeBytes, folderId?, alt?, caption? }`, **Then** a metadata row is created (201) with `url`, `secureUrl`, dimensions when known.

### US2 — Editor organizes assets in folders (Priority: P1)

As Emeka, I want hierarchical folders so that assets stay organized.

**Acceptance:**
1. **Given** `media.manage`, **When** I create/rename/move folders, **Then** `path` is maintained (materialized `/landing/hero`) and cycles are rejected.
2. **Given** a folder containing assets, **When** I delete it without `recursive=true`, **Then** 409 with asset count.

### US3 — Frontend consumes responsive images (Priority: P2)

As Ken (frontend consumer), I want `transformUrl(asset, preset)` so that I get responsive variants without new DB rows.

**Acceptance:**
1. **Given** a stored asset, **When** I request `thumb | card | hero | original` (or explicit `{ w, h, q, format }` with `f_auto,q_auto` defaults), **Then** a valid Cloudinary URL is returned and no new row is created.

### US4 — Editor deletes or replaces an asset safely (Priority: P2)

As Emeka, I want delete/replace guarded by references so that I never break published content silently.

**Acceptance:**
1. **Given** an asset referenced by a published document, **When** I `DELETE /api/v1/media/:id` without `?force=true`, **Then** 409 `MEDIA_REFERENCED` with `references[]` (documentId, locale, fieldPath).
2. **Given** `?force=true` + `media.manage`, **When** I delete, **Then** the row is soft-deleted and provider destroy is queued; the action is audited.

---

## Functional Requirements

- **FR-001**: System MUST provide `POST /api/v1/media/sign` validating MIME allowlist + size limits, returning signed provider params (no bytes through handler).
- **FR-002**: System MUST provide `POST /api/v1/media` confirming provider upload by `providerKey` and creating the `media_assets` metadata row.
- **FR-003**: System MUST reject direct large file POST to the API with `413 PAYLOAD_TOO_LARGE` pointing to the signed flow.
- **FR-004**: System MUST block `.exe` and `image/svg+xml` (default) with `422 MIME_NOT_ALLOWED`; oversize with `422 FILE_TOO_LARGE { limit, received }`.
- **FR-005**: System MUST provide folder CRUD (`media_folders` self-FK, materialized `path`, cycle rejection, depth limit 8).
- **FR-006**: System MUST maintain the `media_usage` ledger (asset ↔ document, locale, field_path) for O(1) delete guards.
- **FR-007**: System MUST return `409 MEDIA_REFERENCED { references[] }` when deleting an asset referenced by published content without `?force=true`.
- **FR-008**: System MUST provide `transformUrl(asset, preset | { w, h, q, format })` returning a valid Cloudinary URL with no new DB row.
- **FR-009**: System MUST soft-delete assets (`deletedAt`) and queue provider destroy; replace creates a new row with reference updates per policy.
- **FR-010**: System MUST enforce RBAC (`media.upload`, `media.manage`) on all media mutations.
- **FR-011**: Core MUST depend only on the `StorageProvider` port — never import the Cloudinary SDK outside the provider adapter (Constitution P-03, NON-NEGOTIABLE).

## Success Criteria

- **SC-001**: Signed-upload round trip (sign → direct PUT → confirm) completes with zero file bytes through the API handler.
- **SC-002**: Disallowed MIME / oversize uploads are rejected with 422 before any provider call.
- **SC-003**: Deleting a referenced asset without force returns 409 with a non-empty `references[]`.
- **SC-004**: `transformUrl` returns valid URLs for all MVP presets with no DB writes.
- **SC-005**: `nx enforce-module-boundaries` (or arch test) passes: no Cloudinary SDK import outside the provider adapter.

## Edge Cases

- Confirm with a `providerKey` that doesn't exist at the provider → 422 `PROVIDER_KEY_NOT_FOUND` (HEAD cross-check fails).
- Folder move creating a cycle (move into own descendant) → 422 `FOLDER_CYCLE`.
- Folder depth exceeding 8 → 422 `FOLDER_DEPTH_EXCEEDED`.
- Replace with `update-references` moves `media_usage` rows to the new asset; `keep-both` leaves them.
- SVG upload with explicit enable + sanitization flag → allowed; without → 422.

## Out of Scope

- S3/R2/local providers (port supports them; only Cloudinary ships in MVP).
- In-house file hosting as primary store (NG-05).
- `derived` transform cache rows (read-time URLs only in MVP).
- Admin media-picker UI (Slice 6+; this slice is API + services).
