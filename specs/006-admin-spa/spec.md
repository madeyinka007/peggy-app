# Feature Specification: Schema-Driven Admin SPA (Slice 6)

**Feature Branch**: `006-admin-spa`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "006-admin-spa: Schema-driven Next.js Admin SPA (static export) — content manager (list/table per collection type, create/edit forms generated from registry schemas, locale switcher, publish/unpublish), media library UI (folders, upload via signed flow, picker), content-type builder read views; pure API consumer, no server imports"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor manages content documents (Priority: P1)

Emeka (content editor, non-technical) opens the admin, sees a list of content types in the nav, picks "Posts", and sees a table of documents with columns derived from the type's schema (title, slug, status, locale, updated-at). He creates a new Post through a form generated from the registry schema — text inputs, required markers, validation messages appear inline from server error responses. He saves a draft, previews it, then publishes the English locale with a confirmation step. He switches to French, edits the translation, and publishes fr independently.

**Why this priority**: Content management is the core reason the admin exists. Without it, every document operation requires raw API calls. This is the MVP of the admin — everything else is supporting UI.

**Independent Test**: Seed a `Post` collection type with title/slug/body/cover fields. Log in as editor. Create a Post via the UI form → draft saved. Publish en → status badge changes. Switch to fr → create translation → publish. Verify the public API reflects en-published/fr state. All without touching curl.

**Acceptance Scenarios**:

1. **Given** an authenticated editor with `documents.read` on Posts, **When** they navigate to the Posts list, **Then** they see a table with schema-derived columns, status badges (draft/published per locale), and pagination matching the API's page/pageSize contract.
2. **Given** the Posts form, **When** they submit with a missing required field, **Then** inline field errors appear (from the server's 400 `{ error: { details: [{ path, message }] } }` envelope), and no request payload is lost.
3. **Given** an English draft, **When** they press Publish with locale=en and confirm, **Then** the status badge updates to published, an audit-visible confirmation appears, and the public API returns the document.
4. **Given** a published en document with no fr version, **When** they switch the locale selector to fr, **Then** the form shows empty/translatable fields (not en values masquerading as fr), with a visible "translation missing" state.
5. **Given** an editor lacking `documents.publish`, **When** they view a document, **Then** the Publish button is hidden or disabled (server still enforces with 403; UI must not imply capability).

### User Story 2 - Editor browses and inserts media (Priority: P1)

Emeka needs a cover image for his Post. From the Post form's `cover (media)` field, he opens a media picker: folder tree on the left, asset grid on the right, search box. He navigates to `/landing`, finds `hero.jpg`, selects it. Back in the standalone Media Library view, he uploads a new file: picks a file, the UI requests signed params from `POST /api/v1/media/sign`, PUTs bytes direct to the provider, then confirms via `POST /api/v1/media`. Oversize or disallowed-MIME files show a clear error before upload (client pre-check) and the server's 422 is surfaced if it slips through. He creates a folder, renames it, and moves an asset into it. He attempts to delete an asset referenced by a published document and sees the "referenced by N documents" blocking message with the option to force-delete only if he holds `media.manage`.

**Why this priority**: Media is inseparable from content authoring (J-04 journey: upload → place in folder → attach to Post). A content manager without media insertion forces editors back to API calls for every image. Same priority as US1 — together they form the editor MVP.

**Independent Test**: From a Post form, open the picker, browse folders, select an asset → field populated with asset id + thumbnail. Separately: upload a file through the Media Library view → appears in grid. Delete a referenced asset without force → 409 message shown. All through the UI.

**Acceptance Scenarios**:

1. **Given** a media field in a document form, **When** they open the picker, **Then** folders and assets load from the API, search filters the grid, and selecting an asset populates the field with a thumbnail preview.
2. **Given** the Media Library upload dropzone, **When** they drop a valid image, **Then** a progress indicator shows during the direct-to-provider PUT, and the asset appears in the current folder on confirm.
3. **Given** a 50MB video when the limit is lower (or an `.exe`), **When** they attempt upload, **Then** a human-readable error names the limit/reason (from the 422 `{ limit, received }` details or `MIME_NOT_ALLOWED`) before or immediately after the attempt — never a silent failure.
4. **Given** an asset referenced by a published document, **When** they delete without force, **Then** the UI shows the referencing documents (from the 409 `references[]` payload) and requires explicit force confirmation plus `media.manage`.

### User Story 3 - Architect reviews content models (Priority: P2)

Sofia (content architect) opens the Content-Types section and sees all registered types: collections, singles, components. She opens `Post` and sees its fields (name, type, required, localized, unique), relations with on-delete policies, and the current schema version. She sees which types have draft/publish and i18n enabled. This is read-only in Slice 6 — schema mutation UI is a later slice — but the read view must render entirely from the registry API (`GET /api/v1/content-types`), never hardcoded.

**Why this priority**: Architects need visibility into the models editors are filling. Read views unblock understanding and verification without committing to the full builder mutation surface (which is its own slice of work).

**Independent Test**: Register two content types + one component via API. Open Content-Types in admin → both listed with correct kinds, field tables, and version numbers. Add a field via API → re-open → new field appears without admin redeploy.

**Acceptance Scenarios**:

1. **Given** registered content types, **When** they open Content-Types, **Then** each type shows kind (collection/single/component), field list with type/required/localized flags, relations, draft-publish and i18n toggles, and schema version.
2. **Given** a schema change made via API, **When** they revisit the type view (after cache invalidation), **Then** the new shape renders with no admin code change or redeploy.

### User Story 4 - Admin authenticates and respects RBAC (Priority: P1)

Ada (developer) seeds a super-admin, logs into the admin with email + password (session cookie, Better Auth). The nav shows only sections her permissions allow: an Author sees Content and Media but not Content-Types or Roles; an Editor additionally sees publish controls. A logged-out visitor hitting any admin route is redirected to login. API tokens are out of scope for admin login (human session only).

**Why this priority**: Auth gates everything — shipping any UI without it exposes admin functions. It underpins US1–US3 (every scenario starts "Given an authenticated editor").

**Independent Test**: Log in as Author → nav lacks admin sections, direct URL to roles redirects or shows forbidden. Log out → any protected route redirects to login. Log in as super-admin → all sections visible.

**Acceptance Scenarios**:

1. **Given** no session, **When** they visit any admin route except login, **Then** they are redirected to the login page, and post-login return to the originally requested page.
2. **Given** an Author session, **When** the nav renders, **Then** Content and Media appear but Content-Types/Roles/Users do not (server remains the enforcer; UI hiding is progressive enhancement).
3. **Given** a failed login, **When** credentials are wrong, **Then** a generic error appears (no user-enumeration detail) and the password field is cleared.

### Edge Cases

- API unreachable or returns 500: admin shows a full-page or inline error with requestId (from the error envelope) and a retry action — never a blank screen or infinite spinner.
- Schema version changes mid-edit: if the registry version increments while a form is open, the UI warns on save and revalidates against the fresh schema rather than silently submitting stale-shaped data.
- Locale with no document row: form shows empty translatable fields with "untranslated" indicator, not a 404 page — creating the translation is the expected action.
- Asset deleted at the provider but row remains: picker shows a broken-thumbnail state with the asset name, not a crash.
- Large folders (100+ assets): grid paginates (respecting API page/pageSize, clamped ≤100) rather than fetching all.
- Session expiry mid-session: next mutation gets 401 → UI redirects to login preserving the current location, with unsaved form data retained in memory where feasible.
- Static-export constraint: no server-side data fetching; all data loads client-side after mount. Deep links to admin routes work from the CDN (SPA fallback routing configured).

## Functional Requirements

- **FR-001**: Admin authenticates humans via session cookie against the API's auth endpoints; logged-out access to any non-login route redirects to login with return-to support.
- **FR-002**: Navigation and action controls render based on the authenticated user's permissions; every control the server would reject (403) is hidden or disabled, with the server remaining the source of truth.
- **FR-003**: Content list views render tables with columns derived from the content-type schema fetched from the registry API — no per-type hardcoded columns (per Constitution P-06 and arch rule P-07; CI must not find `PostForm`-style components).
- **FR-004**: Document forms are generated from registry schemas: field widgets by field type (text, richtext/markdown, number, boolean, date/datetime, enumeration, relation, media, component, dynamic zone ordering), required markers, and inline errors mapped from the server's 400 `details[{ path, message }]` envelope.
- **FR-005**: Locale switcher on document views lists active locales from the API; switching loads that locale's version; missing translations show an explicit empty state (never en data presented as another locale).
- **FR-006**: Publish/unpublish actions require confirmation, send locale-scoped requests, and reflect the resulting per-locale status in the UI; publish buttons are gated on publish permission.
- **FR-007**: Media Library view supports folder navigation (tree or breadcrumb), asset grid with search, upload via the signed flow (sign → direct PUT → confirm) with progress, and folder CRUD (create/rename/move/delete with recursive confirmation).
- **FR-008**: Document media fields open a picker (browse + search + select) that populates the field with the chosen asset reference and thumbnail.
- **FR-009**: Server-coded errors surface as human messages: 409 `MEDIA_REFERENCED` lists referencing documents; 422 `FILE_TOO_LARGE` names limit/received; 422 `FOLDER_DEPTH_EXCEEDED`/`FOLDER_CYCLE` explain the constraint; 413 points at the signed flow.
- **FR-010**: Content-Type read views render kind, fields, relations, toggles, and schema version purely from the registry API.
- **FR-011**: The admin is a pure API consumer: no server-only imports, no direct database access (Constitution P-04); all data loads client-side (compatible with static export).
- **FR-012**: Every API failure path renders a user-visible state with retry where applicable, including requestId from the error envelope for reportability.

## Success Criteria

- **SC-001**: An editor with no API knowledge creates a Post, uploads a cover image through the signed flow, publishes English, and sees it on the public API — all through the UI in under 10 minutes.
- **SC-002**: A French translation workflow (switch locale → empty state → fill → publish fr) completes without ever displaying English content as French.
- **SC-003**: An Author-role user cannot discover or invoke publish, media-force-delete, or content-type screens through the UI (and server 403s confirm enforcement if attempted directly).
- **SC-004**: Adding a new field to a content type via API appears in the admin list, form, and type views with no admin code change or redeploy.
- **SC-005**: Upload, picker-select, folder operations, and delete-guard flows each complete end-to-end against a live API with only human-readable errors on failure paths.
- **SC-006**: The admin bundle deploys as static files to a CDN with client-side routing (deep links resolve), and no page requires server-side data fetching.

## Key Entities

- **Admin session**: Authenticated human identity (cookie-bound) with resolved permissions driving nav and control visibility; expired sessions redirect to login.
- **Schema-derived view**: Any list/form/detail rendered from a registry content-type definition at runtime (columns, widgets, validation) rather than from admin source code.
- **Document working set**: The document + active locale + draft/published pointers the editor is viewing; locale switch changes the working set, never the displayed language of stored data.
- **Media selection**: Asset reference (id + thumbnail + provider metadata) held by a media field or the picker pending confirmation.
- **Upload job**: Client-side state machine for one file (pre-check → sign → PUT with progress → confirm → done/failed with reason).

## Assumptions

- API surface from Slices 1–5 is stable: auth session endpoints, content-types registry reads, documents CRUD + publish/unpublish with locale, media sign/confirm/folders with coded errors, locales list, OpenAPI at `/api/v1/openapi.json`.
- API base URL and auth cookie domain are provided via build-time configuration (e.g. `NEXT_PUBLIC_API_URL`); the admin never hardcodes environments.
- Content-type schema *mutation* UI (builder create/edit fields) is explicitly out of scope — read views only; builder mutations remain API-level until a later slice.
- User/role administration screens are out of scope for Slice 6 (covered by direct API or a later slice); nav simply omits them.
- Richtext editing uses a basic textarea/markdown input in Slice 6; a rich WYSIWYG editor is a later enhancement.
- Relation fields render as id-based selectors (search by id/slug) in Slice 6; rich autocomplete with populated previews is a later enhancement.

## Out of Scope

- Content-type builder mutations (create/edit/delete types and fields via UI).
- User, role, and permission administration screens.
- API token management UI.
- Webhook, plugin, audit-log, or outbox viewer screens.
- WYSIWYG richtext editor; bulk operations UI; import/export UI.
- Server-side rendering of admin pages; anything requiring a Node server at request time.
