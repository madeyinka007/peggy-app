# Contract: Content Types & Schema Registry Endpoints

All endpoints require session cookie auth (admin) or Bearer token with appropriate scopes.

## Content Types

### POST /api/v1/content-types
**Body**: `{ name, kind, collectionSlug, displayName?, description?, isLocalized?, hasDraftPublish? }`
**Response 201**: `{ id, name, kind, collectionSlug, displayName, description, isLocalized, hasDraftPublish, activeSchemaVersion, createdBy, createdAt, updatedAt }`

### GET /api/v1/content-types
**Response 200**: `{ data: [{ id, name, kind, collectionSlug, displayName, ... }] }`

### GET /api/v1/content-types/:id
**Response 200**: `{ id, name, kind, collectionSlug, displayName, ..., fields: [...] }`

### PUT /api/v1/content-types/:id
**Body**: `{ name?, displayName?, description?, isLocalized?, hasDraftPublish? }`
**Response 200**: `{ id, name, ... }`

### DELETE /api/v1/content-types/:id
**Query**: `?force=true` (optional)
**Response 204**: (no body) — blocked with 409 if documents exist and force is not set

## Fields

### POST /api/v1/content-types/:id/fields
**Body**: `{ name, label?, fieldType, required?, uniqueScope?, defaultValue?, localized?, searchable?, indexedHint?, validation?, relationConfig?, componentConfig?, dynamiczoneConfig?, mediaConfig?, sortOrder? }`
**Response 201**: `{ id, contentTypeId, name, fieldType, ..., activeSchemaVersion (bumped) }`

### GET /api/v1/content-types/:id/fields
**Response 200**: `{ data: [{ id, name, fieldType, sortOrder, ... }] }`

### PUT /api/v1/content-types/:id/fields/:fieldId
**Body**: `{ label?, required?, validation?, sortOrder?, ... }`
**Response 200**: `{ id, name, ..., activeSchemaVersion (bumped) }`

### DELETE /api/v1/content-types/:id/fields/:fieldId
**Response 204**: (no body) — field is deprecated, not dropped

## Components

### POST /api/v1/components
**Body**: `{ name, displayName?, category? }`
**Response 201**: `{ id, name, displayName, category, activeSchemaVersion, createdAt, updatedAt }`

### GET /api/v1/components
**Response 200**: `{ data: [{ id, name, displayName, category, fieldCount }] }`

### GET /api/v1/components/:id
**Response 200**: `{ id, name, displayName, category, activeSchemaVersion, fields: [...] }`

### PUT /api/v1/components/:id
**Body**: `{ displayName?, category? }`
**Response 200**: `{ id, name, ... }`

### DELETE /api/v1/components/:id
**Response 204**: (no body) — blocked with 409 if referenced by fields

### POST /api/v1/components/:id/fields
**Body**: same as content type field body
**Response 201**: `{ id, componentId, name, fieldType, ..., activeSchemaVersion (bumped) }`

### GET /api/v1/components/:id/fields
**Response 200**: `{ data: [{ id, name, fieldType, sortOrder, ... }] }`

## Error Responses

- **400**: Invalid request body (Zod validation)
- **401**: Unauthorized (no session/token)
- **403**: Forbidden (insufficient permissions)
- **404**: Resource not found
- **409**: Conflict (duplicate name/slug, or soft-block delete)
- **422**: Validation error (reserved field name, invalid fieldType, invalid config)
