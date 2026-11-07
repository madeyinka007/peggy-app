# Research: Content-Type Builder Mutations (Slice 7)

**Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

Grounded in the actual repo (`apps/api/src/routes/*`, `packages/auth/src/*`, `packages/db/src/schema-content-types.ts`, `apps/admin/src/*`) post-foundation-commit `967a773`. Where the spec and the API disagree, the API wins and the UI adapts or discloses.

## R-07-01 — Registry mutation routes exist and are permission-gated (verified 2026-11-07)

- **Decision**: Build the UI on the routes as they stand after `967a773` — no further API changes needed for US1–US3. Verified inventory:
  - `POST /api/v1/content-types` — gate `content-type.create` — 201 row; 400 on duplicate name/slug (`unique` constraints) or slug-check violation.
  - `GET /api/v1/content-types` — read-open — `{ data }` list (no `fields` per row).
  - `GET /api/v1/content-types/:id` — read-open — `{ ...type, fields }`.
  - `PUT /api/v1/content-types/:id` — gate `content-type.update` — returns `{ ...ct, fields }` (fixed in `967a773` to match `GET`); 404 unknown id. Accepts any subset of `{ name, displayName, description, isLocalized, hasDraftPublish }` — passed straight to the service spread.
  - `DELETE /api/v1/content-types/:id[?force=true]` — gate `content-type.delete` — 204; documents present ⇒ FK `restrict` rejects (see R-07-03).
  - `POST /api/v1/content-types/:id/fields` — gate `content-type.update` — 201 field; 422 reserved name / invalid type (`msg.includes("Reserved")` / `"Invalid field type"` branches), else 400.
  - `GET /api/v1/content-types/:id/fields` — read-open — `{ data }` ordered by `sortOrder`.
  - `PUT /api/v1/content-types/:id/fields/:fieldId` — gate `content-type.update` (**added in `967a773`**; was unguarded) — 200 field; 404 unknown.
  - `DELETE /api/v1/content-types/:id/fields/:fieldId` — gate `content-type.update` (**added in `967a773`**; was unguarded) — 204, deprecate-not-drop; 404 unknown.
  - `POST /api/v1/components` — gate `component.create` — 201 row (schema v1 created).
  - `PUT /api/v1/components/:id` — gate `component.update` — `{ ...comp, fields }` (fixed in `967a773`); 404 unknown.
  - `DELETE /api/v1/components/:id` — gate `component.delete` — 204; referenced ⇒ 409 `"Component is referenced by fields"`.
  - `POST /api/v1/components/:id/fields` — gate `component.update` — same 201/422/400 shapes as the type-field POST.
  - `GET /api/v1/components/:id/fields` — read-open — `{ data }`.
  - `PUT` / `DELETE /api/v1/components/:id/fields/:fieldId` — gate `component.update` (**new routes, added in `967a773`**; no Slice 3 contract coverage — recorded in contracts/builder-registry-endpoints.md as contract extensions).
  - `GET /api/v1/content-types/:id/versions` — read-open — schema version history (read-only; rollback UI out of scope).
- **Rationale**: The foundation commit closed exactly the two gaps found during spec-first grounding (unguarded field routes, missing component field endpoints) and aligned PUT responses with the typed client. No open API work blocks the UI.
- **Alternatives considered**: Adding `GET /users/:id/roles`-style permission discovery — not needed; R-04 progressive disclosure + `RouteGuard` already cover builder gating (US4).

## R-07-02 — `updateField` validates nothing; rename/type-change is a disclosed gap

- **Decision**: `packages/auth/src/fields.ts:updateField` spreads `data` directly into the update with **no** `isReservedFieldName` / `isValidFieldType` checks (unlike `createField`, which rejects both with 422). The UI therefore treats rename and type-change as constrained operations: (1) the edit form blocks reserved names client-side using the same blocklist (documented in the contract; server parity is a future API task, not this slice); (2) changing `fieldType` on an existing field requires an explicit confirmation step warning that existing document payloads keep old values (no migration — spec Out of Scope); (3) `name` renames warn likewise. The honest alternative — leaving rename fully open — risks silent schema/document divergence.
- **Rationale**: Client discloses and constrains where the server is permissive; matches the slice's no-API-changes charter while keeping the dangerous action visible. A server-side `updateField` validation parity task is recorded as a recommended Slice-8 API item in tasks.md (not implemented here).
- **Alternatives considered**: Fixing `updateField` server-side in this slice — rejected: service-layer change with validation-error contract implications; belongs in an API slice with its own tests.

## R-07-03 — Type delete: `force` is accepted and ignored; the FK is the real guard

- **Decision**: `DELETE /api/v1/content-types/:id?force=true` reaches `deleteContentType(id, _force)` — the parameter is prefixed unused and the function deletes unconditionally (`packages/auth/src/content-types.ts`). The actual protection when documents exist is the DB FK `documents.contentTypeId ON DELETE RESTRICT` (`packages/db/src/schema-documents.ts:24`), which rejects the delete at the database layer. The UI therefore: (1) offers **no force path** (no checkbox, no `?force=true`); (2) treats any non-204 delete response as a refusal and renders the server message with the type left in place; (3) confirms every delete explicitly since success is irreversible (no soft-delete on types — unlike `deleteField`'s deprecate behavior).
- **Rationale**: Offering a `force` affordance the server ignores would be dishonest UI. The FK behavior is verified by schema inspection; live refusal-path verification belongs in the quickstart gate (T-tasks).
- **Alternatives considered**: Implementing real `force` semantics (delete type + cascade documents) — rejected outright: destructive, needs its own spec, never implicit.

## R-07-04 — `activeSchemaVersion` is the mutation receipt

- **Decision**: `createField`/`updateField`/`deleteField` all call `bumpSchemaVersion` (type- or component-scoped), incrementing `activeSchemaVersion` and snapshotting `{ fields: [{ name, type }] }` into `schemaVersions`. Type/component **metadata** edits (`updateContentType`/`updateComponent`) do **not** bump. The UI re-reads the owner after every mutation (`getContentType`/`getComponent`, which include `fields`) and displays the new version next to the name — this is both the success confirmation and the concurrency signal (a version that moved under the user triggers the Slice-6 warn-and-revalidate pattern on next save).
- **Rationale**: Verified in `packages/auth/src/fields.ts:bumpSchemaVersion` + new integration tests (create 1→2, update 2→3). No extra endpoint needed; the existing detail GETs carry the pointer.
- **Alternatives considered**: Reading `/versions` after each mutation — heavier, same information; the detail GET is sufficient.

## R-07-05 — Builder UI placement: extend the existing content-types page

- **Decision**: Extend `apps/admin/src/app/content-types/page.tsx` in place (new builder components alongside `TypeDetail`/`ComponentDetail`/`FieldTable`) rather than a separate route tree. State continues in search params (`?type=<id>&action=new|edit-field|<fieldId>` style — plan finalizes the exact param vocabulary) so views stay deep-linkable under static export. New components: `TypeForm` (create/edit), `FieldForm` (create/edit, both owners), `ConfirmDelete` (type/component/field with the deprecation/refusal messaging), reorder controls on the field table rows. All behind the existing `RouteGuard`, with per-action permission checks via the `auth.tsx` `can()` helper (`content-type.create/update/delete`, `component.create/update/delete`).
- **Rationale**: The read views already own the list/detail layout, refresh logic, and error states the builder reuses (T027/T034 patterns). A parallel page would duplicate the registry loading + guard wiring. Keeps the change reviewable as one page + N new components.
- **Alternatives considered**: Separate `/builder/` route tree — rejected: duplicates list/detail/guard code; deep-link params already solve addressability.

## R-07-06 — Typed client foundation already landed (`967a773`)

- **Decision**: `apps/admin/src/lib/api-client.ts` already exports the full mutation surface (`createContentType`, `updateContentType`, `deleteContentType`, `createComponent`, `updateComponent`, `deleteComponent`, `createContentTypeField`, `createComponentField`, `updateField`, `updateComponentField`, `deleteContentTypeField`, `deleteComponentField`) with contract tests (16 tests in `apps/admin/tests/lib/api-client.test.ts`, mocked fetch). Builder tasks consume these as-is; no client changes expected except error-mapper additions if new coded shapes appear during quickstart validation.
- **Rationale**: Spec-first sequencing — the foundation commit exists precisely so this slice's tasks are UI-only (plus tests), mirroring Slice 6's client-first Phase 2.

## R-07-07 — Verify-live items for the tasks phase

1. Confirm 403 (not 401-shape) for a non-privileged session on each of the 8 gated mutation routes — guards were added by code inspection against the `requirePermission` pattern; live proof belongs in quickstart validation.
2. Confirm the exact refusal shape of type-delete-with-documents (expected: 500/FK message via unhandled rejection vs a coded error — the route has no try/catch on delete; quickstart must record what the UI actually receives so FR-105's "human message" mapping targets the real shape).
3. Confirm `PUT .../fields/:fieldId` ignores the `:id` segment (code shows `updateField(req.params.fieldId, ...)` — owner mismatch is not checked); UI must therefore always address the field under its true owner, and the spec records the ownership-check gap as a future API item.
