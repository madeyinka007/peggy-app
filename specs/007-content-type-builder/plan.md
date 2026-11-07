# Implementation Plan: Content-Type Builder Mutations (Slice 7)

**Branch**: `007-content-type-builder` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-content-type-builder/spec.md`

## Summary

Extend the Slice 6 Content-Types read views into a full builder: type/component create-edit-delete plus field add-edit-remove-reorder on both owners, all in `apps/admin` as a pure API consumer. The typed client, backend permission gates, and component field routes already landed as the `967a773` foundation (research R-07-01/R-07-06), so this plan is **UI + tests only** — zero `apps/api` / `packages/*` changes. Work extends `apps/admin/src/app/content-types/page.tsx` in place (R-07-05) with new form components, per-action RBAC gating via the existing `can()` helper, and the Slice 6 error/draft-stash patterns throughout.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 22 LTS, pnpm 9 (repo-locked)

**Primary Dependencies**: Existing `apps/admin` stack (Next.js 15 static export, React 19, `better-auth` client, hand-rolled components + CSS). No new dependencies — forms reuse the Slice 6 `FieldWidget` value inputs where shapes overlap (text/checkbox/select/JSON textarea); no new UI kit.

**Storage**: N/A — same as Slice 6. Builder drafts live in React state (+ URL search params for selected type/component/action so views stay deep-linkable). Session in the `HttpOnly` cookie.

**Testing**: Same `apps/admin` vitest + RTL + jsdom setup (T001–T002). New component tests for `TypeForm`/`FieldForm`/`ConfirmDelete`/reorder controls (mocked `api-client`, never live); new contract tests only if quickstart surfaces unmapped error shapes. DB-backed service tests already cover the mutation semantics (20/20 in `content-types.integration.test.ts`, incl. component-owned fields). E2E deferred — quickstart.md is the manual validation gate, same as Slice 6.

**Target Platform**: Same static export (`out/` on Amplify with SPA-fallback rewrites); new builder views are client components under the existing `/content-types/` shell — no new top-level routes, no export config changes.

**Project Type**: Web SPA — frontend-only slice in `apps/admin`.

**Performance Goals**: Same as Slice 6 (instant shell; interactive <2s). Builder adds no list-scale concerns: field tables are tens of rows; type/component lists reuse the existing unpaginated reads.

**Constraints**: `output: 'export'` ⇒ no dynamic segments (action state in search params, plan §Structure); P-04 (no server imports — eslint ban already covers new files); P-06/P-07 (no per-type builder branches; CI grep stays green); `kind` immutable after creation (FR-108 — no kind control on edit forms).

**Scale/Scope**: Same editorial-team scale as Slice 6. No pagination work: registry lists are small by nature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P-04 — Admin is a pure API consumer.** New components import only `@/lib/api-client`, `@/lib/auth`, `@/components/*`; zero `apps/api`/`packages/*` changes in this plan (foundation commit already landed separately). Eslint import ban covers new files automatically.
- [x] **P-06/P-07 — Schema-driven, no per-type UI.** Builder forms render the 16-type field universe generically; enumeration options read from `validation.options` (T009-verified key); config JSONBs edit as validated textareas. No `Post*`-style components; tasks include the P-07 grep gate.
- [x] **Auth boundary.** Every mutation button checks `can("content-type.*")` / `can("component.*")` before rendering; 401 ⇒ draft-stash + login redirect (R-07), 403 ⇒ inline notice. Server remains the enforcer — tasks verify the 403 path per action.
- [x] **No data-layer changes.** No tables, no migrations, no service changes. The two disclosed server gaps (R-07-02 `updateField` validation, R-07-03 `force` no-op) are handled as UI constraints, each with a recorded follow-up API item — not silent workarounds.
- [x] **Security baseline.** Destructive actions (type/component/field delete) require explicit confirmation; delete-type states irreversibility (no soft-delete on types); no secrets in forms; `requestId` rendered where the envelope provides it.

**Post-design re-check**: design introduces no new violations. Two residual risks carried (not violations): (1) type-delete-with-documents refusal shape is unverified live (R-07-07 item 2) — quickstart task records the real shape and tasks adapt the FR-105 mapper; (2) `PUT .../fields/:fieldId` ignores `:id` ownership (R-07-07 item 3) — UI always addresses the true owner, so no exposure within this slice.

## Project Structure

### Documentation (this feature)

```text
specs/007-content-type-builder/
├── plan.md              # This file
├── research.md          # Grounding vs verified API (R-07-01…R-07-07)
├── data-model.md        # View-model additions (TypeDraft/FieldDraft/BuilderAction)
├── quickstart.md        # Manual validation gate (steps 1–6, SC-101…SC-104)
├── contracts/
│   └── builder-registry-endpoints.md
├── checklists/
│   └── requirements.md  # (to be generated)
└── tasks.md             # Phase 2 output (NOT created by this plan)
```

### Source Code (repository root)

```text
apps/admin/src/
├── app/content-types/
│   └── page.tsx                 # EXTEND: action state (?action=…), render builder views (R-07-05)
├── components/
│   ├── TypeForm.tsx             # NEW: create/edit type (kind select only on create)
│   ├── ComponentForm.tsx        # NEW: create/edit component
│   ├── FieldForm.tsx            # NEW: create/edit field, both owners (JSON config textareas)
│   ├── ConfirmDelete.tsx        # NEW: delete confirm w/ deprecation + irreversibility copy
│   ├── FieldTable.tsx           # EXTRACT from page.tsx + reorder controls (move up/down)
│   └── ErrorState.tsx           # REUSE (unchanged)
├── lib/
│   ├── api-client.ts            # REUSE as-is (foundation landed)
│   ├── types.ts                 # EXTEND: TypeDraft/ComponentDraft/FieldDraft/BuilderAction
│   └── auth.tsx                 # REUSE can() + RouteGuard + 401 stash
└── tests/components/
    ├── TypeForm.test.tsx        # NEW
    ├── FieldForm.test.tsx       # NEW (incl. reserved-name/type-change confirm paths)
    └── BuilderActions.test.tsx  # NEW (gating matrix + reorder + delete confirm copy)
```

**Structure Decision**: Extend-in-place per R-07-05 — the read page already owns registry loading, guard wiring, and error/retry states. `FieldTable` extraction is the only refactor, keeping the diff reviewable (page + 4 new components + tests).

## Complexity Tracking

> No constitution violations — table intentionally empty.
