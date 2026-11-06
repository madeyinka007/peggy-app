# Quickstart: Schema-Driven Admin SPA (Slice 6)

**Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/admin-api-client.md](./contracts/admin-api-client.md)

Validates the slice end-to-end against a live API. Prerequisites: API running locally (`pnpm --filter @peggy/api dev` or equivalent per repo docs) with Postgres + Cloudinary env configured; a super-admin user seeded; `NEXT_PUBLIC_API_URL` pointing at the API (e.g. `http://localhost:3000`).

## 1. Boot the admin

```bash
cd apps/admin
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm dev
# open http://localhost:3001 (or the port Next assigns)
```

Expect: unauthenticated visit to `/` redirects to `/login`; login with the seeded super-admin succeeds and lands on the dashboard; nav shows Content, Media, Content-Types. **Verify-live items from the contract**: confirm no CSRF/origin header is needed for cookie mutations, and the role→permissions read chain works for a non-admin user.

## 2. Content round-trip (SC-001)

1. Ensure a `Post` collection type exists via API (title/slug/body/cover[media], `isLocalized`, `hasDraftPublish`).
2. In admin: Content → Posts → table renders schema-derived columns + status badges.
3. New Post → fill form → required-field check fires inline on empty submit → save draft.
4. Publish en with confirmation → badge flips; fetch the public endpoint (`GET /api/v1/public/<slug-collection>/<slug>`) and confirm visibility.

## 3. French translation (SC-002)

Switch locale to fr → "translation missing" empty state (no en text shown) → fill → publish fr → public API serves fr independently of en.

## 4. RBAC (SC-003, US-04)

Log in as Author: nav shows Content + Media only; direct URL to `/content-types` shows forbidden; publish buttons hidden; server 403s surface as inline notices, never crashes. Log out → any protected route redirects to login with return-to.

## 5. Media flows (US-02)

Media Library: create/rename folder, upload an image (progress bar → appears in grid), search filters, oversize/bad-MIME file shows the human-readable limit/reason error. From a Post `cover` field: picker → browse/search → select → thumbnail populates. Delete a referenced asset → 409 dialog lists referencing documents; force requires `media.manage`.

## 6. Schema agility (SC-004)

Add a field to `Post` via API → revisit list, form, and type views → new field appears with **no admin rebuild/redeploy**.

## 7. Static export (SC-006)

```bash
pnpm build   # next build → static export
```

Serve the `out/` directory from any static host; deep links (`/content/?contentType=…`, `/media/`) resolve; every view loads data client-side with loading/error states — no server required.
