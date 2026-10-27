# Implementation Plan: Content Types and Schema Registry (Slice 2)

**Branch**: `003-content-types` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-content-types/spec.md`

## Summary

Slice 2 delivers the Schema Registry: content types (collection/single), typed fields with validation configs, reusable components, dynamic zones, and append-only schema versioning. All models are defined at runtime as data rows (D1 — no per-type DDL). The registry is the single source of truth consumed by the document service (Slice 3) and the admin SPA. RBAC permission checks (from Slice 1) gate every mutation.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js 22 LTS
**Primary Dependencies**: Drizzle ORM 0.45, Zod 4, Express 4, @peggy/db, @peggy/auth, @peggy/http, @peggy/shared
**Storage**: PostgreSQL 16 (content_types, content_fields, components, schema_versions)
**Testing**: Vitest (unit + integration against Postgres)
**Target Platform**: AWS Lambda (API), local dev via Docker
**Project Type**: Monorepo — `packages/db`, `packages/auth`, `packages/http`, `apps/api`
**Performance Goals**: Content type + field CRUD < 2s, schema version bump on every field mutation
**Constraints**: Lambda 29s timeout, RBAC permission checks on every mutation, reserved-name blocking, exactly-one-owner on fields
**Scale/Scope**: Single project (D2). Schema registry only — no content documents (Slice 3).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P-01 API never touches DB**: Controllers (routes) take services via DI; services in `@peggy/auth`/`@peggy/db` handle persistence.
- [x] **P-02 Domain never imports infra**: `@peggy/domain` remains empty; registry logic lives in `@peggy/auth` services + `@peggy/db` schema. No Express/Drizzle in domain.
- [x] **P-03 Core never imports Cloudinary SDK**: No media code in this slice (media_config stored as JSONB, enforced in service).
- [x] **P-04 Core never imports Next.js**: Admin is separate; registry is API-only.
- [x] **DB-01/DB-02/DB-03**: Content types/fields/components are relational system metadata (migrated). No polymorphic FKs — exactly-one-owner CHECK on content_fields. No in-request DDL. Schema changes are data rows (schema_versions).
- [x] **Auth Port**: All mutations gated by `requirePermission` from Slice 1.
- [x] **D2 Single-project**: No tenant_id. No organization plugin.
- [x] **Security baseline**: RBAC on every mutation. Reserved-name blocking. Soft-block delete with 409.
- [x] **Quality gates**: OpenAPI snapshot covers 100% of routes. Unit tests for schema version bump logic.

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-content-types/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── content-types-endpoints.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── db/src/
│   ├── schema-content-types.ts   # content_types, content_fields, components, schema_versions
│   └── schema.ts                # barrel export (updated)
├── auth/src/
│   ├── content-types.ts         # content type service (CRUD, soft-delete, versioning)
│   ├── fields.ts               # field service (CRUD, reserved-name check, version bump)
│   └── components.ts           # component service (CRUD, soft-delete guard)
└── http/src/
    └── app.ts                  # createApp (unchanged — auth already wired)

apps/
└── api/src/
    ├── routes/
    │   ├── content-types.ts    # /api/v1/content-types + /{id}/fields
    │   └── components.ts      # /api/v1/components + /{id}/fields
    ├── server.ts               # wire new routers
    └── lambda.ts               # wire new routers
```

**Structure Decision**: Registry logic in `@peggy/auth` (services) + `@peggy/db` (schema). Routes in `apps/api`. Follows Slice 1 patterns. No new packages needed.

## Complexity Tracking

No violations. Table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | | |EOF
echo "plan.md written"