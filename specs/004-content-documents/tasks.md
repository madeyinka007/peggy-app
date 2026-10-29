# Tasks: Content Documents and Publishing (Slice 3)

**Input**: Design documents from `/specs/004-content-documents/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Verification tasks included as smoke tests.

**Organization**: Tasks grouped by user story (P1: create, P1: publish, P2: versioning, P2: public query, P3: delete).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/*` + `apps/*` at repository root
- **DB schema**: `packages/db/src/`
- **Auth services**: `packages/auth/src/`
- **API routes**: `apps/api/src/routes/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify Slice 2 foundation and prepare Slice 3 dependencies

- [X] T001 Verify Slice 2 complete: tsc -b passes, content type CRUD works, /health + /ready return 200
- [X] T002 [P] Seed default locale ('en') in Postgres if not present

**Checkpoint**: Slice 3 dependencies ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and service scaffolding that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create document schema: documents, document_locales, document_versions, document_relations, locales tables in packages/db/src/schema-documents.ts (per data-model.md)
- [X] T004 Update schema barrel export: packages/db/src/schema.ts re-exporting schema-documents
- [X] T005 Create Drizzle migration for all Slice 3 tables: npx drizzle-kit generate → packages/db/drizzle/
- [X] T006 Apply migration to Postgres: npx drizzle-kit migrate
- [X] T007 Create immutability trigger: reject UPDATE/DELETE on document_versions (SQL trigger)
- [X] T008 Create content_type immutability trigger: reject UPDATE of content_type_id on documents
- [X] T009 Create exactly-one-draft invariant: CHECK(draft_version_id <> published_version_id OR either null) on document_locales

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin creates a document (Priority: P1) 🎯 MVP

**Goal**: Admin can create a document with validated payload, creating document identity + draft version + locale pointer in one transaction.

**Independent Test**: POST /api/v1/documents → 201 with document + draft version. GET /api/v1/documents/:id → returns document.

### Implementation for User Story 1

- [X] T010 [US1] Implement document service: createDocument (transaction: documents + document_versions + document_locales) in packages/auth/src/documents.ts
- [X] T011 [US1] Implement data validation: validate payload against content type schema (required fields, types, validation rules) in packages/auth/src/documents.ts
- [X] T012 [US1] Implement slug extraction: extract slug from uid field, normalize, store on document_versions in packages/auth/src/documents.ts
- [X] T013 [US1] Implement slug uniqueness check: partial unique index enforcement (per-locale) in packages/auth/src/documents.ts
- [X] T014 [US1] Implement getDocument: read document with draft version data in packages/auth/src/documents.ts
- [X] T015 [US1] Implement listDocuments: list documents by content type with pagination in packages/auth/src/documents.ts
- [X] T016 [US1] Create document route handlers (POST/GET/PUT/DELETE /api/v1/documents) in apps/api/src/routes/documents.ts
- [X] T017 [US1] Wire document routes into apps/api/src/server.ts and apps/api/src/lambda.ts
- [X] T018 [US1] Add RBAC permission checks (document.create, document.read, document.update, document.delete) to routes
- [X] T019 [US1] Verify: create document → 201 with correct data + draft version
- [X] T020 [US1] Verify: invalid data (missing required field) → 422
- [X] T021 [US1] Verify: slug conflict → 409

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin publishes a document (Priority: P1)

**Goal**: Admin can publish/unpublish a draft version for a specific locale (O(1) pointer flip). Published content visible via public API.

**Independent Test**: POST /api/v1/documents/:id/publish → 200. GET /api/v1/public/posts → returns published document.

### Implementation for User Story 2

- [X] T022 [US2] Implement publish service: set publishedVersionId + publishedAt + firstPublishedAt on document_locales in packages/auth/src/publishing.ts
- [X] T023 [US2] Implement unpublish service: clear publishedVersionId + publishedAt in packages/auth/src/publishing.ts
- [X] T024 [US2] Implement publish route handlers (POST /api/v1/documents/:id/publish, /unpublish) in apps/api/src/routes/documents.ts
- [X] T025 [US2] Add RBAC permission checks (document.publish) to routes
- [X] T026 [US2] Verify: publish → 200, published pointer set
- [X] T027 [US2] Verify: unpublish → 200, published pointer cleared
- [X] T028 [US2] Verify: draft-leak prevention — published query returns 0 rows for draft-only content

**Checkpoint**: User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Admin saves a new version (Priority: P2)

**Goal**: Admin can save changes (new immutable version), view version history, and restore old versions.

**Independent Test**: PUT /api/v1/documents/:id → 200 with v2. GET /api/v1/documents/:id/versions → lists v1 and v2.

### Implementation for User Story 3

- [X] T029 [US3] Implement version creation: create new document_versions row, move draft pointer in packages/auth/src/documents.ts
- [X] T030 [US3] Implement version history: list all versions for a document+locale in packages/auth/src/versions.ts
- [X] T031 [US3] Implement restore: create new version from old version's data, move draft pointer in packages/auth/src/versions.ts
- [X] T032 [US3] Create version route handlers (GET /api/v1/documents/:id/versions, POST /api/v1/documents/:id/restore) in apps/api/src/routes/documents.ts
- [X] T033 [US3] Verify: save new version → 200 with incremented version number
- [X] T034 [US3] Verify: version history → lists all versions
- [X] T035 [US3] Verify: restore to v1 → creates v3 with v1's data

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Public consumer queries published content (Priority: P2)

**Goal**: Public API returns only published documents with filtering, sorting, and pagination. Draft content never leaked.

**Independent Test**: GET /api/v1/public/posts?locale=en → returns only published documents.

### Implementation for User Story 4

- [X] T036 [US4] Implement Query Engine: build SQL against document_versions (published pointer IS NOT NULL) + documents (not deleted) in packages/auth/src/query-engine.ts
- [X] T037 [US4] Implement filtering: field-level filters with operators ($eq, $ne, $gt, $lt, $contains, $in) in packages/auth/src/query-engine.ts
- [X] T038 [US4] Implement sorting: sort by extracted columns or created_at in packages/auth/src/query-engine.ts
- [X] T039 [US4] Implement pagination: page/pageSize with total count in packages/auth/src/query-engine.ts
- [X] T040 [US4] Implement locale defaulting: default to default locale if not specified in packages/auth/src/query-engine.ts
- [X] T041 [US4] Create public route handlers (GET /api/v1/public/{collectionSlug}, GET /api/v1/public/{collectionSlug}/{slug}) in apps/api/src/routes/documents.ts
- [X] T042 [US4] Verify: public query returns only published documents (draft-leak: 0 rows)
- [X] T043 [US4] Verify: filtering works correctly
- [X] T044 [US4] Verify: sorting works correctly
- [X] T045 [US4] Verify: pagination works correctly

**Checkpoint**: User Stories 1-4 should all work independently

---

## Phase 7: User Story 5 - Admin deletes a document (Priority: P3)

**Goal**: Admin can soft-delete a document (tombstone). Document retained for audit/restore.

**Independent Test**: DELETE /api/v1/documents/:id → 204. GET → 404 (or 410 with includeDeleted).

### Implementation for User Story 5

- [X] T046 [US5] Implement soft-delete: set deletedAt on documents in packages/auth/src/documents.ts
- [X] T047 [US5] Implement includeDeleted query param: return tombstoned documents when requested in packages/auth/src/documents.ts
- [X] T048 [US5] Add delete route handler (DELETE /api/v1/documents/:id) in apps/api/src/routes/documents.ts
- [X] T049 [US5] Add RBAC permission check (document.delete) to route
- [X] T050 [US5] Verify: delete → 204, deletedAt set
- [X] T051 [US5] Verify: GET deleted → 404 (without includeDeleted)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T052 [P] Add locales CRUD (GET/POST /api/v1/locales) in apps/api/src/routes/documents.ts
- [X] T053 [P] Add unit tests for Query Engine filtering logic (>=80% branch coverage)
- [X] T054 [P] Add integration tests for document CRUD (create, read, update, delete, restore)
- [X] T055 [P] Add integration tests for publish/unpublish (pointer flip, draft-leak)
- [X] T056 [P] Add integration tests for public query (filter, sort, paginate)
- [X] T057 Update OpenAPI snapshot with new document routes
- [X] T058 Run quickstart.md validation end-to-end
- [X] T059 Verify tsc -b passes for all packages and apps/api
- [X] T060 Verify no polymorphic FKs (exactly-one-owner on content_fields, no polymorphic on documents)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 (needs document + draft version)
- **US3 (Phase 5)**: Depends on US1 (needs document + versions)
- **US4 (Phase 6)**: Depends on US2 (needs published content)
- **US5 (Phase 7)**: Depends on US1 (needs document to delete)
- **Polish (Phase 8)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — No dependencies
- **US2 (P1)**: Depends on US1 (publish needs a document with draft)
- **US3 (P2)**: Depends on US1 (versioning needs a document)
- **US4 (P2)**: Depends on US2 (public query needs published content)
- **US5 (P3)**: Depends on US1 (delete needs a document)

### Within Each User Story

- Schema before services
- Services before routes
- Routes before verification
- Verification tasks can run in parallel

### Parallel Opportunities

- T003-T009 (schema + triggers) can run in parallel (different tables)
- US3 can run in parallel with US2 (different service files: versions.ts vs publishing.ts)
- US5 can run in parallel with US2/US3 (different service file: documents.ts soft-delete)
- All verification tasks within a story can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (documents)
4. Complete Phase 4: User Story 2 (publishing)
5. **STOP and VALIDATE**: Test create + publish independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Documents work (MVP!)
3. User Story 2 → Publishing works (content goes live)
4. User Story 3 → Versioning works (history + restore)
5. User Story 4 → Public API works (consumption path)
6. User Story 5 → Deletion works (lifecycle complete)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (documents) → User Story 5 (delete)
   - Developer B: User Story 2 (publishing) → User Story 4 (public query)
   - Developer C: User Story 3 (versioning)
3. Stories complete and integrate independently

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
- Draft-leak prevention: IS NOT NULL predicate on published_version_id (hard CI gate)
- Immutability: trigger rejects UPDATE/DELETE on document_versions
- Content relations deferred to Slice 4

## Phase 9: Convergence

- [X] T061 Add RBAC permission checks (document.create, document.read, document.update, document.publish, document.delete) to all document mutation/read routes in apps/api/src/routes/documents.ts per FR-018 (missing)
- [X] T062 Create database-level constraints and triggers: immutability trigger rejecting UPDATE/DELETE on document_versions (T007), content_type_id immutability trigger on documents (T008), CHECK(draft_version_id IS DISTINCT FROM published_version_id) on document_locales (T009), and partial unique index on (content_type_id, locale, slug) WHERE slug IS NOT NULL (FR-014) per data-model.md (missing)
- [X] T063 Wrap createDocument in a single DB transaction (documents + document_versions + document_locales) per FR-002 (partial)
- [X] T064 Implement full data validation in document service: validate field types and validation rules, not only required presence, in packages/auth/src/documents.ts per FR-003 (partial)
- [X] T065 Implement correct per-locale slug uniqueness enforcement in packages/auth/src/documents.ts (create + update) and publish flow per FR-014 / US1 AC3 (partial)
- [X] T066 Implement Query Engine filtering (field-level $eq, $ne, $gt, $lt, $contains, $in) in packages/auth/src/query-engine.ts per FR-012 (missing)
- [X] T067 Implement Query Engine sorting by extracted columns / created_at / published_at in packages/auth/src/query-engine.ts per FR-012 (partial)
- [X] T068 Parse filters[...], sort, and pagination query params in public document routes in apps/api/src/routes/documents.ts per contract (missing)
- [X] T069 Default locale resolution from locales table (is_default) instead of hardcoded "en" in packages/auth/src/query-engine.ts per T040 / research Decision 7 (partial)
- [X] T070 Make publish an O(1) pointer flip only: remove document_versions status mutation from publishDocument per FR-008 / SC-003 / Constitution II (contradicts)
- [X] T071 Implement locale management POST (create locale) alongside GET in apps/api/src/routes/documents.ts per FR-017 / T052 (missing)
- [X] T072 Add integration/unit tests for Query Engine, document CRUD, publish/unpublish, and public query per T053-T056 (missing)
- [X] T073 Return publishedVersion object (not just id) from getDocument per contract FR-004 (partial)
- [X] T074 Make document_locales foreign keys DEFERRABLE per data-model.md constraint (partial)

## Phase 10: Convergence

- [X] T075 Add real integration/unit tests for document CRUD, publish/unpublish, public query, and Query Engine per T053-T056 (missing)
- [X] T076 Enforce content field validation rules (min/max/regex/etc.) from content_fields.validation in document service per FR-003 (partial)
- [X] T077 Create cross-table partial unique index enforcing (content_type_id, locale, slug) uniqueness per FR-014 (partial)
- [X] T078 Default locale resolution in createDocument (use default locale instead of hardcoded "en") per Decision 7 (partial)

## Phase 11: Convergence

- [X] T079 Add optimistic concurrency check on publish (verify draft pointer unchanged) per edge case concurrent publishes (partial)
- [X] T080 Update OpenAPI snapshot with document routes per T057 (missing)
