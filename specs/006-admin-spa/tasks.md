# Tasks: Schema-Driven Admin SPA (Slice 6)

**Input**: Design documents from `/specs/006-admin-spa/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-api-client.md, quickstart.md
**Tests**: Requested in plan.md (vitest + React Testing Library + jsdom; contract tests for the typed API client against recorded fixtures; component tests for SchemaForm/SchemaTable). E2E deferred — quickstart.md is the manual validation gate.

**Organization**: Tasks grouped by user story. US4 (auth) is implemented first despite US1's MVP billing — every acceptance scenario in US1–US3 opens with "Given an authenticated editor", so auth is the enabling increment; MVP = US4 + US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths in every description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling and guardrails for `apps/admin` before any feature code

- [X] T001 Add test tooling to `apps/admin/package.json` (devDependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`; script `"test": "vitest run"`)
- [X] T002 [P] Create `apps/admin/vitest.config.ts` (jsdom environment, `@/` path alias to `src/`; mirror `packages/auth/vitest.config.ts` conventions)
- [X] T003 [P] Extend `eslint.config.mjs` with a P-04 import ban for `apps/admin/**` (forbid `@peggy/db`, `@peggy/auth`, `@peggy/storage`, `@peggy/http`, `express`, `serverless-http`, `drizzle-orm`; build fails on violation per constitution §I)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared client infrastructure every story builds on. No story work begins until this phase completes.

- [X] T004 Create admin view-model types in `apps/admin/src/lib/types.ts` (mirror data-model.md: `RegistryView` with `kind: 'collection' | 'single'`, `isLocalized`, `hasDraftPublish`, `activeSchemaVersion`, `fields: RegistryField[]`; `RegistryField` with `fieldType` union of the 16 `VALID_FIELD_TYPES`, `required`, `localized`, `validation`/`relationConfig`/`componentConfig`/`dynamiczoneConfig`/`mediaConfig` records; `DocumentRow`; `WorkingSet` with `translationState: 'present' | 'missing'`; `MediaSelection` + `UploadJob` states `idle → precheck → signing → uploading → confirming → done | failed`; `SessionPrincipal` with `permissions: string[]`; `ApiError` per contract)
- [X] T005 [P] Implement typed fetch wrapper in `apps/admin/src/lib/api-client.ts` (base URL from `NEXT_PUBLIC_API_URL` with fail-fast when unset; `credentials: 'include'` on every request; `ApiError` carrying `status`, `code?`, `message`, `requestId?`, `fieldErrors?`, `references?`, `limit?`/`received?`; all 20 endpoint calls from contracts/admin-api-client.md; 401 surfaces a typed signal for the auth redirect)
- [X] T006 [P] Contract tests for the API client in `apps/admin/tests/lib/api-client.test.ts` (`fetch` mocked at the client boundary; recorded fixtures for `{ data }` lists, single rows, 409 `MEDIA_REFERENCED{references[]}`, 422 `FILE_TOO_LARGE{limit,received}`, string validation errors; assert envelope parsing, not live calls)
- [X] T007 Create cached registry hook in `apps/admin/src/hooks/useRegistry.ts` (loads content-types/components/locales once per session; exposes `getType(id)` with fields and `refreshType(id)` for the mid-edit `activeSchemaVersion` re-check)
- [X] T008 [P] Create error/loading/empty component in `apps/admin/src/components/ErrorState.tsx` (renders `code`/`message` + `requestId` only when present; retry action prop; companion `LoadingState` and `EmptyState`; never a blank screen or unhandled spinner)
- [X] T009 Run live-API verification per quickstart.md step 1 against dev API and append results to `specs/006-admin-spa/research.md` (verify-live items: CSRF/`origin` header need on cookie mutations; non-admin readability of the `users/{id}/roles` chain for R-04; the `validation` key holding enumeration options for R-03; folder-CRUD permission per op)

**Checkpoint**: Foundation ready — api-client, types, registry cache, and error states in place; verify-live answers recorded. Story work can now begin.

---

## Phase 3: User Story 4 — Admin authenticates and respects RBAC (Priority: P1) 🔑 Enabling increment

**Goal**: Human session login/logout with permission-gated nav and route guards; logged-out users redirect to login with return-to.

**Independent Test**: quickstart.md step 4 — Author sees only Content + Media, direct URL to `/content-types` shows forbidden, logged-out access redirects to login with return-to, super-admin sees everything.

- [X] T010 [US4] Implement session context in `apps/admin/src/lib/auth.tsx` (`createAuthClient` from `better-auth/client` with `baseURL: NEXT_PUBLIC_API_URL`, `fetchOptions: { credentials: 'include' }`; `useSession` provider; `signIn.email`/`signOut`; `can(permission)` over `resource.action` strings with super-admin bypass; `myPermissions()` via `GET /api/v1/users/{id}/roles` → per-role `GET /api/v1/roles/{roleId}/permissions` union, cached per session, with R-04 progressive-disclosure fallback when the chain 403s; 401 handler stashing in-memory form draft and redirecting to `/login?returnTo=…`)
- [X] T011 [P] [US4] Build login page in `apps/admin/src/app/login/page.tsx` (`'use client'` + `<Suspense>` for the `returnTo` search param; email+password form; generic failure message on bad credentials with password field cleared, no user-enumeration detail)
- [X] T012 [US4] Build permission-gated nav and app shell in `apps/admin/src/components/Nav.tsx` and `apps/admin/src/app/layout.tsx` (AuthProvider wiring; Content/Media always for authenticated users; Content-Types gated on `content-type.read` (or visible-roles thereof); super-admin sees all; client-component shell, no server data fetching)
- [X] T013 [US4] Add route guard in `apps/admin/src/components/RouteGuard.tsx` (logged-out visit to any non-login route redirects to `/login?returnTo=<current>`; logged-in user lacking section permission gets a forbidden state, not a crash; wraps content/media/content-types pages)
- [X] T014 [P] [US4] Auth and nav tests in `apps/admin/tests/components/Nav.test.tsx` (Author permission set hides admin sections; super-admin shows all; guard redirects logged-out with return-to; failed login shows generic message)

**Checkpoint**: US4 independently functional — login/logout, gated nav, guards all verifiable per quickstart step 4.

---

## Phase 4: User Story 1 — Editor manages content documents (Priority: P1) 🎯 MVP core

**Goal**: Schema-driven document list/table, create/edit forms generated from registry schemas, locale switching with missing-translation state, per-locale publish/unpublish.

**Independent Test**: quickstart.md steps 2–3 — create Post via UI form, publish en, switch to fr empty state, publish fr, public API reflects both; required-field errors inline; payload preserved on failure.

- [X] T015 [US1] Build generic table in `apps/admin/src/components/SchemaTable.tsx` (columns derived from `fields[]`: `text`/`email`/`uid`/`number`/`date`/`datetime`/`enumeration` as text, `boolean` as yes/no, `media`/`relation`/`component`/`dynamiczone`/`richtext`/`markdown`/`json` as compact placeholders; unknown `fieldType` falls back to JSON-dump cell + `console.warn`; fixed `status`/`locale`/`updatedAt` columns; badge rule "`publishedVersionId != null` ⇒ published, draft-only ⇒ draft, no row ⇒ untranslated"; client-side pagination 25/page over the unpaginated `GET /documents` array per R-05; zero per-type branches per P-07)
- [X] T016 [US1] Build generic form + widgets in `apps/admin/src/components/SchemaForm.tsx` and `apps/admin/src/components/FieldWidget.tsx` (widget map for all 16 `VALID_FIELD_TYPES`: text/email/uid→text, richtext/markdown→textarea, number→numeric, boolean→checkbox, date/datetime/time→native pickers, enumeration→select from `validation` options, media→picker slot, relation→id/slug input, component/dynamiczone→recursive sub-form, json→textarea with JSON validation; `required` ⇒ marker + attribute; reserved names `id/documentId/__component/createdAt/updatedAt/publishedAt/locale/contentTypeId/componentId/activeSchemaVersion/createdBy` filtered from inputs; `localized` fields participate in per-locale editing; R-06 table-driven string-error mapper — `/Missing required field: (\w+)/` and `/field (\w+):/` patterns to field paths, 409 slug conflict to slug field, unmatched to form banner; payload always preserved)
- [X] T017 [P] [US1] Build locale switcher in `apps/admin/src/components/LocaleSwitcher.tsx` (locales from `GET /api/v1/locales` with default locale; switching loads that locale's version; missing row renders "untranslated" empty state with blank translatable fields — never en data presented as another locale per FR-005)
- [X] T018 [P] [US1] Build publish controls in `apps/admin/src/components/PublishControls.tsx` (confirmation step; locale-scoped `POST /:id/publish` / `POST /:id/unpublish`; hidden/disabled without `document.publish`; badge updates only after server round-trip; 403 ⇒ inline "not permitted" notice)
- [X] T019 [US1] Build content page in `apps/admin/src/app/content/page.tsx` (search params `contentType`/`doc`/`locale`; type list from registry; `SchemaTable` + `SchemaForm` composition; create mode when `doc` absent; on save re-fetch type and compare `activeSchemaVersion` against `schemaVersionAtOpen` — warn and revalidate on mismatch; 404 on `getDocument(id, locale)` enters translation-missing state, not an error page; WorkingSet draft stash survives 401 redirect per R-07)
- [X] T020 [P] [US1] Table tests in `apps/admin/tests/components/SchemaTable.test.tsx` (scalar/placeholder/unknown-type columns; badge rules; client pagination; no per-type component names — P-07)
- [X] T021 [P] [US1] Form tests in `apps/admin/tests/components/SchemaForm.test.tsx` (required markers; all widget types render from a fixture registry; R-06 mapper shapes incl. slug 409; payload preserved on failure)

**Checkpoint**: MVP (US4 + US1) fully functional and independently testable — an editor with no API knowledge completes the en content round-trip entirely in UI.

---

## Phase 5: User Story 2 — Editor browses and inserts media (Priority: P1)

**Goal**: Media library (folders, grid, search, signed upload, CRUD, delete guard) plus document-field picker. Independently testable via the library view; picker wiring into US1 forms is the only cross-story touchpoint (T025, depends on T016 + T023).

**Independent Test**: quickstart.md step 5 — folder ops, upload with progress, search, coded-error messages, picker select into Post cover, 409 dialog with references + force gated on `media.manage`.

- [X] T022 [US2] Build upload dropzone in `apps/admin/src/components/UploadDropzone.tsx` (XHR state machine `idle → precheck → signing → uploading{progress%} → confirming → done | failed{reason}`; client pre-check rejecting SVG and over-limit MIME/size before sign; `POST /media/sign { filename, mime, sizeBytes, folderId }` → multipart PUT of bytes to `url` with `params` fields → `POST /media` confirm; FR-009 human messages for `FILE_TOO_LARGE` naming `limit`/`received`, `MIME_NOT_ALLOWED`, 413→signed-flow pointer, `FOLDER_DEPTH_EXCEEDED`/`FOLDER_CYCLE`)
- [X] T023 [P] [US2] Build media picker modal in `apps/admin/src/components/MediaPicker.tsx` (folder browse + asset grid with server pagination `pageSize≤100` + `q` search; broken-thumbnail state for provider-missing assets showing name, not a crash; select returns asset reference + thumbnail)
- [X] T024 [US2] Build media library page in `apps/admin/src/app/media/page.tsx` (search param `folder`; folder tree/breadcrumb with create/rename/move/delete + recursive-delete confirmation; grid with server `page`/`pageSize` and search; asset update (folder move/alt/caption, `media.manage`); delete → 409 `MEDIA_REFERENCED` dialog listing `references[]` with force path gated on `media.manage`; large-folder pagination per API clamp)
- [X] T025 [US2] Wire picker into form media widgets in `apps/admin/src/components/FieldWidget.tsx` (media-type field opens `MediaPicker`; selection populates field with asset reference + thumbnail preview; depends on T016 widget slot and T023 picker)
- [X] T026 [P] [US2] Upload tests in `apps/admin/tests/components/UploadDropzone.test.tsx` (state-machine transitions incl. progress; coded-error → human-message mapping with `limit`/`received`; SVG pre-check rejection)

**Checkpoint**: US1 + US2 both work — editor uploads, picks, and attaches cover images end-to-end; delete guards enforced in UI with server as backstop.

---

## Phase 6: User Story 3 — Architect reviews content models (Priority: P2)

**Goal**: Read-only registry views rendering kind, fields, relations, toggles, and schema version purely from the API — no admin code change on schema edits.

**Independent Test**: quickstart.md step 6 element — register types/components via API, see them with correct kinds/fields/versions; add a field via API, re-open, new field appears with no admin redeploy (SC-004).

- [X] T027 [US3] Build content-type read views in `apps/admin/src/app/content-types/page.tsx` (search param `type`; list of collections/singles/components; per-type field table with name/type/required/localized/unique flags; relations with on-delete policies; draft-publish and i18n toggles; schema version; all rendered from `GET /api/v1/content-types[/:id]` + `GET /api/v1/components` at visit time — refetch on every visit so registry edits appear with no rebuild; gated on section permission per US4 guard)

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ship-readiness for the static-export admin

- [X] T028 [P] Verify static export in `apps/admin` (`pnpm build` → `out/`; serve statically and confirm deep links `/content/?contentType=…`, `/media/`, `/content-types/` resolve; every view shows loading/error states with no server; Amplify SPA-rewrite note recorded if config needed)
- [X] T029 [P] Run full gates for `apps/admin` (`pnpm typecheck`, `pnpm lint` incl. T003 P-04 ban, `pnpm test`; P-07 grep confirming no `Post*`-/`<TypeName>Form`-style components)
- [ ] T030 Run full quickstart.md validation (steps 1–7) against a live API and record pass/fail per SC-001…SC-006 in the task/ PR notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T002 and T003 are parallel ([P], different files).
- **Foundational (Phase 2)**: Depends on Setup. T005/T006/T008 are parallel (different files: `lib/api-client.ts`, `tests/lib/api-client.test.ts`, `components/ErrorState.tsx`); T004 (types) should land before T005/T006 in practice but they touch different files; T009 (live verification) needs only a running API, not code completion — run it early and unblock R-03/R-04 details.
- **User Stories (Phase 3–6)**: All depend on Foundational. Order: US4 → US1 → US2 → US3 (priority + dependency order; T025 is the single cross-story implementation dependency: US1 widget slot × US2 picker).
- **Polish (Phase 7)**: Depends on all desired stories; T028/T029 parallel, T030 last.

### User Story Dependencies

- **US4 (P1, Phase 3)**: After Foundational. No story dependencies. Enables all other stories.
- **US1 (P1, Phase 4)**: After US4 (needs session/guard). No dependency on US2/US3 — the media widget slot renders a disabled placeholder until T025 lands.
- **US2 (P1, Phase 5)**: After US4. Library + picker independently testable without US1; T025 integrates into US1 forms.
- **US3 (P2, Phase 6)**: After US4. Fully independent read views.

### Within Each Story

- Contract/component tests written alongside implementation (T006, T014, T020/T021, T026); tests assert the R-05/R-06 client adaptations so API-shape regressions fail loudly.
- Resolved unknowns flow in: T009's verify-live answers (CSRF header, roles-chain readability, enum validation key) feed T010/T012/T016 — if T009 contradicts R-01/R-03/R-04, amend research.md before building on it.

### Parallel Opportunities

- Phase 1: T002 + T003 in parallel.
- Phase 2: T005 + T006 + T008 in parallel; T004 + T007 in parallel (different files).
- US4: T011 + T014 in parallel (page vs test file).
- US1: T017 + T018 in parallel, then T020 + T021 in parallel (four test/implementation files, no shared edits except T019 which follows T015–T018).
- US2: T023 + T026 in parallel with T022/T024 (different files); T025 last (touches `FieldWidget.tsx` from T016).
- Polish: T028 + T029 in parallel; T030 final.

---

## Parallel Example: User Story 1

```bash
# After T015 (SchemaTable) + T016 (SchemaForm/FieldWidget) land:
Task: "Build locale switcher in apps/admin/src/components/LocaleSwitcher.tsx"
Task: "Build publish controls in apps/admin/src/components/PublishControls.tsx"
Task: "Table tests in apps/admin/tests/components/SchemaTable.test.tsx"
Task: "Form tests in apps/admin/tests/components/SchemaForm.test.tsx"
# Then: T019 content page composes all four (depends on T015-T018).
```

---

## Implementation Strategy

### MVP First (US4 + US1)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T009; run T009 early against dev API)
3. Complete Phase 3: US4 auth (T010–T014) → validate per quickstart step 4
4. Complete Phase 4: US1 content (T015–T021) → validate per quickstart steps 2–3
5. **STOP and VALIDATE**: editor round-trip (create → publish en → translate fr → publish fr) entirely in UI; public API reflects both locales. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → client infrastructure ready
2. + US4 → protected shell (login, gated nav)
3. + US1 → MVP: full editorial loop (deployable)
4. + US2 → media completes the editor MVP (covers J-04 upload→folder→attach journey)
5. + US3 → architect visibility, zero new writes
6. Polish → static-export verification + full quickstart green

### Parallel Team Strategy

With multiple developers after Foundational + US4:

- Developer A: US1 content (T015–T021)
- Developer B: US2 media library + picker (T022–T024, T026)
- Converge on T025 (picker ↔ widget wiring), then US3 (T027) and Polish together.

---

## Notes

- [P] tasks = different files, no dependencies; [Story] label (US1–US4) maps each story-phase task for traceability.
- No `apps/api` or `packages/*` changes are tasked: R-04/R-05/R-06 keep this slice client-only. If implementation hits an API gap, stop and amend the spec — do not silently extend the API.
- Commit after each task or logical group; stop at any checkpoint to validate the story independently per its quickstart step.

---

## Phase 8: Convergence

Converge run 2026-11-06 (post-implement assessment vs spec/plan/tasks/constitution). No constitution violations; no missing or contradicting work. Five partial gaps, ordered by severity.

- [X] T031 [US2] Add folder-move (reparent) control in `apps/admin/src/app/media/page.tsx` wiring the existing `updateFolder(id, { parentId })` client call, with `FOLDER_DEPTH_EXCEEDED`/`FOLDER_CYCLE` surfaced per FR-009 (partial)
- [X] T032 [US1] Add entry-reorder (move up/down) controls to `DynamicZoneWidget` in `apps/admin/src/components/FieldWidget.tsx` per the FR-004 "dynamic zone ordering" requirement (partial)
- [X] T033 [US1] [US2] Handle 401-during-mutation in `apps/admin/src/app/media/page.tsx` and `apps/admin/src/components/PublishControls.tsx` with the R-07 pattern (stash in-memory state, redirect to `/login?returnTo=…`) already used by content `onSave` per the session-expiry edge case (partial)
- [X] T034 Add retry actions and envelope detail (`code`/`message`/`requestId` via `ErrorState`) to the registry-load error in `apps/admin/src/app/content/page.tsx`, the type-detail error in `apps/admin/src/app/content-types/page.tsx`, and folder-operation errors in `apps/admin/src/app/media/page.tsx` per FR-012 (partial)
- [X] T035 [US1] Skip `SchemaTable` for `kind === 'single'` types in `apps/admin/src/app/content/page.tsx` (singleton editor only) per data-model.md §1 (partial)
