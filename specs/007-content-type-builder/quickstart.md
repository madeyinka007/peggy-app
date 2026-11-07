# Quickstart: Content-Type Builder (Slice 7)

**Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/builder-registry-endpoints.md](./contracts/builder-registry-endpoints.md)

Validates the slice end-to-end against a live API. Prerequisites: API running locally with Postgres env configured; a super-admin seed; a low-privilege Author user; `NEXT_PUBLIC_API_URL` pointing at the API; admin running (`apps/admin`, `pnpm dev`).

## 1. Boot + live route verification (feeds R-07-07)

Against the live API as super-admin (curl or equivalent), confirm the foundation contract before touching the UI:

1. `PUT /api/v1/content-types/:id/fields/:fieldId` and `DELETE ...` as Author → expect **403** (guard proof for R-07-07 item 1); repeat all 8 gated mutation routes.
2. Create a scratch type, add a document to it (via `POST /api/v1/documents`), then `DELETE /api/v1/content-types/:id` → **record the exact status + body** (R-07-07 item 2 feeds the FR-105 mapper). Clean up the scratch type + document afterwards.
3. `PUT /api/v1/components/:id/fields/:fieldId` + `DELETE ...` as super-admin on a scratch component field → 200/204 with component version bumped (new-route proof).

## 2. Type lifecycle (SC-101 first half)

1. Admin → Content-Types → New content type → create `Product` (collection, slug `products`) → lists with **v1**.
2. Duplicate-name submit → inline 400, payload preserved. Bad slug (`Bad_Slug!`) → inline slug message.
3. Edit `Product` display name + toggle i18n on → detail updates, **version stays v1**.
4. Delete `Product` (confirm dialog states irreversibility) → gone from list.

## 3. Field lifecycle (SC-101 second half)

1. Open `Post` → add `subtitle` (text, localized) → appears in table, **version +1**.
2. Add `status` (enumeration, `validation: {"options": ["draft","review"]}`) → select renders options.
3. Reserved name (`id`) → inline 422 on the name input, nothing created.
4. Edit `subtitle` label → **version +1**. Attempt `fieldType` change → confirmation warning appears.
5. Move `subtitle` above `title` → leave, revisit → order persists.
6. Remove `subtitle` → deprecation notice shown; row **remains listed**; **version +1**.

## 4. Components (SC-102)

1. New component `SEO` → v1. Add `metaTitle` (text) → component **version +1**.
2. Reference `SEO` from a `Post` field's `componentConfig` → delete `SEO` → refused with reference named.
3. Remove the reference → delete succeeds.

## 5. RBAC (SC-103)

Log in as Author: builder actions absent (read views intact); replay any mutation via direct call → 403 inline notice, no crash. Partial-permission user (`content-type.update` only): edit affordances present, delete absent. Expire the session mid-builder-draft → 401 → login redirect with draft restored.

## 6. Static export (SC-104)

`pnpm build` → `out/`; serve statically; builder deep links (`/content-types/?type=…&action=…`) resolve; every builder view shows loading/error/empty states with no server.

## Recording results

Append pass/fail per SC-101…SC-104 plus the step-1 live-verification answers (esp. the type-delete refusal shape) to `research.md` under a `## Verify-Live Results (date)` heading, mirroring the Slice 6 T009/T030 convention.
