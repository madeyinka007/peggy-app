# Contract: Builder Registry Mutation Endpoints (Slice 7)

**Date**: 2026-11-07 | **Source**: `apps/api/src/routes/content-types.ts`, `apps/api/src/routes/components.ts` post-`967a773`, verified by code inspection against `specs/003-content-types/contracts/content-types-endpoints.md`.

All endpoints require session cookie auth. Error bodies are `{ error: <string> }` (string shape, per R-06). `**NEW**` marks endpoints with no Slice 3 contract coverage.

## Content Types

### POST /api/v1/content-types — gate `content-type.create`
**Body**: `{ name, kind: "collection" | "single", collectionSlug, displayName?, description?, isLocalized?, hasDraftPublish? }`
**Response 201**: full row incl. `activeSchemaVersion: 1`.
**Failure**: 400 duplicate name/slug (`unique`) or slug-check violation (`^[a-z0-9-]+$`); 401 logged out; 403 without `content-type.create`.

### PUT /api/v1/content-types/:id — gate `content-type.update`
**Body**: any subset of `{ name?, displayName?, description?, isLocalized?, hasDraftPublish? }` (no validation beyond DB constraints).
**Response 200**: `{ ...row, fields }` (fields included since `967a773`, matching `GET /:id`).
**Failure**: 404 unknown id; 401/403.

### DELETE /api/v1/content-types/:id — gate `content-type.delete`
**Query**: `?force=true` accepted but **ignored** by the service (R-07-03) — UI never sends it.
**Response 204** on success. **Refusal when documents exist**: the `documents.contentTypeId ON DELETE RESTRICT` FK rejects — exact surfaced shape TBD in verify-live (R-07-07 item 2); UI maps whatever arrives to the FR-105 refusal message.

### POST /api/v1/content-types/:id/fields — gate `content-type.update`
**Body**: `{ name, label?, fieldType, required?, uniqueScope?, defaultValue?, localized?, searchable?, indexedHint?, validation?, relationConfig?, componentConfig?, dynamiczoneConfig?, mediaConfig?, sortOrder? }`
**Response 201**: field row; owner's `activeSchemaVersion` bumped +1.
**Failure**: 422 reserved name / invalid field type; 400 otherwise; 401/403.

### PUT /api/v1/content-types/:id/fields/:fieldId — gate `content-type.update`
**Body**: partial field patch (server applies **no** reserved-name/type validation — R-07-02; UI constrains).
**Response 200**: field row; version bumped +1. **Note**: `:id` is not ownership-checked (`updateField(fieldId, ...)`); UI always addresses the true owner.
**Failure**: 404 unknown field id; 401/403.

### DELETE /api/v1/content-types/:id/fields/:fieldId — gate `content-type.update`
**Response 204** — field **deprecated, not dropped** (row remains listed; `updatedAt` touched; version bumped +1).
**Failure**: 404 unknown field id; 401/403.

## Components

### POST /api/v1/components — gate `component.create`
**Body**: `{ name, displayName?, category? }` — **Response 201**: row with `activeSchemaVersion: 1`.

### PUT /api/v1/components/:id — gate `component.update`
**Body**: `{ displayName?, category? }` — **Response 200**: `{ ...row, fields }` (since `967a773`).

### DELETE /api/v1/components/:id — gate `component.delete`
**Response 204**; **409** `"Component is referenced by fields"` when referenced via `componentId` FK or `componentConfig.componentId`.

### POST /api/v1/components/:id/fields — gate `component.update`
Same body/shapes as the type-field POST (201/422/400); bumps the **component's** version.

### **NEW** PUT /api/v1/components/:id/fields/:fieldId — gate `component.update`
**Body**: partial field patch (same no-validation caveat as the type-field PUT).
**Response 200**: field row; component version bumped +1. **Failure**: 404; 401/403.

### **NEW** DELETE /api/v1/components/:id/fields/:fieldId — gate `component.update`
**Response 204** (deprecate-not-drop); **Failure**: 404; 401/403.

## Admin typed client mapping (`967a773`, `apps/admin/src/lib/api-client.ts`)

| Client fn | Route |
|---|---|
| `createContentType` / `updateContentType` / `deleteContentType(id, force?)` | `POST` / `PUT` / `DELETE /content-types[/:id]` |
| `createComponent` / `updateComponent` / `deleteComponent` | `POST` / `PUT` / `DELETE /components[/:id]` |
| `createContentTypeField` / `updateField` / `deleteContentTypeField` | `POST` / `PUT` / `DELETE /content-types/:id/fields[/:fieldId]` |
| `createComponentField` / `updateComponentField` / `deleteComponentField` | `POST` / **`PUT`** / **`DELETE`** `/components/:id/fields[/:fieldId]` |
| `getContentType` / `getComponent` / `listContentTypes` / `listComponents` | existing Slice 6 reads (unchanged) |

Covered by `apps/admin/tests/lib/api-client.test.ts` "registry mutations" block (mocked fetch; URL + method + body assertions).
