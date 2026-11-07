# Tasks: Content-Type Builder (Slice 7)

**Input**: Design documents from `/specs/007-content-type-builder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/builder-registry-endpoints.md, quickstart.md
**Tests**: vitest + RTL + jsdom in `apps/admin` (existing T001–T002 tooling); component tests with `api-client` mocked at the module boundary; DB-backed service tests already green (20/20, no new service tests needed). E2E deferred — quickstart.md is the manual validation gate.

**Organization**: US1+US4-type work first (type lifecycle enables everything, gating gates everything), then fields, then components, then polish. No `apps/api` / `packages/*` changes are tasked — if implementation hits an API gap, stop and amend the spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths in every description

## Phase 1: Setup (View-model + shared builder pieces)

**Purpose**: Types and shared UI the stories build on

- [ ] T101 Extend view-model types in `apps/admin/src/lib/types.ts` (`TypeDraft` with `kind` creation-only, `ComponentDraft`, `FieldDraft` with JSON-text config fields + `sortOrder`, `BuilderAction` union per data-model.md; `kind: 'collection' | 'single'` reused from `RegistryView`)
- [ ] T102 [P] Create delete-confirm in `apps/admin/src/components/ConfirmDelete.tsx` (props: target kind `type|component|field`, name, irreversibility copy for types/components, deprecation copy for fields per FR-105, irreversible-delete warning for types per R-07-03; confirm/cancel; renders server refusal message when provided)
- [ ] T103 [P] Extract field table in `apps/admin/src/components/FieldTable.tsx` from `apps/admin/src/app/content-types/page.tsx` (move `FieldTable` + `flag`/`relationDetail`/`configDetail`/`enumDetail`/`fieldDetail` helpers verbatim; add per-row actions slot props: `onEdit`, `onDelete`, `onMoveUp`, `onMoveDown` — all optional so the read view renders action-free until wired)

**Checkpoint**: Types + confirm + table shell ready; no behavior change to the read views yet.

---

## Phase 2: User Story 1 — Architect creates and edits content types (Priority: P1)

**Goal**: Type create/edit/delete UI with version display and refusal handling.

**Independent Test**: quickstart.md step 2 — create/edit/duplicate-slug/delete `Product` entirely in the UI.

- [ ] T104 [US1] Build type form in `apps/admin/src/components/TypeForm.tsx` (create mode: name + kind select (collection/single) + slug + displayName/description + toggles; edit mode: same minus kind per FR-108; calls `createContentType` / `updateContentType`; 400 messages inline per field where matchable else banner; payload preserved; success returns to detail with re-read version shown)
- [ ] T105 [US1] Wire type actions into `apps/admin/src/app/content-types/page.tsx` (search-param action state `?type=<id>&action=new-type|edit-type` + `new-component` placeholder hidden until US3; "New content type" button gated on `can('content-type.create')`; edit/delete buttons gated on `update`/`delete`; delete flows through `ConfirmDelete` with irreversibility copy; after every mutation re-fetch detail and render `activeSchemaVersion`; delete-with-documents refusal renders the server message with the type left listed per R-07-03; 401 ⇒ draft-stash + login redirect via existing R-07 pattern)
- [ ] T106 [P] [US1] Type form tests in `apps/admin/tests/components/TypeForm.test.tsx` (create vs edit mode fields; kind absent in edit; 400 inline + payload preserved; success callback with version display)

**Checkpoint**: US1 independently functional — full type lifecycle in the UI per quickstart step 2.

---

## Phase 3: User Story 4 — Builder respects RBAC end to end (Priority: P1)

**Goal**: Permission matrix verified as its own story before field/component actions multiply the surface.

**Independent Test**: quickstart.md step 5 — Author read-only, partial-permission scoping, 401 draft-stash.

- [ ] T107 [US4] Implement builder gating matrix in `apps/admin/src/app/content-types/page.tsx` + forms (every mutation button checks `can()` for its `content-type.*`/`component.*` string; missing permission hides the action; attempted-mutation 403 ⇒ inline "not permitted" notice via `ErrorState`; logged-out builder URL ⇒ existing `RouteGuard` redirect; 401 mid-mutation ⇒ stash `TypeDraft`/`FieldDraft` in memory, redirect `returnTo`, restore post-login)
- [ ] T108 [P] [US4] Gating tests in `apps/admin/tests/components/BuilderActions.test.tsx` (Author permission set: zero mutation buttons rendered; `update`-only set: edit present, delete absent; 403 from mocked client ⇒ inline notice; 401 ⇒ redirect-with-stash called)

**Checkpoint**: US4 independently verifiable — gating matrix green per quickstart step 5 (field/component actions added in later phases inherit the pattern).

---

## Phase 4: User Story 2 — Architect manages fields on a content type (Priority: P1)

**Goal**: Field add/edit/remove/reorder with version receipts and deprecation honesty.

**Independent Test**: quickstart.md step 3 — subtitle/status lifecycle entirely in the UI.

- [ ] T109 [US2] Build field form in `apps/admin/src/components/FieldForm.tsx` (owner-agnostic props: `{ kind: 'content-type' | 'component', id }`; name + label + 16-type select + required/localized/searchable + uniqueScope + defaultValue JSON textarea + sortOrder display (managed by reorder, FR-106) + `validation`/`relationConfig`/`componentConfig`/`dynamiczoneConfig`/`mediaConfig` JSON textareas with JSON validation; enumeration preset hint for `validation.options` per T009; create calls `createContentTypeField`/`createComponentField`; 422 reserved-name/invalid-type inline on name/type inputs; R-07-02 constraints: reserved-name blocklist client-side on rename, `fieldType` change requires explicit confirm warning about existing data; payload preserved; success re-reads owner, displays bumped version)
- [ ] T110 [US2] Wire field actions into the type detail in `apps/admin/src/app/content-types/page.tsx` (add/edit/remove buttons on `FieldTable` rows gated on `can('content-type.update')`; remove flows through `ConfirmDelete` with deprecation copy; move up/down swaps `sortOrder` via `updateField` and re-reads; every mutation displays the new `activeSchemaVersion`; mid-edit version change ⇒ warn-and-revalidate per Slice 6 pattern)
- [ ] T111 [P] [US2] Field form tests in `apps/admin/tests/components/FieldForm.test.tsx` (all config textareas render; invalid JSON blocked client-side; 422 reserved-name inline; fieldType-change confirm path; rename-blocklist path; success shows version receipt)

**Checkpoint**: US1 + US2 + US4 deliver the core builder — types and their fields fully manageable with gating.

---

## Phase 5: User Story 3 — Architect manages components and their fields (Priority: P2)

**Goal**: Component lifecycle mirroring types, with reference-block deletes.

**Independent Test**: quickstart.md step 4 — SEO component lifecycle entirely in the UI.

- [ ] T112 [US3] Build component form in `apps/admin/src/components/ComponentForm.tsx` (name creation-only + displayName/category; calls `createComponent`/`updateComponent`; duplicate-name 400 inline; payload preserved)
- [ ] T113 [US3] Wire component actions into `apps/admin/src/app/content-types/page.tsx` (new/edit/delete component buttons gated on `can('component.create'/'update'/'delete')`; component detail reuses `FieldForm` with `{ kind: 'component', id }` calling `createComponentField`/`updateComponentField`/`deleteComponentField`; reorder via `sortOrder` same as T110; component delete refusal (`409 "referenced"`) renders with the reference named via `ConfirmDelete` refusal slot; version receipts from component-scoped bumps)
- [ ] T114 [P] [US3] Component tests in `apps/admin/tests/components/BuilderActions.test.tsx` (append: component create/edit/delete flows; referenced-delete refusal copy; component field CRUD calls the component-scoped client fns with correct URLs)

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ship-readiness for the builder inside the static export

- [ ] T115 [P] Run P-07 grep gate for builder files (`apps/admin/src/components/TypeForm.tsx`, `ComponentForm.tsx`, `FieldForm.tsx`, `ConfirmDelete.tsx`, `FieldTable.tsx`, `app/content-types/page.tsx` — no `Post*`- / `<TypeName>*`-style identifiers; field-type universe addressed only through the shared 16-type map)
- [ ] T116 [P] Verify static export in `apps/admin` (`pnpm build` → `out/`; serve statically; builder deep links `/content-types/?type=…&action=…` resolve; every builder view shows loading/error/empty states with no server)
- [ ] T117 Run full quickstart.md validation (steps 1–6) against a live API and record pass/fail per SC-101…SC-104 plus the step-1 live answers (esp. the type-delete-with-documents refusal shape → adapt the FR-105 mapper if the real shape differs from the assumed message) in research.md `## Verify-Live Results`
- [ ] T118 [P] Run full gates for builder files (`tsc --noEmit`, `vitest run`, eslint P-04 ban on new files once the env issue is resolved)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — T102 and T103 parallel (different files); T101 first (types feed both).
- **Phase 2 (US1 types)**: After Setup. T106 parallel with T105 (test vs page file).
- **Phase 3 (US4 gating)**: After Phase 2 (gates the actions Phase 2 added). T108 parallel with T107.
- **Phase 4 (US2 fields)**: After US4 (field actions inherit the gating pattern). T111 parallel with T109+T110.
- **Phase 5 (US3 components)**: After US4; independent of US2 except shared `FieldForm`/`ConfirmDelete` (already built). T114 parallel with T112+T113.
- **Phase 6 (Polish)**: After all stories; T115/T116/T118 parallel, T117 last (needs live API).

### Within Each Story

- Component tests written alongside implementation (T106, T108, T111, T114).
- Resolved unknowns flow in: T117's verify-live answers (refusal shapes, guard proofs) feed back into the FR-105 mapper — if the live shape contradicts the contract, amend research.md + contract before changing UI code.

### Parallel Opportunities

- Phase 1: T102 + T103 in parallel (after T101).
- US1: T106 in parallel with T104+T105.
- US4: T108 in parallel with T107.
- US2: T111 in parallel with T109+T110.
- US3: T114 in parallel with T112+T113.
- Polish: T115 + T116 + T118 in parallel; T117 final.

---

## Notes

- [P] tasks = different files, no dependencies; [Story] label (US1–US4) maps each story-phase task for traceability.
- No `apps/api` or `packages/*` changes are tasked. If implementation hits an API gap, stop and amend the spec — do not silently extend the API.
- Recorded follow-up API items (NOT this slice — Slice 8 candidates): (a) `updateField` reserved-name/type validation parity with `createField` (R-07-02); (b) real `force` semantics or removal of the ignored `?force` param on type delete (R-07-03); (c) ownership check of `:id` vs `:fieldId` on field PUT/DELETE (R-07-07 item 3).
- Commit after each task or logical group; stop at any checkpoint to validate the story independently per its quickstart step.
