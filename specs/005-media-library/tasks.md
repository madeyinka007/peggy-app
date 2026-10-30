# Tasks: Media Library (Slice 5)

**Input**: Design documents from `/specs/005-media-library/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Verification tasks included as smoke tests.

**Organization**: Tasks grouped by user story (P1: signed upload, P1: folders, P2: transforms, P2: delete/replace).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/*` + `apps/*` at repository root
- **DB schema**: `packages/db/src/`
- **Storage services + provider**: `packages/storage/src/`
- **API routes**: `apps/api/src/routes/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify prior slice and prepare shared dependencies for media

- [X] T001 Verify Slice 3/4 complete: `tsc --noEmit` passes for all packages, `/health` + `/ready` return 200
- [X] T002 [P] Add `cloudinary` dependency to `packages/storage/package.json` (provider adapter only) and env wiring in `packages/config/src/env.ts` if not already present

**Checkpoint**: Shared infrastructure ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and provider port that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create media schema: `media_folders`, `media_assets`, `media_usage` tables in `packages/db/src/schema-media.ts` (per `data-model.md`)
- [X] T004 Update schema barrel export: `packages/db/src/schema.ts` re-exporting `schema-media`
- [X] T005 Create Drizzle migration: `npx drizzle-kit generate` → `packages/db/drizzle/0006_media_library.sql`
- [X] T006 Create folder-path trigger: materialized `path` maintenance + cycle rejection + depth limit 8 in the migration (per `research.md` Decision 4)
- [X] T007 Apply migration to Postgres: `npx drizzle-kit migrate` (seed `locales` default if needed for later document/media_usage linkage)
- [X] T008 Create `StorageProvider` port interface in `packages/storage/src/provider.ts` (sign, confirm/verify, transformUrl, destroy)
- [X] T009 Create `CloudinaryProvider` adapter in `packages/storage/src/cloudinary-provider.ts` — ONLY file allowed to import `cloudinary` (per Constitution P-03)
- [X] T010 Export public API from `packages/storage/src/index.ts` (provider port + CloudinaryProvider + MediaService)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Editor uploads an image via signed URL (Priority: P1) 🎯 MVP

**Goal**: Editor obtains signed params, uploads bytes direct to Cloudinary, and confirms → metadata row in Postgres. Zero file bytes through the handler.

**Independent Test**: `POST /api/v1/media/sign` → 200 with signed params; `POST /api/v1/media` with providerKey → 201 asset row; direct large POST to API → 413.

### Implementation for User Story 1

- [X] T011 [US1] Implement `MediaService.signUpload` in `packages/storage/src/media-service.ts`: validate MIME allowlist + size limits (422 `MIME_NOT_ALLOWED` / `FILE_TOO_LARGE`), delegate signing to `StorageProvider.signUpload`
- [X] T012 [US1] Implement `MediaService.confirmUpload` in `packages/storage/src/media-service.ts`: HEAD/lookup cross-check against provider, reconcile metadata, insert `media_assets` row (422 `PROVIDER_KEY_NOT_FOUND` on miss)
- [X] T013 [US1] Add `Content-Length` guard for large payloads (413 `PAYLOAD_TOO_LARGE` with `{ signedFlow }`) at the media route layer in `apps/api/src/routes/media.ts`
- [X] T014 [US1] Create media route handlers (`POST /api/v1/media/sign`, `POST /api/v1/media`, `GET /api/v1/media`, `GET /api/v1/media/:id`) in `apps/api/src/routes/media.ts` with RBAC (`media.upload` / `media.read`)
- [X] T015 [US1] Wire media routes into `apps/api/src/server.ts` and `apps/api/src/lambda.ts`
- [X] T016 [US1] Append media paths to `apps/api/src/openapi.ts`
- [X] T017 [US1] Verify: sign → 200 with params; confirm with valid providerKey → 201; disallowed MIME → 422; oversize → 422; 20MB direct POST → 413

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Editor organizes assets in folders (Priority: P1)

**Goal**: Hierarchical folders with materialized paths, cycle/depth guards, and delete blocking.

**Independent Test**: Create nested folders → correct `path`; move into descendant → 422 `FOLDER_CYCLE`; depth > 8 → 422 `FOLDER_DEPTH_EXCEEDED`; delete non-empty without `recursive` → 409.

### Implementation for User Story 2

- [X] T018 [US2] Implement folder CRUD in `packages/storage/src/media-service.ts` (create, rename, move, delete) with service-level depth/cycle validation as defense-in-depth alongside the DB trigger
- [X] T019 [US2] Create folder route handlers (`GET /api/v1/media-folders`, `POST /api/v1/media-folders`, `PATCH /api/v1/media-folders/:id`, `DELETE /api/v1/media-folders/:id`) in `apps/api/src/routes/media.ts` (extend `T014`'s router)
- [X] T020 [US2] Add RBAC (`media.manage`) to folder routes and asset move (`PATCH /api/v1/media/:id` with `folderId`)
- [X] T021 [US2] Verify: nested create → correct path; cycle move → 422; deep nesting → 422; delete non-empty without recursive → 409; recursive + permission → 204

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Frontend consumes responsive images (Priority: P2)

**Goal**: Read-time Cloudinary transform URLs for MVP presets with no new DB rows.

**Independent Test**: `GET /api/v1/media/:id` returns `transformUrls: { thumb, card, hero, original }` (all with `f_auto,q_auto`); `transformUrl(asset, { w, h, format })` returns valid provider URL; no `media_assets` row is created on transform.

### Implementation for User Story 3

- [X] T022 [US3] Implement `transformUrl` in `packages/storage/src/cloudinary-provider.ts` (preset → transform string → `https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{publicId}`; `f_auto,q_auto` defaults)
- [X] T023 [US3] Expose transform URLs on asset read: extend `GET /api/v1/media/:id` in `apps/api/src/routes/media.ts` to include `transformUrls` from the provider
- [X] T024 [US3] Verify: presets return valid URLs with no DB write; custom `{ w, h, format }` honored; `f_auto,q_auto` present when not overridden

**Checkpoint**: User Stories 1, 2, AND 3 all work independently

---

## Phase 6: User Story 4 - Editor deletes or replaces an asset safely (Priority: P2)

**Goal**: Reference-guarded delete (409 `MEDIA_REFERENCED` with `references[]`) and replace with ledger-aware reference moves.

**Independent Test**: Asset referenced by published document → `DELETE` without force → 409 with `references[]`; with `?force=true` + `media.manage` → 204 soft-delete (audited); replace with `update-references` → ledger rows moved.

### Implementation for User Story 4

- [X] T025 [US4] Implement delete guard in `packages/storage/src/media-service.ts`: O(1) `media_usage` lookup where target document has published content; return 409 payload or soft-delete + queue provider destroy
- [X] T026 [US4] Implement replace in `packages/storage/src/media-service.ts` (`POST /api/v1/media/:id/replace`): confirm new providerKey, create new `media_assets` row, handle `update-references` vs `keep-both` ledger policy
- [X] T027 [US4] Wire ledger writes into document version creation: on `documents` version insert in `packages/auth/src/documents.ts` (or `packages/storage` via shared helper), scan `data` for media field references per content type's `media` fields and upsert `media_usage` rows in the same transaction
- [X] T028 [US4] Create delete/replace route handlers (`DELETE /api/v1/media/:id`, `POST /api/v1/media/:id/replace`) in `apps/api/src/routes/media.ts` with RBAC (`media.manage`) and audit
- [X] T029 [US4] Verify: referenced → delete without force → 409 with `references[]`; force → 204; replace `update-references` → ledger moved; `keep-both` → ledger untouched

**Checkpoint**: User Stories 1, 2, 3, AND 4 all work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T030 Update `docs/checklist.md` — mark Media Library phase complete
- [X] T031 Enforce module boundaries: verify no `cloudinary` import outside `packages/storage/src/cloudinary-provider.ts` (arch test / `nx enforce-module-boundaries` — SC-005)
- [ ] T032 Run `quickstart.md` validation (folder → sign → direct PUT → confirm → transform URLs → delete guard) and fix any gaps
- [X] T033 Handle edge cases: SVG blocked default, oversize in upload flow, `PROVIDER_KEY_NOT_FOUND` on confirm, folder `path` cascade on move

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion
  - User stories can proceed in parallel (if staffed) or sequentially in priority order (P1 → P2 → P3 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational — may share `media.ts` router with US1 (file-level sequencing if same file)
- **User Story 3 (P2)**: Depends on Foundational + US1 asset reads (transform is read-time over existing assets)
- **User Story 4 (P2)**: Depends on Foundational + `media_usage` ledger writes (best started after document `media` field linkage in `T027`)

### Within Each User Story

- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- `T002` (cloudinary dep) can run in parallel with verification tasks
- Foundational: `T003`/`T004` sequential; `T005`–`T007` sequential (migration); `T008`/`T009` can parallelize
- US1: `T011`/`T012` sequential in same file; `T013`/`T014` same file — sequential; `T015`/`T016` can parallelize
- US2: `T018` before `T019` (same files); `T020` within `T019`'s file
- US3: `T022` before `T023` (provider then route)
- US4: `T025` before `T028` (service before route); `T027` is cross-cutting (documents ↔ media)

---

## Parallel Example: User Story 1

```bash
# Inside US1, T011 → T012 must be sequential (same file: media-service.ts)
# T015 and T016 can run in parallel (different files: server.ts + openapi.ts)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test signed upload end-to-end (SC-001)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → foundation ready
2. Add User Story 1 → signed upload works → Deploy/Demo (MVP!)
3. Add User Story 2 → folders work → Deploy/Demo
4. Add User Story 3 → transform URLs work → Deploy/Demo
5. Add User Story 4 → safe delete/replace works → Deploy/Demo
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Constitution P-03 (Cloudinary SDK confinement) is NON-NEGOTIABLE — enforced by SC-005 arch test
- Ledger writes (`media_usage`) must be in the same transaction as version creation (research.md Decision 3)
- Folder-path logic is trigger-maintained (Decision 4) with service-level defense-in-depth

## Phase 8: Convergence

- [X] T034 Move the 413 Content-Length guard before body parsing (express.json limit is 1mb, so the media route guard never fires for large payloads) per FR-003 / SC-001 (partial)
- [X] T035 Add audit logging for media delete (force), replace, and folder delete operations per US4/AC2 (missing)
- [X] T036 Mark implemented tasks T001-T029, T031, T033 complete in tasks.md to reflect the shipped implementation (missing)
