# Implementation Plan: Content Documents and Publishing (Slice 3)

**Branch**: `004-content-documents` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-content-documents/spec.md`

## Summary

Slice 3 delivers the core CMS: content documents with immutable versioning, per-locale publish pointers (O(1) publish), slug uniqueness, version history + restore, soft-delete (tombstone), and the public API (published-only with filtering/sorting/pagination). The Query Engine handles public reads with draft-leak prevention (IS NOT NULL on published_version_id). All mutations gated by RBAC from Slice 1. Depends on Slice 2 (content types, fields).

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js 22 LTS
**Primary Dependencies**: Drizzle ORM 0.45, Zod 4, Express 4, @peggy/db, @peggy/auth, @peggy/http, @peggy/shared
**Storage**: PostgreSQL 16 (documents, document_locales, document_versions, document_relations, locales)
**Testing**: Vitest (unit + integration against Postgres)
**Target Platform**: AWS Lambda (API), local dev via Docker
**Project Type**: Monorepo — `packages/db`, `packages/auth`, `packages/http`, `apps/api`
**Performance Goals**: Create + publish < 3s, public query < 500ms, publish is O(1) pointer flip
**Constraints**: Lambda 29s timeout, RBAC on all mutations, draft-leak prevention (hard CI gate), immutable versions (trigger rejects UPDATE/DELETE)
**Scale/Scope**: Single project (D2). Documents + publish + public API. Relations deferred to Slice 4.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P-01 API never touches DB**: Controllers (routes) take services via DI; services in `@peggy/auth`/`@peggy/db` handle persistence.
- [x] **P-02 Domain never imports infra**: `@peggy/domain` remains empty; document logic lives in `@peggy/auth` services + `@peggy/db` schema. No Express/Drizzle in domain.
- [x] **P-03 Core never imports Cloudinary SDK**: No media code in this slice (media handled via field config from Slice 2).
- [x] **P-04 Core never imports Next.js**: Admin is separate; documents are API-only.
- [x] **DB-01/DB-02/DB-03**: Documents/locales/versions are relational system metadata (migrated). No polymorphic FKs. No in-request DDL. Schema changes are data rows (Slice 2).
- [x] **Auth Port**: All mutations gated by `requirePermission` from Slice 1.
- [x] **D2 Single-project**: No tenant_id. No organization plugin.
- [x] **Security baseline**: RBAC on every mutation. Draft-leak prevention (IS NOT NULL predicate). Audit logging.
- [x] **Quality gates**: Draft-leak fixture is hard CI gate. Permission evaluator ≥80% branch coverage.

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-content-documents/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── documents-endpoints.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── db/src/
│   ├── schema-documents.ts       # documents, document_locales, document_versions, document_relations, locales
│   └── schema.ts                # barrel export (updated)
├── auth/src/
│   ├── documents.ts             # document service (create, read, update, delete, restore)
│   ├── publishing.ts            # publish/unpublish (pointer flip)
│   ├── versions.ts              # version history, restore
│   └── query-engine.ts          # public query (filter, sort, paginate, draft-leak prevention)
└── http/src/
    └── app.ts                  # unchanged

apps/
└── api/src/
    ├── routes/
    │   └── documents.ts        # /api/v1/documents + /api/v1/public/{slug}
    ├── server.ts               # wire new router
    └── lambda.ts               # wire new router
```

**Structure Decision**: Document logic in `@peggy/auth` (services) + `@peggy/db` (schema). Routes in `apps/api`. Follows Slice 1/2 patterns. No new packages.

## Complexity Tracking

No violations. Table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | | |EOF
echo "plan.md written"