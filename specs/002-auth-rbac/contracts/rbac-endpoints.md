# Contract: RBAC & Token Endpoints

All endpoints require session cookie auth (admin) unless noted.

## Roles

### POST /api/v1/roles
**Body**: `{ name, description? }`
**Response 201**: `{ id, name, description, createdAt, updatedAt }`

### GET /api/v1/roles
**Response 200**: `{ data: [{ id, name, description, ... }] }`

### PUT /api/v1/roles/:id
**Body**: `{ name?, description? }`
**Response 200**: `{ id, name, description, ... }`

### DELETE /api/v1/roles/:id
**Response 204**: (no body)

## Permissions

### POST /api/v1/permissions
**Body**: `{ resource, action, description? }`
**Response 201**: `{ id, resource, action, description }`

### GET /api/v1/permissions
**Response 200**: `{ data: [{ id, resource, action, description }] }`

## Role-Permission Assignment

### POST /api/v1/roles/:roleId/permissions
**Body**: `{ permissionId }`
**Response 201**: `{ roleId, permissionId }`

### DELETE /api/v1/roles/:roleId/permissions/:permissionId
**Response 204**

## User-Role Assignment

### POST /api/v1/users/:userId/roles
**Body**: `{ roleId }`
**Response 201**: `{ userId, roleId }`

### DELETE /api/v1/users/:userId/roles/:roleId
**Response 204**

## API Tokens

### POST /api/v1/tokens (session auth required)
**Body**: `{ name, scopes: string[] }`
**Response 201**: `{ id, name, prefix, token (shown once), scopes, createdAt }`
**Note**: `token` is returned only at creation. Only `hashedToken` is stored.

### GET /api/v1/tokens (session auth required)
**Response 200**: `{ data: [{ id, name, prefix, scopes, revokedAt, lastUsedAt, createdAt }] }`

### DELETE /api/v1/tokens/:id (session auth required)
**Response 204**: (revokes token by setting revokedAt)

### Auth via Bearer token (programmatic)
**Header**: `Authorization: Bearer pk_xxx...` or `sk_xxx...`
**Behavior**: Token is hashed, looked up in api_tokens, user validated (isActive), permissions attached from token scopes. Used for public/programmatic API endpoints.
