# Quickstart: Media Library (Slice 5)

## Prerequisites

- Slice 3 complete (documents + publish working).
- `peggy_test` (or dev) database migrated; `locales` seeded with default `en`.
- Cloudinary account (or stub provider) with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` set.
- Authenticated user with `media.upload` + `media.manage` (or API token with those scopes).

## 1. Create a folder

```bash
curl -X POST localhost:3000/api/v1/media-folders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"landing"}'
# → 201 { id, name: "landing", path: "/landing" }
```

## 2. Sign an upload

```bash
curl -X POST localhost:3000/api/v1/media/sign \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"filename":"hero.jpg","mime":"image/jpeg","sizeBytes":123456,"folderId":"<id>"}'
# → 200 { url, params: { timestamp, signature, ... } }
```

## 3. Upload bytes direct to provider (no API bytes)

```bash
curl -X POST "$URL" -F "file=@hero.jpg" -F "timestamp=$TS" \
  -F "api_key=$KEY" -F "signature=$SIG"
# → provider response with public_id
```

## 4. Confirm → metadata row

```bash
curl -X POST localhost:3000/api/v1/media \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"providerKey":"<public_id>","mime":"image/jpeg","sizeBytes":123456,"alt":"Hero"}'
# → 201 asset row with secure_url
```

## 5. Read with transform URLs

```bash
curl localhost:3000/api/v1/media/<id> -H "Authorization: Bearer $TOKEN"
# → 200 { ..., transformUrls: { thumb, card, hero, original } }
```

## 6. Delete guard

Attach the asset to a published document, then:

```bash
curl -X DELETE localhost:3000/api/v1/media/<id> -H "Authorization: Bearer $TOKEN"
# → 409 MEDIA_REFERENCED { references: [...] }
curl -X DELETE 'localhost:3000/api/v1/media/<id>?force=true' -H "Authorization: Bearer $TOKEN"
# → 204
```

## Expected outcomes

- Zero file bytes traverse the API handler at any point (verify via Content-Length guard: direct 20MB POST → 413).
- `exe`/SVG uploads → 422 before any provider call.
- Arch check passes: no `cloudinary` import outside `packages/storage/src/cloudinary-provider.ts`.
