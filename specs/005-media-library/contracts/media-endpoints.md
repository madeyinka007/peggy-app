# Contracts: Media Endpoints (Slice 5)

Base: `/api/v1`. Error envelope: `{ error: { code, message, details? } }`.

## POST /api/v1/media/sign — `media.upload`

Request: `{ filename, mime, sizeBytes, folderId? }`

- 200: `{ url, params: { timestamp, signature, apiKey, cloudName, folder?, publicId? } }` — browser PUTs bytes direct to `url`.
- 422 `MIME_NOT_ALLOWED` / `FILE_TOO_LARGE { limit, received }` on validation failure.
- 401 without auth; 403 without `media.upload`.

## POST /api/v1/media — `media.upload`

Request: `{ providerKey, mime, sizeBytes, folderId?, alt?, caption?, width?, height?, durationS?, hashSha256? }`

- 201: created `media_assets` row (server HEAD-verified; client metadata reconciled against provider truth).
- 422 `PROVIDER_KEY_NOT_FOUND` when the provider has no such key.
- 413 `PAYLOAD_TOO_LARGE` when `Content-Length` exceeds the service constant, with `{ signedFlow: "POST /api/v1/media/sign" }`.

## GET /api/v1/media — `media.read` (or public scope)

Query: `?folderId=&mime=&q=&page=&pageSize=` — paginated asset list (soft-deleted excluded).

## GET /api/v1/media/:id — `media.read`

- 200 asset row + `transformUrls: { thumb, card, hero, original }` (read-time, no DB write).
- 404 when missing or soft-deleted (without `includeDeleted`).

## PATCH /api/v1/media/:id — `media.manage`

Updatable: `{ folderId, alt, caption }`. Move across folders allowed.

## DELETE /api/v1/media/:id — `media.manage`

- 204 on soft-delete (provider destroy queued, audited).
- 409 `MEDIA_REFERENCED { references: [{ documentId, locale, fieldPath }] }` when referenced by published content and no `?force=true`.

## POST /api/v1/media/:id/replace — `media.manage`

Request: `{ providerKey, policy: "update-references" | "keep-both", ...meta }` — creates a new asset row; `update-references` moves `media_usage` rows.

## Folders — `media.manage`

- `GET /api/v1/media-folders` — tree (recursive CTE) or flat with `?parentId=`.
- `POST /api/v1/media-folders` — `{ name, parentId? }` → 201 with materialized `path`.
- `PATCH /api/v1/media-folders/:id` — rename/move; 422 `FOLDER_CYCLE` / `FOLDER_DEPTH_EXCEEDED`.
- `DELETE /api/v1/media-folders/:id` — 409 with asset count unless `?recursive=true`.
