# Quickstart: Content Documents and Publishing (Slice 3)

## Prerequisites

- Slice 2 complete (content types and schema registry working)
- Local Postgres running (docker compose)
- `.env` configured with DATABASE_URL

## Setup

```bash
# Apply schema migration
cd packages/db && npx drizzle-kit generate && npx drizzle-kit migrate

# Seed a default locale
psql $DATABASE_URL -c "INSERT INTO locales (code, name, is_default) VALUES ('en', 'English', true) ON CONFLICT DO NOTHING;"
```

## Validate

```bash
# 1. Create content type (from Slice 2)
curl -s -X POST http://localhost:3000/api/v1/content-types \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"post","kind":"collection","collectionSlug":"posts"}'

# 2. Add a field
curl -s -X POST http://localhost:3000/api/v1/content-types/{id}/fields \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"title","fieldType":"text","required":true}'

# 3. Create document
curl -s -X POST http://localhost:3000/api/v1/documents \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"contentTypeId":"{ctId}","locale":"en","data":{"title":"Hello World"}}'
# Expected: 201 with document + draft version

# 4. Publish
curl -s -X POST http://localhost:3000/api/v1/documents/{docId}/publish \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"locale":"en"}'
# Expected: 200 with published pointer

# 5. Public query
curl -s http://localhost:3000/api/v1/public/posts?locale=en
# Expected: 200 with published document

# 6. Draft leak check
curl -s http://localhost:3000/api/v1/public/posts?locale=en
# Expected: draft-only documents NOT in results (0 rows)

# 7. Save new version
curl -s -X PUT http://localhost:3000/api/v1/documents/{docId} \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"locale":"en","data":{"title":"Updated Title"}}'
# Expected: 200 with version 2

# 8. Version history
curl -s http://localhost:3000/api/v1/documents/{docId}/versions?locale=en -b cookies.txt
# Expected: 200 with v1 and v2

# 9. Unpublish
curl -s -X POST http://localhost:3000/api/v1/documents/{docId}/unpublish \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"locale":"en"}'
# Expected: 200, document no longer in public query

# 10. Soft delete
curl -s -X DELETE http://localhost:3000/api/v1/documents/{docId} -b cookies.txt
# Expected: 204, document tombstoned
```

## Troubleshooting

- 404 on public query: ensure document is published for the requested locale
- 409 on publish: slug conflict — another published document has the same slug
- 422 on create: data doesn't match content type schema
- Draft leak: verify `published_version_id IS NOT NULL` predicate in query
