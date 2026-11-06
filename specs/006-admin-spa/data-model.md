# Data Model: Schema-Driven Admin SPA (Slice 6)

**Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

These are **client-side view-models** — the admin owns no tables and persists nothing. Each entity names the API payload it mirrors and the UI state derived from it. Field names follow the verified server shapes (not spec paraphrases) so the typed client (`lib/api-client.ts`) can be written directly from this doc.

## 1. RegistryView (from `GET /api/v1/content-types`, `GET /api/v1/content-types/:id`)

Mirrors the `contentTypes` row + `contentFields` rows + `schemaVersions` pointer.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | string (uuid) | type row | registry key; used in search params |
| `name` | string | type row | machine name |
| `kind` | `'collection' \| 'single'` | type row | nav grouping; singles render a singleton editor, not a table |
| `collectionSlug` | string | type row | public-API slug |
| `displayName` / `description` | string \| null | type row | nav labels |
| `isLocalized` | boolean | type row | enables the locale switcher for this type |
| `hasDraftPublish` | boolean | type row | enables publish controls |
| `activeSchemaVersion` | number | type row | captured when a form opens; re-checked on save (mid-edit warning) |
| `fields` | `RegistryField[]` | `GET …/:id` joins fields | ordered by `sortOrder` |

**RegistryField** (from `contentFields` row): `id`, `name`, `label`, `fieldType` (one of the 16 `VALID_FIELD_TYPES`), `required`, `localized`, `uniqueScope`, `defaultValue`, `searchable`, `validation` (record — holds enum options, min/max, patterns), `relationConfig` / `componentConfig` / `dynamiczoneConfig` / `mediaConfig` (records, nullable), `sortOrder`. Reserved names (`id`, `documentId`, `createdAt`, …) are filtered out of form rendering.

**Validation rules (client)**: `required` ⇒ non-empty before submit; type-appropriate input constraints (numeric, date, JSON-parse for `json`); server remains authoritative — client checks only prevent shape-obvious 400s, never replace server errors.

**State transitions**: N/A (read-only in this slice; builder mutations out of scope).

## 2. DocumentRow (from `GET /api/v1/documents?contentTypeId=&locale=`)

`{ data: Array<{ …documents row, locale, draftVersionId, publishedVersionId }> }` — **unpaginated** (see R-05).

| Derived view state | Rule |
|---|---|
| Per-locale status badge | `publishedVersionId != null` ⇒ published (green); draft-only ⇒ draft (grey); no row for locale ⇒ untranslated (outline) |
| Table columns | Scalar fields from `RegistryView.fields` + fixed `status / locale / updatedAt` columns |
| Pagination | Client-side, 25/page over the fetched array |

## 3. WorkingSet (client-only: document + active locale + pointers)

| Field | Type | Notes |
|---|---|---|
| `documentId` | string \| null | null ⇒ create mode |
| `contentTypeId` | string | from search params |
| `locale` | string | from search params, default = default locale (`GET /locales` where `isDefault`) |
| `draftData` | record | in-memory form values; survives 401-redirect via memory stash (R-07) |
| `schemaVersionAtOpen` | number | `activeSchemaVersion` snapshot for the mid-edit check |
| `translationState` | `'present' \| 'missing'` | missing ⇒ empty translatable fields + badge, never en-values (FR-005) |

**Transitions**: `missing → present` on first save in that locale; `draft → published[locale]` via publish confirm; reverse via unpublish confirm. All transitions are server-round-trip confirmed before the badge updates.

## 4. MediaSelection (from `GET /api/v1/media`, `GET /api/v1/media-folders`)

Asset row: `id`, `providerKey`, `mime`, `sizeBytes`, `width/height`, `folderId`, `alt/caption`, `transformUrls` (thumb/card presets), `deletedAt` (filtered client-side as safety net). Folder row: `id`, `name`, `parentId`, depth/cycle enforced server-side.

**UploadJob** (client state machine, R-08): `idle → precheck → signing → uploading{progress%} → confirming → done | failed{reason}`; `reason` carries the coded error (`FILE_TOO_LARGE{limit,received}`, `MIME_NOT_ALLOWED`, `FOLDER_DEPTH_EXCEEDED`, `FOLDER_CYCLE`, `MEDIA_REFERENCED{references[]}`, 413) for human-message mapping (FR-009).

## 5. SessionPrincipal (from Better Auth session + RBAC reads, R-04)

| Field | Type | Notes |
|---|---|---|
| `user` | `{ id, email, name, isSuperAdmin, isActive }` | session user; super-admin ⇒ full nav |
| `permissions` | `string[]` (`resource.action`) | union across the user's roles; cached per session |
| `can(permission)` | helper | drives nav visibility + control enablement; 403 from server is still handled inline everywhere |

**Relationships**: `SessionPrincipal` gates all views. `RegistryView` feeds `SchemaTable`/`SchemaForm`/`FieldWidget`. `WorkingSet` binds one `DocumentRow` (or create-mode) + one `locale` + `PublishControls`. `MediaSelection` is produced by `MediaPicker`/`UploadDropzone` and consumed by `media`-type widgets. `UploadJob`s live inside the media library view and the picker.
