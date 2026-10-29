# Contract: Content Documents and Publishing Endpoints

All endpoints require session cookie auth (admin) unless noted as public.

## Documents

### POST /api/v1/documents
**Body**: `{ contentTypeId, locale?, data }`
**Response 201**: `{ id, documentId, contentTypeId, locale, version, data, schemaVersion, createdAt }`

### GET /api/v1/documents/:id
**Query**: `?locale=en&includeDeleted=false`
**Response 200**: `{ id, documentId, contentTypeId, locale, draftVersion, publishedVersion?, createdAt, deletedAt }`

### PUT /api/v1/documents/:id
**Body**: `{ locale?, data }`
**Response 200**: `{ id, documentId, version, data, schemaVersion, createdAt }` (new version created)

### DELETE /api/v1/documents/:id
**Response 204**: (no body) — sets deletedAt tombstone

### GET /api/v1/documents/:id/versions
**Query**: `?locale=en`
**Response 200**: `{ data: [{ version, status, data, schemaVersion, createdAt, createdBy }] }`

### POST /api/v1/documents/:id/restore
**Body**: `{ version, locale? }`
**Response 201**: `{ id, documentId, version, data, schemaVersion, createdAt }` (new version from old data)

## Publishing

### POST /api/v1/documents/:id/publish
**Body**: `{ locale }`
**Response 200**: `{ id, documentId, locale, publishedVersionId, publishedAt, firstPublishedAt }`

### POST /api/v1/documents/:id/unpublish
**Body**: `{ locale }`
**Response 200**: `{ id, documentId, locale, publishedVersionId: null }`

## Public API (no auth required)

### GET /api/v1/public/{collectionSlug}
**Query**: `?locale=en&filters[field][$op]=value&sort=field:asc&pagination[page]=1&pagination[pageSize]=25`
**Response 200**: `{ data: [{ id, documentId, data, publishedAt }], meta: { pagination: { page, pageSize, total, totalPages } } }`

### GET /api/v1/public/{collectionSlug}/{slug}
**Query**: `?locale=en`
**Response 200**: `{ id, documentId, data, publishedAt }`

## Locales

### GET /api/v1/locales
**Response 200**: `{ data: [{ code, name, isDefault, isActive, direction }] }`

## Error Responses

- **400**: Invalid request body
- **401**: Unauthorized
- **403**: Forbidden (insufficient permissions)
- **404**: Document not found
- **409**: Conflict (slug uniqueness, concurrent publish)
- **422**: Validation error (data doesn't match schema)
