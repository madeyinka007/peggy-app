# Tasks: Content Types and Schema Registry (Slice 2)

**Input**: Design documents from `/specs/003-content-types/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Verification tasks included as smoke tests.

**Organization**: Tasks grouped by user story (P1: content types, P1: fields, P2: components, P3: dynamic zones).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/*` + `apps/*` at repository root
- **DB schema**: `packages/db/src/`
- **Auth services**: `packages/auth/src/`
- **API routes**: `apps/api/src/routes/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify Slice 1 foundation and prepare Slice 2 dependencies

- [X] T001 Verify Slice 1 complete: tsc -b passes, /health + /ready return 200, auth sign-up/sign-in works
- [X] T002 [P] Add Zod to packages/auth/package.json dependencies (if not present)
- [X] T003 [P] Add @peggy/auth and @peggy/db to apps/api/package.json dependencies (already present from Slice 1)

**Checkpoint**: Slice 2 dependencies ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and service scaffolding that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create content type schema: content_types table in packages/db/src/schema-content-types.ts (per data-model.md)
- [X] T005 Create content field schema: content_fields table with exactly-one-owner CHECK in packages/db/src/schema-content-types.ts
- [X] T006 Create component schema: components table in packages/db/src/schema-content-types.ts
- [X] T007 Create schema version schema: schema_versions table in packages/db/src/schema-content-types.ts
- [X] T008 Update schema barrel export: packages/db/src/schema.ts re-exporting schema-content-types
- [X] T009 Create Drizzle migration for all Slice 2 tables: npx drizzle-kit generate → packages/db/drizzle/
- [X] T010 Apply migration to Postgres: npx drizzle-kit migrate
- [X] T011 Create reserved field name blocklist in packages/auth/src/content-types.ts (id, documentId, __component, createdAt, updatedAt, publishedAt, locale, etc.)
- [X] T012 Create field type enum and validation in packages/auth/src/fields.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin creates a content type (Priority: P1) 🎯 MVP

**Goal**: Admin can create, read, list, update, and delete content types with soft-block on delete.

**Independent Test**: POST /api/v1/content-types → 201. GET → lists type. DELETE with documents → 409.

### Implementation for User Story 1

- [X] T013 [US1] Implement content type service: createContentType, getContentType, listContentTypes, updateContentType, deleteContentType in packages/auth/src/content-types.ts
- [X] T014 [US1] Implement soft-block delete: check document count, return 409 unless force=true in packages/auth/src/content-types.ts
- [X] T015 [US1] Implement schema version creation: createSchemaVersion on content type creation (v1) in packages/auth/src/content-types.ts
- [X] T016 [US1] Create content type route handlers (POST/GET/PUT/DELETE /api/v1/content-types) in apps/api/src/routes/content-types.ts
- [X] T017 [US1] Wire content type routes into apps/api/src/server.ts and apps/api/src/lambda.ts
- [X] T018 [US1] Add RBAC permission checks (content-type.create, content-type.read, content-type.update, content-type.delete) to routes
- [X] T019 [US1] Verify: create content type → 201 with correct data
- [X] T020 [US1] Verify: duplicate name/slug → 409
- [X] T021 [US1] Verify: delete with documents → 409 unless force=true

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin defines fields on a content type (Priority: P1)

**Goal**: Admin can add typed fields with validation, localization, required flags, and ordering. Field mutations bump schema version.

**Independent Test**: POST /api/v1/content-types/{id}/fields → 201. GET content type → fields ordered by sortOrder.

### Implementation for User Story 2

- [X] T022 [US2] Implement field service: createField, getField, listFields, updateField, deleteField in packages/auth/src/fields.ts
- [X] T023 [US2] Implement reserved-name check: reject reserved field names with 422 in packages/auth/src/fields.ts
- [X] T024 [US2] Implement field validation config: validate field type and config shape (relation, component, dynamiczone, media) in packages/auth/src/fields.ts
- [X] T025 [US2] Implement schema version bump: increment activeSchemaVersion + create schema_versions row on field mutation in packages/auth/src/fields.ts
- [X] T026 [US2] Implement field deprecation: soft-delete sets deprecated flag, keeps field readable on old docs in packages/auth/src/fields.ts
- [X] T027 [US2] Create field route handlers (POST/GET/PUT/DELETE /api/v1/content-types/{id}/fields) in apps/api/src/routes/content-types.ts
- [X] T028 [US2] Add RBAC permission checks (content-type.update for field mutations) to routes
- [X] T029 [US2] Verify: add field → 201, activeSchemaVersion increments
- [X] T030 [US2] Verify: reserved name → 422
- [X] T031 [US2] Verify: fields returned ordered by sortOrder

**Checkpoint**: User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Admin creates reusable components (Priority: P2)

**Goal**: Admin can create components with their own fields, reusable across content types.

**Independent Test**: POST /api/v1/components → 201. POST /api/v1/components/{id}/fields → 201. GET → lists components.

### Implementation for User Story 3

- [X] T032 [US3] Implement component service: createComponent, getComponent, listComponents, updateComponent, deleteComponent in packages/auth/src/components.ts
- [X] T033 [US3] Implement soft-block delete: check field references, return 409 if referenced in packages/auth/src/components.ts
- [X] T034 [US3] Implement schema version creation: createSchemaVersion on component creation (v1) in packages/auth/src/components.ts
- [X] T035 [US3] Create component route handlers (POST/GET/PUT/DELETE /api/v1/components) in apps/api/src/routes/components.ts
- [X] T036 [US3] Create component field route handlers (POST/GET /api/v1/components/{id}/fields) in apps/api/src/routes/components.ts
- [X] T037 [US3] Wire component routes into apps/api/src/server.ts and apps/api/src/lambda.ts
- [X] T038 [US3] Add RBAC permission checks (component.create, component.read, component.update, component.delete) to routes
- [X] T039 [US3] Verify: create component → 201 with correct data
- [X] T040 [US3] Verify: duplicate name → 409
- [X] T041 [US3] Verify: delete referenced component → 409

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Admin manages dynamic zones (Priority: P3)

**Goal**: Admin can configure dynamic zones on content types — ordered lists of allowed components.

**Independent Test**: POST field with type "dynamiczone" and dynamiczoneConfig → 201. GET content type → field includes allowedComponents.

### Implementation for User Story 4

- [X] T042 [US4] Implement dynamic zone config validation: validate allowedComponents array references existing components in packages/auth/src/fields.ts
- [X] T043 [US4] Implement dynamic zone field CRUD: create/update/delete dynamiczone fields with config in packages/auth/src/fields.ts
- [X] T044 [US4] Verify: create dynamiczone field with allowedComponents → 201
- [X] T045 [US4] Verify: update allowedComponents list → schema version bumps

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T046 [P] Add OpenAPI snapshot generation for all new routes
- [X] T047 [P] Add unit tests for schema version bump logic (≥80% branch coverage)
- [X] T048 [P] Add integration tests for content type CRUD (create, read, list, update, delete, soft-block)
- [X] T049 [P] Add integration tests for field CRUD (create, reserved-name rejection, version bump)
- [X] T050 [P] Add integration tests for component CRUD (create, delete guard)
- [X] T051 Update @peggy/http createApp if needed for new route wiring
- [X] T052 Run quickstart.md validation end-to-end
- [X] T053 Verify tsc -b passes for all packages and apps/api
- [X] T054 Verify no polymorphic FKs (exactly-one-owner CHECK on content_fields)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational — can run in parallel with US1 (different files: fields.ts vs content-types.ts)
- **US3 (Phase 5)**: Depends on Foundational — can run in parallel with US1/US2 (different files: components.ts)
- **US4 (Phase 6)**: Depends on US2 (field service) — dynamic zones are a field type
- **Polish (Phase 7)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories
- **US2 (P1)**: No dependencies on US1 (fields service is independent of content type service)
- **US3 (P2)**: No dependencies on US1/US2 (components are independent)
- **US4 (P3)**: Depends on US2 (field service must support dynamiczone type)

### Within Each User Story

- Schema before services
- Services before routes
- Routes before verification
- Verification tasks can run in parallel

### Parallel Opportunities

- T004-T007 (schema tables) can run in parallel (different tables, same file — sequential within file)
- T013-T015 (content type service functions) can run in parallel (different functions, same file)
- T022-T026 (field service functions) can run in parallel (different functions, same file)
- T032-T034 (component service functions) can run in parallel (different functions, same file)
- US1, US2, US3 can run in parallel after Foundational (different service files)
- All verification tasks within a story can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (content types)
4. Complete Phase 4: User Story 2 (fields)
5. **STOP and VALIDATE**: Test content type + field CRUD independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Content types work (MVP!)
3. User Story 2 → Fields work (schema registry functional)
4. User Story 3 → Components work (reusable structures)
5. User Story 4 → Dynamic zones work (advanced composition)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (content types)
   - Developer B: User Story 2 (fields)
   - Developer C: User Story 3 (components)
3. Developer A or B: User Story 4 (dynamic zones, depends on fields)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Schema changes are data rows — never DDL, never part of migrations (Constitution III)
- Reserved field names enforced at service layer, not DB (research Decision 4)
- Exactly-one-owner CHECK on content_fields (DB-02, no polymorphic FK)

## Phase 8: Convergence

- [X] T055 Implement OpenAPI snapshot endpoint at /api/v1/openapi.json covering all routes per FR-016 (missing)
- [X] T056 Add unit tests for schema version bump logic (>=80% branch coverage) per Constitution VII (missing)
- [X] T057 Add integration tests for content type CRUD (create, read, list, update, delete, soft-block 409) per SC-002 (missing)
- [X] T058 Add integration tests for field CRUD (create, reserved-name rejection 422, version bump, deprecation) per SC-003 (missing)
- [X] T059 Add integration tests for component CRUD (create, delete guard 409) per SC-002 (missing)
- [X] T060 Wire RBAC requirePermission checks for content-type.* and component.* actions in routes per FR-001..FR-015 (partial)
