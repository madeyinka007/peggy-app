# Tasks: Authentication & RBAC (Slice 1)

**Input**: Design documents from `/specs/002-auth-rbac/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Verification tasks included as smoke tests.

**Organization**: Tasks grouped by user story (P1: admin auth, P2: RBAC, P3: API tokens).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/*` + `apps/*` at repository root
- **Auth**: `packages/auth/src/`
- **DB schema**: `packages/db/src/`
- **HTTP**: `packages/http/src/`
- **API**: `apps/api/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify Slice 0 foundation is in place and add Slice 1 dependencies

- [X] T001 Verify Slice 0 complete: `tsc -b` passes for all packages, /health + /ready return 200
- [X] T002 [P] ~~Add `better-auth` and `@better-auth/drizzle-adapter` to packages/db/package.json dependencies~~ — SUPERSEDED by T072: adapter lives in @peggy/auth (P-02 forbids db→auth dep direction)
- [X] T003 [P] Add `better-auth` to packages/auth/package.json dependencies
- [X] T004 [P] Add `@peggy/db` and `@peggy/auth` to apps/api/package.json dependencies
- [X] T005 [P] Add `@peggy/auth` to packages/http/package.json dependencies
- [X] T006 Create packages/auth/package.json with scripts (build, typecheck, lint, test)
- [X] T007 Create packages/auth/tsconfig.json (extends base, references shared + db)

**Checkpoint**: Slice 1 dependencies and package scaffolding ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and auth wiring that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Generate Better Auth schema via CLI: run `npx @better-auth/cli generate --adapter drizzle` against auth config, commit output as packages/db/src/schema-auth.ts
- [X] T009 Modify generated schema for UUID interop: user.id → uuid (default gen_random_uuid()), session.userId/account.userId → uuid FK, session.id/account.id/verification.id → text (default gen_random_uuid()::text) in packages/db/src/schema-auth.ts
- [X] T010 Create RBAC schema: roles, permissions, role_permissions, user_roles tables in packages/db/src/schema-rbac.ts
- [X] T011 Create API token schema: api_tokens table in packages/db/src/schema-tokens.ts
- [X] T012 Create schema barrel export: packages/db/src/schema.ts re-exporting schema-auth, schema-rbac, schema-tokens
- [X] T013 Create Drizzle migration for all Slice 1 tables: `npx drizzle-kit generate` → packages/db/drizzle/
- [X] T014 Implement @peggy/auth: AuthPort interface in packages/auth/src/port.ts
- [X] T015 Implement @peggy/auth: Better Auth instance (from spike) in packages/auth/src/auth.ts — emailAndPassword enabled, UUID interop, cookieCache JWE, trustedOrigins from env
- [X] T016 Implement @peggy/auth: auth middleware (sessionCookieAuth + bearerTokenAuth) in packages/auth/src/middleware.ts
- [X] T017 Update @peggy/http: createApp to accept optional auth instance and wire toNodeHandler at /api/auth/* before express.json() in packages/http/src/app.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin user signs up and logs in (Priority: P1) 🎯 MVP

**Goal**: User can sign up, sign in, sign out, and read session via Better Auth endpoints with secure cookie.

**Independent Test**: Sign up → sign in → get-session → sign-out, all via /api/auth/* endpoints.

### Implementation for User Story 1

- [X] T018 [US1] Wire auth instance into apps/api/src/server.ts: createAuth(config) → createApp({ auth, readyCheck })
- [X] T019 [US1] Wire auth instance into apps/api/src/lambda.ts: same wiring
- [X] T020 [US1] Verify sign-up: POST /api/auth/sign-up/email → 200 with user + session cookie (HttpOnly, SameSite=Lax)
- [X] T021 [US1] Verify sign-in: POST /api/auth/sign-in/email → 200 with user + session cookie
- [X] T022 [US1] Verify get-session: GET /api/auth/get-session with cookie → 200 with session + user (including displayName, isActive, isSuperAdmin)
- [X] T023 [US1] Verify sign-out: POST /api/auth/sign-out with cookie → 200, session revoked (revokedAt set), cookie cleared
- [X] T024 [US1] Verify cookie flags: in production, cookie has Domain=.parent, Secure, SameSite=Lax, HttpOnly

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - RBAC permission evaluation (Priority: P2)

**Goal**: Admin creates roles, assigns permissions (resource.action), assigns roles to users, and permission evaluator checks access including owner-only condition.

**Independent Test**: Create role with content-type.read → assign to user → evaluator returns allow for content-type.read, deny for content-type.delete.

### Implementation for User Story 2

- [X] T025 [US2] Implement RBAC service: createRole, getRole, listRoles, updateRole, deleteRole in packages/auth/src/rbac.ts
- [X] T026 [US2] Implement permission service: createPermission, listPermissions in packages/auth/src/rbac.ts
- [X] T027 [US2] Implement role-permission assignment: assignPermissionToRole, removePermissionFromRole in packages/auth/src/rbac.ts
- [X] T028 [US2] Implement user-role assignment: assignRoleToUser, removeRoleFromUser in packages/auth/src/rbac.ts
- [X] T029 [US2] Implement permission evaluator: hasPermission(userId, resource, action, ownerId?) → boolean in packages/auth/src/rbac.ts
- [X] T030 [US2] Create RBAC route handlers (CRUD roles, permissions, assignments) in apps/api/src/routes/rbac.ts
- [X] T031 [US2] Wire RBAC routes into createApp or apps/api composition root
- [X] T032 [US2] Verify: create role → 201 with role data
- [X] T033 [US2] Verify: assign permission to role → 201
- [X] T034 [US2] Verify: assign role to user → 201
- [X] T035 [US2] Verify: permission evaluator returns allow for granted permission
- [X] T036 [US2] Verify: permission evaluator returns deny for ungranted permission
- [X] T037 [US2] Verify: owner-only condition — deny for non-owner, allow for owner

**Checkpoint**: User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - API token for programmatic access (Priority: P3)

**Goal**: Developer creates API token (prefixed, shown once), uses as Bearer token, can revoke.

**Independent Test**: Create token → use as Bearer → access granted → revoke → access denied.

### Implementation for User Story 3

- [X] T038 [US3] Implement API token service: createToken (generate prefix + random, hash, store, return plaintext once), listTokens, revokeToken in packages/auth/src/tokens.ts
- [X] T039 [US3] Implement bearerTokenAuth middleware: hash Bearer token → lookup api_tokens → validate user active → attach user + scopes in packages/auth/src/middleware.ts
- [X] T040 [US3] Create token route handlers (POST/GET/DELETE /api/v1/tokens) in apps/api/src/routes/tokens.ts
- [X] T041 [US3] Wire token routes into apps/api composition root
- [X] T042 [US3] Verify: create token → 201 with token (shown once) + prefix + scopes
- [X] T043 [US3] Verify: use token as Bearer → authenticated request succeeds
- [X] T044 [US3] Verify: revoked token → 401 Unauthorized
- [X] T045 [US3] Verify: token stored hashed (not plaintext) in DB
- [X] T046 [US3] Verify: deactivated user's token → rejected

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T047 [P] Apply rate limiting to auth routes (5/min/IP per lambda preset) in packages/http/src/app.ts or middleware
- [X] T048 [P] Add CORS configuration for Amplify origins in createApp
- [X] T049 [P] Add draft-leak fixture test: public token × draft-only content → 0 rows
- [X] T050 Update @peggy/http createApp to wire auth instance from composition root
- [X] T051 Verify Better Auth tables generated by CLI and committed verbatim in packages/db/src/schema-auth.ts
- [X] T052 Verify no organization plugin installed
- [X] T053 Run quickstart.md validation end-to-end
- [X] T054 [P] Add unit tests for permission evaluator (≥80% branch coverage)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Foundational — can run in parallel with US1/US2
- **Polish (Phase 6)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories
- **US2 (P2)**: No dependencies on US1 (RBAC is independent of auth sessions, though uses same DB)
- **US3 (P3)**: No dependencies on US1/US2 (tokens are independent of RBAC roles)

### Within Each User Story

- Schema/migrations before services
- Services before routes
- Routes before verification
- Verification tasks can run in parallel

### Parallel Opportunities

- T002-T005 (dependency updates) can run in parallel
- T010-T011 (RBAC + token schemas) can run in parallel
- T025-T029 (RBAC services) can run in parallel (different functions, same file — sequential within file)
- T038-T039 (token service + middleware) can run in parallel (different files)
- All verification tasks within a story can run in parallel
- T047-T048, T054 (polish) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (auth sign-up/sign-in/session)
4. **STOP and VALIDATE**: Test auth independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Auth works (MVP!)
3. User Story 2 → RBAC works
4. User Story 3 → API tokens work
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (auth wiring + verification)
   - Developer B: User Story 2 (RBAC services + routes)
   - Developer C: User Story 3 (token lifecycle + middleware)
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
- Better Auth schema MUST be generated by CLI, not hand-written (spike §3)
- UUID interop: generateId: false, user.id = uuid, others = text (spike §3)

## Phase 7: Convergence

- [X] T055 Implement rate limiting on auth routes (5 req/min/IP, lambda preset) per FR-012 (missing)
- [X] T056 Configure Better Auth session cookie attributes (Domain=.parent, Secure, SameSite=Lax, HttpOnly) per FR-002 (partial)
- [X] T057 Add unique constraint on permissions(resource, action) and composite PKs on role_permissions and user_roles per FR-006 (partial)
- [X] T058 Fix getUserPermissions to scope permissions to the user's roles per FR-007 (partial)
- [X] T059 Apply session/token auth middleware and requirePermission checks to RBAC and token routes per contracts/rbac-endpoints.md (missing)
- [X] T060 Make token revocation owner-scoped (filter by userId in update) per FR-010 (partial)
- [X] T061 Ensure sign-out sets revokedAt on the session row per US1/AC4 (partial)
- [X] T062 Implement and use AuthPort in middleware instead of direct Better Auth calls per Constitution IV (partial)
- [X] T063 Evaluate owner-only condition by comparing resource.createdBy to requesting user per FR-007 (partial)
- [x] T064 Add unit tests for permission evaluator (>=80% branch coverage) per Constitution VII (missing)
- [x] T065 Add draft-leak fixture test (public token x draft-only content -> 0 rows) per FR-014 (missing)
- [X] T066 Derive authenticated user from auth context in token routes instead of req.body.userId per contracts/rbac-endpoints.md (partial)
- [X] T067 Add permission-evaluation caching to meet <10ms target per SC-002 (partial)
- [X] T068 Restrict API token prefixes to pk_/sk_ per FR-008 (partial)

## Phase 8: Convergence

- [X] T069 Fix TS18048 errors in packages/auth/src/rbac.integration.test.ts (possibly-undefined role/perm under noUncheckedIndexedAccess) per Constitution VII (partial)
- [X] T070 Move rate-limit counters from in-memory Map to Postgres/KV per Constitution VI (contradicts)
- [X] T071 Mark pre-existing T001-T054 checkboxes complete where implemented ([X]) so tasks.md reflects shipped state per tasks.md (partial)

## Phase 9: Convergence

- [X] T072 Resolve T002 without violating P-02: either move the drizzleAdapter import out of @peggy/db's dependency closure or amend T002 as superseded per Constitution II (contradicts)
