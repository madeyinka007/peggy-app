# Quickstart: Content Types and Schema Registry (Slice 2)

## Prerequisites

- Slice 1 complete (auth + RBAC working)
- Local Postgres running (docker compose)
- `.env` configured with DATABASE_URL

## Setup

```bash
# Apply schema migration
cd packages/db && npx drizzle-kit generate && npx drizzle-kit migrate
```

## Validate

```bash
# 1. Create content type
curl -s -X POST http://localhost:3000/api/v1/content-types \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"post","kind":"collection","collectionSlug":"posts","displayName":"Blog Post"}'
# Expected: 201 with content type

# 2. Add field
curl -s -X POST http://localhost:3000/api/v1/content-types/{id}/fields \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"title","fieldType":"text","required":true,"sortOrder":1}'
# Expected: 201 with field, activeSchemaVersion=2

# 3. Create component
curl -s -X POST http://localhost:3000/api/v1/components \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"seo","displayName":"SEO","category":"seo"}'
# Expected: 201 with component

# 4. Add field to component
curl -s -X POST http://localhost:3000/api/v1/components/{id}/fields \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"metaTitle","fieldType":"text","required":true,"sortOrder":1}'
# Expected: 201 with field

# 5. List content types
curl -s http://localhost:3000/api/v1/content-types -b cookies.txt
# Expected: 200 with data array

# 6. Reserved name rejection
curl -s -X POST http://localhost:3000/api/v1/content-types/{id}/fields \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"id","fieldType":"text"}'
# Expected: 422 validation error

# 7. Soft-block delete
curl -s -X DELETE http://localhost:3000/api/v1/content-types/{id} -b cookies.txt
# Expected: 204 (no documents yet) or 409 if documents exist
```

## Troubleshooting

- 401 Unauthorized: ensure session cookie is set (sign in first)
- 409 Conflict on delete: content type has documents — use ?force=true
- 422 on field creation: check reserved name list and fieldType validity
- Schema version not incrementing: verify field mutation triggers version bump
