# Tasks: Platform Foundation (Slice 0)

**Input**: Design documents from `/specs/001-platform-foundation/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in spec. Verification tasks included as manual smoke tests.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/*` + `apps/*` at repository root
- **Web app**: `apps/admin/` (Next.js static export)
- **API**: `apps/api/` (Express + serverless-http)

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and basic structure

- [x] T001 Create monorepo directory layout (apps/*, packages/*, ci/, .github/workflows/) at repository root
- [x] T002 Initialize root package.json with workspaces, nx.json, tsconfig.base.json, eslint, prettier
- [x] T003 [P] Create package manifests for all packages (shared, config, domain, db, auth, storage, http)
- [x] T004 [P] Create tsconfig.json for each package extending tsconfig.base.json
- [x] T005 Create .env.example with canonical env vars (deployment guide §4)
- [x] T006 Create docker-compose.dev.yml (postgres:16)
- [x] T007 [P] Create CI sample workflows (ci/ci.yml, ci/deploy.yml, ci/amplify.yml)
- [x] T008 Create README.md with quick-start instructions

**Checkpoint**: Monorepo skeleton ready

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Core infrastructure that MUST be complete before ANY user story

- [x] T009 Implement @peggy/shared: typed errors (PeggyError, NotFoundError, ForbiddenError, etc.) in packages/shared/src/errors.ts
- [x] T010 Implement @peggy/shared: structured JSON logger with secret masking in packages/shared/src/logger.ts
- [x] T011 Implement @peggy/config: Zod env schema in packages/config/src/env.ts
- [x] T012 Implement @peggy/config: peggy doctor CLI in packages/config/src/doctor.ts
- [x] T013 Implement @peggy/http: createApp factory (CORS, auth mount, health/ready, error handler) in packages/http/src/app.ts
- [x] T014 Create apps/api/src/lambda.ts (serverless-http handler)
- [x] T015 Create apps/api/src/server.ts (local dev server)
- [x] T016 Promote CI samples to .github/workflows/ (ci.yml, deploy.yml)
- [x] T017 Create .specify/memory/constitution.md (v1.0.0)

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Developer boots platform locally (Priority: P1) 🎯 MVP

**Goal**: Developer clones repo, runs docker compose + npm install + npm run dev, and has a running API with health checks responding.

**Independent Test**: Clone fresh, follow README quick-start, verify /health returns 200 and /ready returns 200 with DB connectivity.

### Implementation for User Story 1

- [x] T018 [US1] Implement @peggy/db: DbClient interface in packages/db/src/client.ts
- [x] T019 [P] [US1] Implement PgPoolAdapter in packages/db/src/pg-pool.ts
- [x] T020 [P] [US1] Implement NeonHttpAdapter in packages/db/src/neon-http.ts
- [x] T021 [US1] Implement createDbClient factory in packages/db/src/factory.ts
- [x] T022 [US1] Wire DbClient into apps/api/src/server.ts (readyCheck via healthCheck)
- [x] T023 [US1] Create apps/admin Next.js static export skeleton (layout.tsx, page.tsx, next.config.ts)
- [x] T024 [US1] Verify: `npm run doctor` passes against .env.example-shaped env
- [x] T025 [US1] Verify: `tsc -b` builds all packages with zero errors
- [x] T026 [US1] Verify: dev server starts and /health returns 200 { status: "ok" }
- [x] T027 [US1] Verify: /ready returns 200 with DB connectivity check

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Operator deploys to Lambda (Priority: P2)

**Goal**: Operator deploys the API artifact to AWS Lambda via Serverless Framework and the handler responds to API Gateway events.

**Independent Test**: Deploy minimal handler to Lambda, invoke via API Gateway, verify /health returns 200.

### Implementation for User Story 2

- [x] T028 [US2] Wire DbClient into apps/api/src/lambda.ts (readyCheck via healthCheck)
- [x] T029 [US2] Verify C-03: toNodeHandler works under serverless-http (synthetic event test with AWS_LAMBDA_FUNCTION_NAME set)
- [ ] T030 [US2] Verify: serverless deploy succeeds (requires AWS credentials — manual)
- [ ] T031 [US2] Verify: /health returns 200 via API Gateway custom domain

**Checkpoint**: User Story 2 should be deployable to Lambda

---

## Phase 5: User Story 3 - CI validates platform (Priority: P3)

**Goal**: CI runs lint, typecheck, build, and smoke tests on every PR.

**Independent Test**: Open a PR; all CI jobs pass.

### Implementation for User Story 3

- [x] T032 [US3] Promote CI samples to .github/workflows/ (ci.yml, deploy.yml)
- [x] T033 [US3] Configure ci.yml jobs: setup, lint-typecheck-boundaries, unit, integration, contract, audit
- [x] T034 [US3] Configure deploy.yml jobs: migrate, deploy-api, deploy-admin
- [ ] T035 [US3] Verify: CI pipeline runs green on a clean PR (requires GitHub repo — manual)
- [ ] T036 [US3] Configure GitHub Environments (preview/production) with OIDC (infra — manual)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T037 [P] Update README.md with complete quick-start (already drafted, verify accuracy)
- [x] T038 [P] Add .gitignore entries for node_modules, dist, .env*, .nx, .serverless
- [x] T039 Remove Sync Impact Report HTML comment from constitution before commit
- [x] T040 Run quickstart.md validation end-to-end
- [ ] T041 [P] Add unit test stubs for @peggy/db (healthCheck, factory) — optional
- [x] T042 Verify no domain logic, auth, content tables, or media code in Slice 0

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — ✅ Complete
- **Foundational (Phase 2)**: Depends on Setup — ✅ Complete
- **User Stories (Phases 3-5)**: All depend on Foundational — Phase 3 ✅, Phase 4/5 partial
- **Polish (Phase 6)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — ✅ Implemented, verification remaining
- **US2 (P2)**: Can start after Foundational — ✅ Implemented, deploy verification remaining (manual)
- **US3 (P3)**: Can start after Foundational — ✅ Wired, GitHub config remaining (manual)

### Within Each User Story

- Implementation before verification
- Verification tasks are independent of each other (can run in parallel)

### Parallel Opportunities

- T019 and T020 (PgPoolAdapter + NeonHttpAdapter) were parallel
- T024-T027 (verification tasks) can run in parallel
- T030, T031 (deploy verification) can run in parallel
- T035, T036 (CI verification) can run in parallel
- All Phase 6 polish tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1)

1. ✅ Complete Phase 1: Setup
2. ✅ Complete Phase 2: Foundational
3. ✅ Complete Phase 3: User Story 1 (implementation)
4. Remaining: verification tasks T024-T027
5. **STOP and VALIDATE**: Test User Story 1 independently

### Incremental Delivery

1. ✅ Setup + Foundational → Foundation ready
2. ✅ User Story 1 → Implemented (verification remaining)
3. ✅ User Story 2 → Implemented (deploy verification remaining)
4. ✅ User Story 3 → Wired (GitHub config remaining)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Most Slice 0 work was completed in Phases A-D; this task list captures remaining verification and manual steps
- Tasks marked [x] are done; tasks marked [ ] require execution or manual steps
- Manual tasks (T030, T031, T035, T036) require AWS/GitHub infrastructure access
