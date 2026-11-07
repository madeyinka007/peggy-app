# Feature Specification: Content-Type Builder Mutations (Slice 7)

**Feature Branch**: `007-content-type-builder`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "007-content-type-builder: Content-Type Builder UI — create/edit/delete content types and components, add/edit/remove/reorder fields on both, all through the admin SPA against the existing registry API; permission-gated per content-type.*/component.*; schema-version visible after every mutation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Architect creates and edits content types (Priority: P1)

Sofia (content architect, super-admin or holder of `content-type.create` / `content-type.update`) opens the admin's Content-Types section and — alongside the Slice 6 read views — sees a "New content type" action. She creates a `Product` collection type: name, kind (collection/single, chosen once at creation), collection slug, display name, description, draft-publish and i18n toggles. The new type appears in the registry list immediately with schema version v1. She later edits the display name/description/toggles of `Post`; the detail view reflects the change plus the unchanged `activeSchemaVersion` (metadata edits do not bump the version — only field mutations do, per `packages/auth/src/fields.ts:bumpSchemaVersion`). She deletes an unused type after an explicit confirmation; deleting a type that still has documents is refused with the server's message.

**Why this priority**: Type lifecycle is the entry point to every other builder flow — no type, no fields. It also exercises the full mutation round-trip (client → permission gate → version display) that field/component stories reuse.

**Independent Test**: Via the UI only — create a `Product` collection type → it lists with v1. Edit its display name → detail updates, version stays v1. Delete it → gone from list. Attempt to delete a type with documents → refused with a readable error, type intact.

**Acceptance Scenarios**:

1. **Given** an authenticated user with `content-type.create`, **When** they submit the new-type form with a valid name/kind/slug, **Then** the API returns 201, the list shows the type with v1, and the form resets to the list view.
2. **Given** the new-type form, **When** they submit a duplicate name or an invalid slug (uppercase/underscores/spaces — the `content_types_slug_check` `^[a-z0-9-]+$`), **Then** the server's 400 message renders inline on the form and the payload is preserved.
3. **Given** an existing type, **When** they edit display name/description/toggles and save, **Then** the detail view shows the new values and `activeSchemaVersion` is unchanged.
4. **Given** a type with zero documents, **When** they confirm delete, **Then** the type disappears from the list (204 path).
5. **Given** a type with documents, **When** they attempt delete, **Then** the refusal surfaces readably (the `documents.contentTypeId` `onDelete: restrict` FK rejects the delete; see R-07-03 on `force` semantics) and the type remains listed.
6. **Given** a user lacking `content-type.create`/`update`/`delete`, **When** they view the builder, **Then** the corresponding actions are hidden or disabled (server 403 remains the enforcer; 403 on attempt ⇒ inline "not permitted" notice).

### User Story 2 - Architect manages fields on a content type (Priority: P1)

Sofia opens `Post`, sees its field table (Slice 6 read view), and now has field actions: add a field (name, label, one of the 16 `VALID_FIELD_TYPES`, required/localized/searchable flags, sort order, plus the type-specific config — `validation` options for enumerations, `relationConfig`, `componentConfig`, `dynamiczoneConfig`, `mediaConfig`), edit a field's label/flags/config, and remove a field. After each mutation the detail shows the bumped `activeSchemaVersion` (create bumps v→v+1 via `bumpSchemaVersion`; update and delete bump likewise). Removing a field warns that the field is **deprecated, not dropped** — the row remains listed (verified T030: `deleteField` updates the timestamp and bumps the version but keeps the row readable). Field order follows `sortOrder`; the UI offers move-up/move-down that persists via `sortOrder` rewrites.

**Why this priority**: Fields are the actual schema architects iterate on. This is the highest-frequency builder workflow and the one where the verified service semantics (version bumps, deprecate-not-drop) must be communicated honestly in the UI rather than faked.

**Independent Test**: Via the UI only — add `subtitle` (text, localized) to `Post` → appears in the field table, version bumps. Rename its label → version bumps again. Move it above `title` → order persists on revisit. Remove it → deprecation warning shown, row remains with version bumped.

**Acceptance Scenarios**:

1. **Given** a type detail view, **When** they add a field with valid name/type, **Then** the table shows it (201 path) and `activeSchemaVersion` increments by exactly 1.
2. **Given** the add-field form, **When** they use a reserved name (`id`, `createdAt`, … — the `isReservedFieldName` blocklist) or an unknown type, **Then** the 422 message renders on the name/type input and nothing is created.
3. **Given** an existing field, **When** they edit label/required/validation and save, **Then** the table reflects the change and the version bumps (see R-07-02: rename/type-change validation gap is disclosed, not silently assumed).
4. **Given** the remove action on a field, **When** they confirm, **Then** a deprecation notice explains the field is retained (not dropped) and the version bumps; the table still lists the row afterwards.
5. **Given** two fields, **When** they move one up/down, **Then** the order persists after leaving and revisiting the type (via `sortOrder` update, version bump expected).

### User Story 3 - Architect manages components and their fields (Priority: P2)

Sofia manages the shared `SEO` component from the same builder surface: create a component (name, display name, category), edit its metadata, add/edit/remove/reorder fields on it via the new `PUT`/`DELETE /api/v1/components/:id/fields/:fieldId` endpoints (added in the `967a773` foundation commit; absent from the Slice 3 contract — see contracts note). Deleting a component referenced by any field is refused with the server's "referenced" message. Component fields bump the component's own `activeSchemaVersion`, independent of any using type's version.

**Why this priority**: Components are shared building blocks; their lifecycle mirrors types but with the reference-block rule instead of the document rule. P2 because types+fields (US1–US2) deliver the core builder value first.

**Independent Test**: Via the UI only — create `SEO` component → v1. Add a `metaTitle` text field → component version bumps. Reference it from a `Post` field's `componentConfig` → delete attempt refused with "referenced". Remove the reference → delete succeeds.

**Acceptance Scenarios**:

1. **Given** `component.create`, **When** they create a component, **Then** it lists with v1.
2. **Given** a component, **When** they add/edit/remove/reorder its fields, **Then** each mutation bumps the component's `activeSchemaVersion` and the field table reflects it (same semantics as US2, component-scoped).
3. **Given** a component referenced by any field (`componentId` FK or `componentConfig.componentId`), **When** they delete it, **Then** the refusal names the reference and the component remains.
4. **Given** a user lacking `component.*` permissions, **When** they view components, **Then** mutation actions are hidden/disabled with 403 handled inline.

### User Story 4 - Builder respects RBAC end to end (Priority: P1)

Ada (developer) verifies the permission matrix: an Author (no `content-type.*`/`component.*`) sees the Slice 6 read views but no mutation actions; direct mutation attempts return 403 and surface as inline notices, never crashes. A user with `content-type.update` but not `delete` sees edit affordances but no delete. Session expiry mid-builder (401) stashes the in-memory builder draft and redirects to `/login?returnTo=…`, reusing the R-07 pattern from Slice 6.

**Why this priority**: Builder mutations are the most privilege-sensitive admin surface (schema changes affect every editor). Gating must be verified as its own story, not assumed from the read views.

**Independent Test**: quickstart.md step 4 — Author sees read-only builder, direct mutation calls 403; partial-permission user sees exactly their actions; expired session redirects with draft preserved.

**Acceptance Scenarios**:

1. **Given** a session without `content-type.update`, **When** any builder mutation is attempted, **Then** the server 403 surfaces as an inline "not permitted" notice and no UI state is corrupted.
2. **Given** a logged-out visit to a builder URL, **When** the guard runs, **Then** redirect to `/login?returnTo=<builder-url>` (existing `RouteGuard` behavior, extended to new builder routes).
3. **Given** a 401 during a builder mutation, **When** it occurs, **Then** the in-memory form draft is stashed and restored post-login (R-07 pattern).

### Edge Cases

- Concurrent schema edits: two architects editing one type — last write wins at the API (no ETags); the UI re-fetches after every mutation so the displayed `activeSchemaVersion` is always the server's latest, and a mid-edit version change surfaces the same warn-and-revalidate treatment as Slice 6 document forms.
- Field name/type rename on a populated type: the API's `updateField` performs **no reserved-name/type validation** (gap vs `createField`, R-07-02) — the UI discloses this and constrains renames client-side (reserved names blocked in the form; type changes require explicit confirmation and warn about existing document data).
- Type delete with `force=true`: the route accepts `?force=true` but the service ignores it (`deleteContentType(id, _force)` deletes unconditionally; the FK does the real blocking) — the UI does **not** offer a force path until the service honors it (R-07-03). Delete refusal shows the server message.
- Deprecated fields accumulate: removed fields stay listed (by design). The field table marks visibly deprecated rows only if the API ever distinguishes them — until then, no fake "deleted" state is rendered.
- Static-export constraint (unchanged from Slice 6): all builder views are client components fetching after mount; no dynamic route segments (search params only); loading/error/empty states everywhere.
- Documents written against an older schema version keep working: schema versions are snapshots; the builder never migrates document data (document migration is explicitly out of scope).

## Functional Requirements

- **FR-101**: Builder create/edit/delete views for content types (name, kind-at-creation, collection slug, display name, description, draft-publish + i18n toggles) against `POST /api/v1/content-types`, `PUT /api/v1/content-types/:id`, `DELETE /api/v1/content-types/:id` (typed client already landed in `967a773`).
- **FR-102**: Field add/edit/remove/reorder on content types against `POST/PUT/DELETE /api/v1/content-types/:id/fields[/:fieldId]`, with `activeSchemaVersion` re-read and displayed after every mutation.
- **FR-103**: Component create/edit/delete plus component field add/edit/remove/reorder against `POST/PUT/DELETE /api/v1/components[/:id]` and `POST/PUT/DELETE /api/v1/components/:id/fields[/:fieldId]`.
- **FR-104**: Every mutation action is gated on its `content-type.*` / `component.*` permission string (create/update/delete per resource); missing permissions hide or disable the action, and server 401/403 responses are handled per the Slice 6 patterns (login redirect with draft stash; inline forbidden notice).
- **FR-105**: Server-coded failures surface as human messages: 422 reserved-name/invalid-type on field create; 400 slug/name violations on type create; 409/reference refusals on component delete; delete-type refusal message when documents exist. Payloads are always preserved on failure.
- **FR-106**: Field forms expose the full 16-type widget surface for defaults/configs where meaningful (enumeration `validation.options`, relation/component/dynamiczone/media configs); `sortOrder` is managed via explicit ordering actions, never free-number entry alone.
- **FR-107**: Builder remains a pure API consumer (Constitution P-04 — no new server imports in `apps/admin`) and stays schema-driven (P-06/P-07 — no per-type builder branches; the field-type universe renders from the same 16-type map).
- **FR-108**: `kind` (collection/single) is immutable after creation — the edit form does not offer it (no API or DB path supports safe kind migration; changing it would orphan document semantics).

## Success Criteria

- **SC-101**: An architect with no API knowledge creates a type, adds three fields of different types, reorders them, edits one, removes one (seeing the deprecation notice), and watches the schema version advance on each field mutation — all through the UI in under 15 minutes.
- **SC-102**: The same flow on a component completes with component-scoped version bumps, and a referenced-component delete is refused with the reference named.
- **SC-103**: A user without builder permissions cannot discover or invoke any builder mutation through the UI, and direct calls fail with server 403s surfaced inline (never crashes or blank states).
- **SC-104**: Builder views deploy inside the existing static export (`pnpm build` → `out/`) with deep links resolving and no server-side data fetching.

## Key Entities

- **Builder draft**: The in-memory new-type / new-field / edit form state held in React state (+ URL search params for selected type/component so views stay deep-linkable); stashed across 401 redirects per R-07.
- **Schema version pointer**: The `activeSchemaVersion` re-read after each mutation and displayed next to the type/component name — the user's proof the mutation landed and the concurrency signal.
- **Deprecated field**: A field row retained by `deleteField` (timestamp touched, version bumped, row still listed) — rendered honestly as still-present, never as deleted.

## Assumptions

- Registry API surface as verified 2026-11-07 (post-`967a773`): all routes in contracts/builder-registry-endpoints.md exist with the stated permission gates; `GET` list/detail/fields stay read-open.
- `NEXT_PUBLIC_API_URL` + session cookie mechanics unchanged from Slice 6 (R-01 stands; no new CSRF behavior for these endpoints — all are same JSON-cookie mutations).
- Document data migration on field rename/remove is **not** performed by the builder or the API; existing document payloads keep old keys until edited.
- No new workspace packages: builder UI lives in existing `apps/admin/src` (new `app/content-types/builder`-adjacent views or extensions of the existing page — plan decides).

## Out of Scope

- Document data backfill/migration when fields are renamed or removed.
- `?force=true` type-delete semantics (service ignores it; UI offers no force path — R-07-03).
- `kind` migration (collection ↔ single) on existing types.
- User/role/permission administration screens (still API-level).
- Version rollback / schema diff viewer (versions are recorded server-side; viewing/restoring them is a later slice).
- WYSIWYG config editors for field configs (JSON textarea with validation, consistent with Slice 6's `json` widget).
