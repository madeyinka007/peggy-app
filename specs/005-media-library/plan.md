# Implementation Plan: Media Library (Slice 5)

**Branch**: `005-media-library` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-media-library/spec.md`

## Summary

Media Library: signed-upload flow (sign → direct-to-Cloudinary PUT → confirm), provider-agnostic asset metadata in Postgres, hierarchical folders with trigger-maintained paths, read-time transform URLs, and ledger-backed delete guards. `MediaService` lives in `@peggy/storage` behind the `StorageProvider` port; schema in `@peggy/db`; routes in `apps/api`. No file bytes through the serverless handler.

## Technical Context

**Language/Version**: TypeScript 5.6, Node >= 22 (engines), ESM (`type: module`)

**Primary Dependencies**: Express 4.21 (apps/api), Drizzle ORM 0.45 + pg, `cloudinary` npm (provider adapter ONLY), Better Auth (authN), Zod (validation)

**Storage**: Postgres 16 (local dev via Docker; Neon HTTP in prod). Tables: `media_folders`, `media_assets`, `media_usage` (migrated). Binaries in Cloudinary; only metadata in PG.

**Testing**: vitest 4.1.12 (packages/auth, packages/storage) + tsx smoke runners; `peggy_test` scratch DB; tsx 4.19.2

**Target Platform**: AWS Lambda via `serverless-http` (same Express app as local `listen()`); Next.js static admin consumes the API

**Project Type**: Modular monolith — web-service API + static SPA + shared packages

**Performance Goals**: Sign < 200ms p95 (pure crypto, no I/O except validation); confirm dominated by provider HEAD round trip; delete-guard O(1) via ledger; public asset reads paginated (default 25, max 100)

**Constraints**: No file bytes through handler (413 guard); core never imports Cloudinary SDK (P-03); no in-request DDL (DB-03); transactional ledger writes with versions; serverless-safe (no sockets beyond pg pool in dev, Neon HTTP in prod)

**Scale/Scope**: Single project per deploy (D2). Media assets + folders + usage ledger. S3/R2/local providers out of scope (port-ready). Admin picker UI out of scope (Slice 6+).

## Constitution Check

- [x] **P-01 API never touches the DB**: routes call `MediaService` via DI; no `db` import in `apps/api/src/routes/media.ts`.
- [x] **P-02 Domain never imports Express/Drizzle/Next/Cloudinary/Better Auth**: `MediaService` + `StorageProvider` port are pure TS; Drizzle only in `@peggy/db` schema + adapters.
- [x] **P-03 Core never imports the Cloudinary SDK**: SDK import confined to `packages/storage/src/cloudinary-provider.ts`; enforced by arch test / boundary lint (SC-005).
- [x] **P-04 Core never imports Next.js**: admin is a pure API consumer; no admin code in this slice.
- [x] **II Metadata vs content**: `media_*` tables are relational system metadata (migrated); binaries live in Cloudinary.
- [x] **DB-02/DB-03**: explicit edge table (`media_usage`), no polymorphic FKs; no in-request DDL (trigger + migrations only).
- [x] **Auth Port**: `media.upload` / `media.manage` via `requirePermission` (Slice 1 RBAC); token scopes reuse permission strings.
- [x] **D2 single-project**: no `tenant_id` columns.

*Post-design re-check: no new violations introduced. Folder-path trigger is a migration (not in-request DDL). Provider HEAD check is outbound fetch, not background work in-request beyond the confirm round trip.*

## Project Structure

### Documentation (this feature)

```text
specs/005-media-library/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (media-endpoints.md)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/db/src/
├── schema-media.ts      # media_folders, media_assets, media_usage tables
└── schema.ts            # barrel re-export (append)
packages/db/drizzle/
└── 0006_media_library.sql  # tables + path trigger + cycle/depth guard
packages/storage/src/
├── provider.ts          # StorageProvider port interface
├── cloudinary-provider.ts  # CloudinaryProvider (ONLY cloudinary SDK import)
├── media-service.ts     # MediaService: sign/confirm/folders/delete/replace/transformUrl
└── index.ts             # barrel export
apps/api/src/routes/
└── media.ts             # media + media-folders routers (RBAC-gated)
apps/api/src/
├── server.ts            # wire media routers (append)
├── lambda.ts            # wire media routers (append)
└── openapi.ts           # append media paths (append)
```

**Structure Decision**: Media logic in `@peggy/storage` (services + provider) + `@peggy/db` (schema). Routes in `apps/api`. Follows Slice 3 pattern (services in package, routes in api). No new packages.

## Complexity Tracking

No constitution violations. Folder-path trigger is the only DB-procedural piece; it ships as a migration (allowed — DB-03 bans *in-request* DDL, not triggers).
