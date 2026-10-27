# Peggy CMS — Product Requirements Document (PRD)
**Document:** `docs/01-product-requirements.md`
**Version:** 0.2.0 — OQ-01…OQ-06 resolved, spike complete
**Status:** Draft for implementation
**Decisions locked:** D1–D10 confirmed (see §28) + OQ-01…OQ-06 resolved (see §29). Spike report: `docs/00-better-auth-spike.md`.

---

## 1. Executive Summary

Peggy is a developer-focused, headless CMS and CMS-scaffolding platform. A developer creates a Peggy project, defines content models visually (Content-Type Builder), manages content in an admin UI, and consumes that content via automatically generated REST APIs from websites, mobile apps, e-commerce frontends, and other digital experiences.

Peggy's product contract:

> Define once in a Schema Registry → Manage via schema-driven Admin → Publish with locale + lifecycle control → Consume via predictable REST without hand-written CRUD.

This PRD defines *what* Peggy must do. Technical *how* is defined in `02-technical-architecture.md` and `03-database-model.md`. No application code is authorized at this stage.

MVP scope (single deploy = single project):

- Visual Content-Type Builder (collection types, single types, components, dynamic zones, relations, media fields)
- Schema Registry as source of truth with versioning
- Document Service with locale × draft/published matrix on JSONB store
- Auto-generated REST API under `/api/v1` with filtering, sorting, pagination, populate, locale, publication-state controls
- RBAC: users → roles → granular `resource.action` permissions + owner-only condition
- Media Library with Storage Provider Interface, Cloudinary as default provider via signed uploads
- i18n: document-per-locale, per-locale publish, fallback to default locale
- Draft & Publish per locale, drafts never exposed on public API surface
- Better Auth for human authN (to be verified in spike), independent API tokens for programmatic access
- Schema-driven Next.js Admin (static SPA mode)
- Events + webhook outbox (async delivery design, minimal MVP worker)
- Nx monorepo, local Postgres via Docker for dev, Neon for prod/preview

## 2. Product Vision

Become the default TypeScript-first headless CMS for teams who want Strapi-class capabilities — visual modeling, auto-APIs, RBAC, media, i18n, draft/publish, plugins — with a cleaner document model, stronger TypeScript guarantees, serverless-safe architecture, and a stable plugin API that does not require forking core.

5-year direction: Peggy as a scaffolding platform (`create-peggy-app`, generators, import/export, multi-project tooling). MVP deliberately excludes scaffolding automation beyond a thin, stable core that the CLI can later wrap.

## 3. Problem Statement

Teams building content-driven experiences repeatedly rebuild the same undifferentiated system:

1. Content model definition scattered across code, migrations, and admin forms that drift.
2. CRUD APIs hand-written per content type with inconsistent filtering, pagination, errors, auth.
3. Draft/preview, localization, and media handling bolted on late, causing leaks (drafts exposed publicly) and data-model rewrites.
4. Permission logic embedded in controllers, untestable and insecure.
5. Plugins/themes that monkey-patch internals and break on upgrade.

Peggy solves this by making the content schema the single source of truth from which validation, persistence behavior, API contracts, permissions, and admin forms derive.

## 4. Product Goals

G-01. Any collection type created in the Builder is queryable via REST within seconds, without code changes or restarts.
G-02. Schema is source of truth: validation (Zod), API shape, and admin forms all derive from the Registry; no drift.
G-03. Draft content is unexposed by default; publication is explicit, per-locale, audited.
G-04. Permissions are deny-by-default, testable, and enforceable at query time, not only in UI.
G-05. Core has zero hard dependencies on Express, Drizzle, Next.js, Cloudinary, or Better Auth internals — all behind ports/adapters.
G-06. Admin is 100% schema-driven; no per-content-type hardcoded forms.
G-07. MVP deploys serverless-safe (Neon HTTP, signed uploads, no in-request background work).

## 5. Non-Goals (MVP)

NG-01. No GraphQL in MVP (plugin slot reserved).
NG-02. No multi-tenant SaaS (one deploy = one project).
NG-03. No visual page-builder / drag-drop site assembly beyond dynamic zones as ordered component lists.
NG-04. No full policy-condition engine (only owner-only condition in MVP).
NG-05. No in-house file hosting as primary store; Cloudinary is default, abstraction allows S3/R2/local later.
NG-06. No `create-peggy-app` scaffolding automation as V1 priority; CLI is thin and post-core.
NG-07. No ETL / bulk import-export UI in MVP (API-level export only).
NG-08. No workflow states beyond Draft/Published in MVP (In Review / Scheduled / Archived are data-reserved, not implemented).

## 6. Target Users

| ID | User | Technical level | Primary goal |
|----|------|-----------------|--------------|
| U-01 | Backend / Full-stack developer | High | Define models, integrate API, extend via plugins, self-host |
| U-02 | Content administrator / Editor | Low–med | Create, localize, publish content without code |
| U-03 | Content-type architect (admin-dev) | Med–high | Design schemas, relations, validations, locales |
| U-04 | Frontend consumer (web/mobile) | Med | Fetch published content with predictable REST + tokens |
| U-05 | Plugin developer | High | Extend routes, services, admin UI via public API |
| U-06 | Platform operator | Med | Deploy, configure env, monitor health, manage secrets |

## 7. User Personas

**P-01. Ada — Full-stack developer (U-01).** Runs TypeScript + Next.js storefront. Wants `Post`, `Product`, `Category` modeled in 10 minutes, REST with populate + filtering, TS types for responses, no hand CRUD. Frustrated by auth/permissions copy-paste.

**P-02. Emeka — Content editor (U-02).** Non-technical. Wants clear list/table of Posts, locale switcher (en/fr), preview draft, Publish button with confirmation, media picker with folders. Fear: accidentally publishing a draft.

**P-03. Sofia — Content architect (U-03).** Defines SEO component, Hero, dynamic-zone Page. Needs required/unique/localized flags, relation configuration, validation messages, schema version awareness.

**P-04. Ken — Mobile dev (U-04).** Consumes `/api/v1/products?locale=fr&status=published`. Needs stable pagination, field selection, error envelope, API token scopes, OpenAPI spec.

**P-05. Priya — Plugin author (U-05).** Builds `seo-audit` plugin. Needs manifest, server routes, admin page injection, events subscription, namespaced tables, versioned APIs — never core patching.

## 8. User Journeys

### J-01. Project setup → first content type → first API call (Ada)

1. Ada provisions Peggy API + Admin + Postgres (Docker locally, Neon in preview).
2. Logs in as seeded super-admin, creates `Post` collection: `title (text, required, localized)`, `slug (uid, unique-per-locale, required)`, `body (richtext)`, `cover (media)`, `author (relation → Author)`, enables draft/publish + i18n.
3. Registry validates, versions schema (v1), generates Zod validators.
4. Ada creates English draft via Admin, publishes en; creates French draft (unpublished).
5. `GET /api/v1/posts?locale=en&status=published` returns en published; `?locale=fr` returns 404/empty (fr draft not leaked); `?status=draft` with public token → 403.
6. Ada fetches OpenAPI, generates TS client types.

Acceptance: steps 2–5 complete without code change, restart, or manual migration.

### J-02. Flexible page assembly (Sofia + Emeka)

1. Sofia defines components `Hero`, `RichText`, `ImageBlock`, `CTA`; creates `Page` collection with Dynamic Zone `sections: [Hero, RichText, ImageBlock, CTA]`.
2. Emeka creates `Landing` page, adds Hero → RichText → CTA in order, reorders, localizes CTA label to fr, saves draft.
3. Emeka previews draft (requires `preview` scope), publishes en only.
4. Public API returns ordered `sections` with `__component` discriminator.

### J-03. RBAC + owner-only (Ada + Emeka)

1. Ada defines roles: `SuperAdmin`, `Editor`, `Author`, `Public (API token scope)`.
2. Grants `Author: post.create, post.read, post.update(own), post.publish(own)`; `Editor: post.* + post.publish + post.unpublish`.
3. Emeka (Author) edits own draft, cannot publish another author's post → 403 with `FORBIDDEN` envelope.
4. Audit log records all publish/unpublish with actor, timestamp, locale, version.

### J-04. Media lifecycle

1. Emeka opens Media Library, uploads `hero.jpg` (MIME + size validated), places in folder `/landing`.
2. Admin requests signed upload URL from API; browser uploads direct to Cloudinary; API stores metadata + provider key.
3. Emeka attaches to Post, replaces file (old provider asset dereferenced per policy), deletes unused asset (blocked if referenced unless force + permission).

### J-05. Locale publish + fallback (Ken)

1. Product exists en-published, fr-draft, de-missing.
2. `GET /api/v1/products/:id?locale=fr` with `fallback=en` returns en with `meta.fallback=true, meta.requestedLocale=fr`.
3. Without fallback flag, fr-draft → 404 on public surface; with preview token → returns draft with `meta.status=draft`.

## 9. Core Features (summary)

F-01 Content-Type Builder · F-02 Content Manager · F-03 Auto REST · F-04 RBAC + owner-only · F-05 Media Library (Cloudinary default, abstracted) · F-06 i18n (document-per-locale) · F-07 Draft/Publish per locale · F-08 Better Auth (human) + API tokens (programmatic) · F-09 Plugin system (manifest + lifecycle) · F-10 Events + webhook outbox · F-11 Schema-driven Admin · F-12 Validation (Zod single source) · F-13 Audit logging · F-14 OpenAPI + TS types · F-15 Health/observability baseline.

## 10. Content-Type Builder

The Builder is an admin-only, RBAC-gated (`content-types.manage`) visual schema editor. It writes to the Schema Registry, not to code.

Must support:

- Kinds: `collection`, `single`, `component` (reusable, repeatable/non-repeatable), dynamic zone (ordered component list).
- Field types MVP: `text, richtext, markdown, number, boolean, date, datetime, time, json, email, password (admin users only), uid/slug, enumeration, media (single/multi), relation, component, dynamiczone`.
- Per-field: label, name (snake/camel normalized, reserved-word blocked), required, unique (scoped: global vs per-locale), default value, min/max / length / pattern, localized flag, searchable flag, indexed flag (hint), placeholder/help, validation message override.
- Relations: `oneToOne, oneToMany, manyToOne, manyToMany`, bidirectional configuration, on-delete policy (`cascade | set-null | restrict`), self-relations allowed with explicit inverse.
- Draft/publish toggle per collection/single (default on for collections, off for components).
- i18n toggle per type; per-field `localized` only meaningful when type is localized.
- Single types enforce singleton document per locale (one draft + one published row-set per locale).
- Schema versioning: every mutation creates new schema version; documents record `schema_version`; breaking changes (type change, required-added, unique-added, relation retarget) require explicit confirmation + migration note; destructive deletes require typed confirmation + are soft-blocked if documents exist.
- DDL policy (D1): Builder mutations do NOT run per-edit `ALTER TABLE` in-request. Content payloads live in `document_versions.data JSONB`; queryable projections via GIN + extracted columns (see DB doc). Table-per-type materialization is explicitly deferred post-MVP.

## 11. Content Management (Content Manager)

- List view: server-paginated table derived from schema (columns = scalar fields, configurable), search (searchable fields), filter/sort per Query Engine capabilities, locale switcher, status filter (draft/published/all — `all` requires preview scope).
- Detail view: dynamic form generated from active schema version + Zod errors; relation pickers (paginated), media picker, component/dynamic-zone reorder UI, locale tabs with fallback indicator, version history + restore.
- Single types: single editor per locale, no list, no delete (only clear/unpublish per permission).
- Bulk actions MVP: publish/unpublish/delete with per-item permission check, transactional, audited; failures return per-item results, not silent partial success.
- Autosave draft (debounced) vs explicit Publish; Publish requires `resource.publish` permission distinct from `update`.

## 12. REST API Generation

Every collection/single/component registered generates routes under `/api/v1` (D5). Examples (illustrative, normative spec in §19 + arch doc):

```
GET    /api/v1/posts?locale=en&status=published&page=1&pageSize=25&sort=publishedAt:desc&filters[category.slug][$eq]=news&populate=author,cover&fields=title,slug
GET    /api/v1/posts/:documentId?locale=en
POST   /api/v1/posts
PATCH  /api/v1/posts/:documentId
DELETE /api/v1/posts/:documentId
POST   /api/v1/posts/:documentId/publish
POST   /api/v1/posts/:documentId/unpublish
GET    /api/v1/homepage?locale=fr   (single type, no :id, no list)
```

API must support: filtering (operators `$eq,$ne,$in,$nin,$gt,$gte,$lt,$lte,$contains,$startsWith,$null`), sorting (multi-field, direction), pagination (offset `page/pageSize` + cursor for large lists), field selection (`fields`), populate (`populate` allowlist, depth limit 3, no unbounded recursion), search (`q` over searchable fields), locale (`locale` + `fallback` flag), status (`status=published|draft|all`; `draft|all` gated), validation errors (422 with field paths), consistent error envelope (`{ error: { code, message, details } }`), auth (Bearer session JWT + API token), OpenAPI 3.1 generation from Registry.

API layer must never import Drizzle/DB directly (enforced by lint + arch test).

## 13. Roles & Permissions

Model: `User → Role (many-to-many) → Permission (resource.action + optional condition)`.

Seeded resources MVP: each content type (`create, read, update, delete, publish, unpublish`), plus `content-types.manage, media.manage, media.upload, users.manage, roles.manage, settings.manage, locales.manage, plugins.manage, webhooks.manage, audit.read`.

Evaluation:

- Deny-by-default; explicit allow required.
- Two-tier: coarse check in middleware (`role has resource.action`), row/field scoping in Query Engine + serializer (owner-only: `document.createdBy == auth.user.id`; field redaction for denied fields).
- Conditions MVP: `owner-only` only (D7). Full policy language (`category == X`, `locale == Y`) is data-reserved (`conditions JSONB`) but not evaluated in MVP — request with such condition → deny + `CONDITION_NOT_SUPPORTED` unless owner-only.
- Public API tokens carry scopes mapped to same permission strings with `status=published` ceiling (a public token can never read drafts even if scope says `read`).

Distinguish: authentication (who, Better Auth) vs authorization (may-do, RBAC service) vs resource AuthZ (which rows/fields) vs future policy engine.

## 14. Media Library

- Storage abstraction: `MediaService → StorageProviderInterface → CloudinaryProvider` (MVP). Core never imports Cloudinary SDK.
- Flows: `POST /api/v1/media/sign` (server validates MIME/size/quota, returns signed params) → browser PUT direct to Cloudinary → `POST /api/v1/media` confirms with provider key → metadata row. No file bytes through serverless handler (payload/timeout constraint).
- Metadata: `id, provider, providerKey, url, secureUrl, mime, sizeBytes, width, height, duration?, hash, folderId, alt, caption, uploadedBy, createdAt`.
- Folders: hierarchical (`media_folders` self-FK), move, rename; delete blocked if non-empty unless recursive + permission.
- Validation: allowlist MIME (`image/*`, `video/*` capped, `application/pdf`, `audio/*` — configurable), max size (default 10MB image / 100MB video, env-overridable), magic-byte check on confirm (provider-reported + server HEAD), filename sanitization, SVG blocked by default (XSS) unless sanitized + explicit enable.
- Transforms: responsive variants via Cloudinary URLs (`w,h,q,format`) generated at read time, never stored as separate rows except `derived` cache records; `transformUrl(asset, preset)` is provider method.
- Deletion/replacement: soft-delete row + provider destroy; replace creates new version, updates references per policy (`update-references | keep-both`); referenced assets require `media.manage` + force flag to delete, audited.

## 15. Internationalization

- Model: document-per-locale (D3). Logical `document (stable documentId + contentType)` → per-locale rows (`locale`, `draftVersionId`, `publishedVersionId`). Non-localized fields are copied at creation from default locale but thereafter independent (no live sync in MVP) — fallback at read time covers missing locales.
- Locale management: `code (BCP47, e.g. en, fr, en-GB)`, `name, isDefault (exactly one), isActive, direction (ltr|rtl), fallbackChain (ordered list)`. `locales.manage` gated. Default locale is immutable after initial seed (OQ-06): changing it with existing content requires an explicit migration (data backfill + fallback-chain rewrite + re-validation), never a flag flip.
- Query: `?locale=xx` (default = default locale), `?fallback=true|false` (default true for public, false for admin preview); response includes `meta: { locale, requestedLocale, fallback, fallbackLocale?, status }`.
- Publish per locale (D4): en can be published while fr stays draft; `publishedAt` per locale; unpublish per locale.
- Uniqueness: `unique` fields scoped per-locale by default (`unique_per_locale`); global-unique opt-in (e.g. `slug` global) enforced via extracted unique index on normalized value.
- Relations across locales: relation points at `documentId`, resolution locale follows request locale with fallback; response includes `meta.relationFallback` when target fell back.
- i18n is not a `locale` column on a single row — it is identity (`documents`) + localization (`document_locales`) + versions (`document_versions`) separation (full spec in DB doc).

## 16. Draft & Publish

- States MVP: `draft, published` (columns: `status` per locale pointer, `publishedAt`, `firstPublishedAt`). Reserved: `in_review, scheduled, archived` (enum values accepted in schema but API returns `TRANSITION_NOT_SUPPORTED` in MVP).
- Storage: `document_versions (documentId, locale, version, status, data JSONB, createdBy, createdAt)`; locale pointer `document_locales (draftVersionId, publishedVersionId)`. Publish = transactionally set `publishedVersionId = draftVersionId` (or specified version) + timestamps + audit + event. Unpublish = clear pointer (row retained for history).
- API behavior: public surface defaults `status=published`; `status=draft|all` requires `preview` scope (`resource.readDraft` or `publish` permission); list endpoints never mix statuses without explicit `status=all` + meta per item.
- AuthZ: `publish/unpublish` are distinct permissions from `update`; publishing another user's document requires non-owner grant; all transitions audited + emit events.
- Scheduled publish: data model reserves `scheduledAt, scheduledVersionId`; MVP API accepts and enqueues to outbox; a scheduled AWS Lambda worker (OQ-05) drains due items (returns `202 Accepted, scheduled=true, executesVia=scheduled-lambda-worker`); no in-request timers.
- Accidental exposure prevention: Query Engine injects `publishedVersionId IS NOT NULL` predicate for public scopes; integration test gate: `public token × draft-only fixture → 0 rows` (required CI check).

## 17. Authentication

- Better Auth for human authN (admin users/editors) — spike complete (`docs/00-better-auth-spike.md`). Scope: email+password, sessions (DB-backed, serverless-safe), email verification, password reset, session expiry/rotation. Password hashing: Better Auth built-in scrypt default (Node native, OWASP-accepted); Argon2id via documented custom `hash`/`verify` reserved post-MVP. Session lifetimes: `expiresIn` 7 days, `updateAge` 24h, encrypted cookie cache (5-min JWE) for hot reads. Express mount: `toNodeHandler(auth)` at `/api/auth/*` before `express.json()`. Organization plugin NOT installed (single-project D2); multi-tenant path documented for post-MVP. Residual code-level confirmations C-01…C-05 (Neon-HTTP adapter interop, option shapes, Lambda routing, cookie interop, load assertion) gate build kickoff — see spike §7.
- Separation: AuthN (identity/session) ≠ AuthZ (RBAC) ≠ User Management (CRUD, roles assignment) ≠ API Access (tokens). Four distinct services, four distinct tables.
- API tokens: first-class, independent of Better Auth sessions. `api_tokens (prefix, hash, scopes[], expiresAt, lastUsedAt, createdBy)`. Copy-once secret display, hashed at rest (SHA-256 + pepper), prefix-indexed lookup, revocation, expiry, per-request scope check + published-ceiling.
- Admin auth: session cookie (httpOnly, SameSite=Lax, Secure in prod) + CSRF; API auth: `Authorization: Bearer <token>` (session JWT or API token, distinguished by prefix).
- Plugin auth extensions via `auth.extend()` hook (e.g. SSO) — never by patching session tables.

## 18. Plugin System

Plugins extend without modifying core. Capabilities MVP: routes, controllers (via public `defineController`), services (via `defineService` + DI), middleware registration, content types (namespaced `plugin_<name>__<type>`), admin pages/components/slots, settings schema, navigation entries, hooks/events subscription, DB models (namespaced tables `plugin_<name>_*` with own migrations), API extensions (new `/api/v1/<plugin>` namespaces only).

Lifecycle: `discover (manifest read) → register (validate deps, mount metadata, no I/O) → bootstrap (connect DB, routes, jobs; idempotent) → destroy (graceful teardown)`. Failed bootstrap disables plugin, never crashes core boot (degraded-mode + health `plugin:<name>=failed`).

Boundaries: `definePlugin(manifest)` is the only entry; no imports from `@peggy/core/internal/*`; permissions declared in manifest (`permissions: [...]`) granted explicitly by admin; versioning semver with `peerPeggy` range; migrations versioned per plugin.

## 19. Developer Experience

- TypeScript-first: Registry → Zod schemas → inferred TS types → OpenAPI → admin forms. No duplicated hand types for content shapes.
- Predictable errors, request IDs (`x-request-id`), structured logs, `/health`, `/ready`, OpenAPI + SDK-friendly pagination.
- Local dev: `docker-compose.dev.yml` (Postgres + API + Admin + seed), hot reload, seed script (roles, locales en/fr, demo Post/Author), `pnpm nx affected` for builds/tests.
- Docs: this PRD + arch + DB model + ADRs are required reading; OpenAPI served at `/api/v1/openapi.json`.

## 20. CLI / Scaffolding (post-core)

MVP CLI is thin: `peggy --help, peggy doctor (env check), peggy migrate (system migrations), peggy seed`. Full `create-peggy-app`, `generate content-type|plugin`, `import/export` are post-MVP and must wrap stable core APIs, never generate source-of-truth code (registry remains truth). CLI package scaffold exists in Nx but commands beyond thin slice return `NOT_IMPLEMENTED` with pointer to API alternative.

## 21. Functional Requirements (normative, testable)

**Content-Type Builder**

- FR-001. Admin with `content-types.manage` can create a collection type with 1+ fields; system returns `201` with `schemaVersion`; type appears in Admin nav within 5s (poll/cache-invalidate) without restart.
- FR-002. System rejects field names that are reserved (`id, createdAt, __component`, etc.) with `422 FIELD_NAME_RESERVED`.
- FR-003. System supports kinds `collection, single, component`; creating `single` twice for same name returns `409 SINGLETON_EXISTS`.
- FR-004. Admin can configure relation `Post.author → Author` with `manyToOne` + inverse `oneToMany`; API populate resolves both directions; delete with `restrict` and existing references returns `409 RELATION_RESTRICTED`.
- FR-005. Admin can define component `SEO` and dynamic zone `Page.sections ∈ {Hero, RichText, CTA}`; document with 3 ordered blocks persists order; API returns blocks in order with `__component` discriminator.
- FR-006. Setting `required:true` on field causes `POST` without it → `422 VALIDATION_FAILED` with `details[{ path, message }]`.
- FR-007. Setting `unique_per_locale:true` on `slug` allows same slug in en and fr but rejects duplicate within en with `409 UNIQUE_VIOLATION (locale=en)`.
- FR-008. Schema mutation bumps `schemaVersion`; existing documents retain `schemaVersion`; reads validate leniently (unknown fields preserved, missing new-required allowed on old versions until re-save, flagged `meta.schemaStale=true`).
- FR-009. Deleting a content type with existing documents requires `?force=true` + typed confirmation token; without it → `409 TYPE_HAS_DOCUMENTS`.

**Documents / Query Engine**

- FR-010. `POST /api/v1/posts` without `status` creates draft (`status=draft`), invisible to public token.
- FR-011. Filtering `?filters[price][$gte]=10&filters[status][$eq]=published` + sorting `?sort=price:asc,publishedAt:desc` + pagination `?page=2&pageSize=25` returns correct slice with `meta:{ page, pageSize, total, pageCount }`.
- FR-012. `?populate=author,cover` resolves to depth ≤3; `populate=*` rejected with `400 POPULATE_DEPTH_EXCEEDED` when exceeding limit; circular relations terminate with `meta.truncated=true`.
- FR-013. `?fields=title,slug` returns only those + `id, documentId, locale, status`; disallowed field → ignored + `meta.ignoredFields`.
- FR-014. `?q=shoes` searches only `searchable:true` fields, ranked, paginated; non-searchable match returns 0 rows.
- FR-015. Bulk `POST /api/v1/posts/bulk-publish { ids: [...] }` publishes allowed subset transactionally per item, returns `{ succeeded[], failed[{ id, code }] }`, audits each.

**Draft / Publish / i18n**

- FR-016. `POST /:id/publish { locale: fr }` with `post.publish` sets fr published pointer, `publishedAt`, emits `document.published`, auditable; publishing already-published version is idempotent `200` with `meta.alreadyPublished=true`.
- FR-017. Public token `GET /api/v1/posts?status=draft` → `403 DRAFT_ACCESS_DENIED`; `?status=all` same.
- FR-018. `GET /:id?locale=de&fallback=true` with de missing returns en with `meta.fallback=true`; with `fallback=false` → `404 LOCALE_NOT_FOUND`.
- FR-019. Per-locale publish independence: publishing en does not change fr status; verified by `GET ?locale=fr&status=published → 404` while en returns 200.

**Auth / RBAC**

- FR-020. Unauthenticated `POST /api/v1/posts` → `401 UNAUTHENTICATED`.
- FR-021. User without `post.create` → `403 FORBIDDEN (post.create required)`.
- FR-022. Author with `post.update(own)` editing another's post → `403 OWNER_ONLY`; editor with full `post.update` succeeds.
- FR-023. API token with scopes `[post.read]` calling `POST` → `403 SCOPE_INSUFFICIENT`; expired token → `401 TOKEN_EXPIRED`; revoked → `401 TOKEN_REVOKED`.
- FR-024. Passwords hashed with Better Auth built-in scrypt default (spike-verified; Argon2id upgrade path reserved post-MVP; never plaintext/MD5/SHA1-only); login rate-limited per deployment target (OQ-03 defaults; Lambda baseline 5/min/IP + account lockout backoff); residual code confirmations C-01…C-05 gate kickoff.

**Media**

- FR-025. Upload flow via signed URL completes without file bytes through API handler; direct POST of 20MB file to API → `413 PAYLOAD_TOO_LARGE` with pointer to signed flow.
- FR-026. Upload of `.exe` or `image/svg+xml` (default) → `422 MIME_NOT_ALLOWED`; oversize → `422 FILE_TOO_LARGE (limit, received)`.
- FR-027. Deleting media referenced by published document without `?force=true` → `409 MEDIA_REFERENCED { references[] }`.
- FR-028. `transformUrl(asset, { w:800, format:webp })` returns valid Cloudinary URL without new DB row; MVP preset list (`thumb, card, hero, original`; `f_auto,q_auto` defaults) is provisional — exact presets finalized after verifying the selected Cloudinary plan's transformation limits during implementation (OQ-02).

**Events / Webhooks / Audit**

- FR-029. Creating/publishing/deleting document emits `document.created/updated/published/unpublished/deleted` on internal bus within same transaction commit (outbox pattern); plugin subscriber receives with `eventId, timestamp, actor, locale, documentId`.
- FR-030. Webhook `POST` subscription to `document.published` delivers signed (`X-Peggy-Signature` HMAC-SHA256, timestamp tolerance 5min) `POST` with `eventId` idempotency key; failure retries with exponential backoff (3 attempts MVP) and writes `webhook_deliveries` log; delivery is async via scheduled AWS Lambda worker polling the outbox/`webhook_deliveries` (OQ-05; Inngest deferred unless volume/complexity justifies it), with manual replay endpoint; delivery never blocks publish response.
- FR-031. Every publish/unpublish/role-change writes `audit_logs` with `actor, action, resource, resourceId, locale?, diff?, ip?, requestId`; `GET /api/v1/audit-logs` requires `audit.read`. Retention: 12-month window (OQ-04); payloads redact secrets, auth credentials, tokens, passwords, and unnecessary PII; retention period is config-driven (changeable without schema redesign).

**Admin**

- FR-032. Admin renders Post editor purely from `GET /api/v1/content-types/post` schema (no hardcoded Post form); adding a field in Builder appears in editor after cache invalidate without admin redeploy.
- FR-033. Admin list, filters, locale tabs, publish buttons respect same RBAC as API (hidden/disabled when denied, server still enforces).

**System**

- FR-034. `GET /health` returns `200 { status: ok, version }` without auth; `GET /ready` checks DB + registry load.
- FR-035. Every response includes `x-request-id`; errors conform to `{ error: { code, message, details?, requestId } }`; `5xx` never leaks stack in prod.

## 22. Non-Functional Requirements

- NFR-001. API latency (p95, warmed, local Neon branch, 1KB doc): list (25 items, 1 populate) ≤350ms; single get ≤200ms; write (validation + transaction + audit) ≤500ms. Measured without cold start; cold-start budget documented separately (≤2.5s p95 on scale-from-zero).
- NFR-002. Pagination hard cap `pageSize ≤100`, populate depth ≤3, `filters` keys ≤20, `q` length ≤200 — exceeding returns 400, never OOM.
- NFR-003. Query efficiency: list queries ≤ `1 + #populates` SQL statements (no N+1 per row); GIN-indexed JSONB search; `EXPLAIN` gate on seed dataset in CI.
- NFR-004. Scale targets MVP: 500 content types, 500k documents, 100 rps sustained on single serverless concurrency unit (documented, not load-certified); plugin count ≤20 without boot degradation >2s.
- NFR-005. Reliability: writes transactional (document + versions + relations + audit commit atomically); failed publish leaves pointers unchanged; webhook delivery at-least-once with idempotency keys.
- NFR-006. Maintainability: domain has zero imports of express/drizzle/next/cloudinary/better-auth; `nx enforce-module-boundaries` + arch test in CI; circular deps = build failure.
- NFR-007. Testability: Query Engine + permission evaluation + publish transitions have unit tests ≥80% branch on those modules; public/draft-leak + owner-only + fallback tests are required CI gates.
- NFR-008. Observability MVP: structured JSON logs, request IDs, health/ready, audit logs, webhook delivery logs; metrics/APM deferred but log shape reserves `traceId, spanId`.
- NFR-009. Admin responsiveness: schema load ≤1s (cached), list render ≤2s @25 rows, form interaction <100ms client-side (no per-keystroke API).
- NFR-010. Security baseline: §23 requirements all satisfied; `npm audit` high-severity = build fail; secrets never in logs/errors.

## 23. Security Requirements

SR-01 deny-by-default RBAC; SR-02 Better Auth sessions httpOnly/Secure/SameSite + rotation + expiry (`expiresIn` 7d, `updateAge` 24h, 5-min JWE cookie cache); SR-03 API tokens hashed at rest, prefix-indexed, expirable, revocable, least-scope; SR-04 Zod validation on all inputs, output serialization (no internal columns leaked); SR-05 parameterized queries only (Drizzle, no raw string interpolation); SR-06 XSS: richtext sanitized on render contract, filename/alt escaped, SVG blocked default; SR-07 CSRF tokens on cookie-session mutations; SR-08 CORS allowlist per env, no `*` with credentials; SR-09 rate limits (auth 5/min, public API 100/min/IP default, publish 30/min/user); SR-10 password hashing via Better Auth scrypt default (spike-verified; Argon2id path reserved) + reset tokens single-use/expiring; SR-11 upload MIME allowlist + size caps + provider-reported type cross-check; SR-12 SSRF: webhook URLs validated (no localhost/metadata IPs in prod), fetch timeouts + size caps; SR-13 secrets via env/secret-manager, never committed, redacted in logs; SR-14 webhook HMAC-SHA256 signing + timestamp tolerance + idempotency; SR-15 audit logging for publish, role, token, settings changes (append-only, no user delete); 12-month retention; redaction of secrets/credentials/tokens/passwords/unnecessary PII at write time; retention period config-driven (no schema change to adjust).

## 24. MVP Scope (must ship)

1. Builder (F-01) + Registry + versioning + Zod gen. 2. Documents + Query Engine (filter/sort/page/populate/search/locale/status). 3. REST `/api/v1` + OpenAPI + error envelope. 4. RBAC + owner-only + API tokens. 5. Media signed-upload + Cloudinary + folders. 6. i18n document-per-locale + fallback + per-locale publish. 7. Draft/publish + audit + events. 8. Admin (dashboard, manager, builder, media, users/roles, locales, settings stub). 9. Webhook outbox + minimal async delivery + logs. 10. Health/ready, logging, Docker dev, Neon prod wiring, seed.

## 25. Post-MVP Scope (explicitly deferred)

GraphQL plugin, multi-project tenancy, workflow states (review/scheduled/archived UI), full policy engine, bulk import/export UI, SaaS billing, edge rendering, table-per-type materialization, APM/metrics suites, `create-peggy-app` full scaffolding, S3/R2/local providers (interface ready, providers later), scheduled-publish execution via the same scheduled Lambda worker (outbox ready).

MVP-vs-post table:

| Capability | MVP | Post-MVP |
|---|---|---|
| Content payload store | JSONB + GIN + extracted cols | Materialized per-type tables/views |
| Permissions conditions | owner-only | Policy language (category/locale/role-composition) |
| Publish scheduling | Accept + outbox enqueue (202) | Dedicated worker + cron UI |
| Webhooks | Scheduled Lambda worker, async, 3 retries, logs, manual replay | Inngest (if justified), backoff config, replay UI, per-endpoint concurrency |
| CLI | doctor/migrate/seed | create/generate/import/export |
| Media providers | Cloudinary (presets finalized post plan-limit check) | S3, R2, local |
| Audit retention | 12 months, redacted, config-driven | Longer windows, cold-archive offload |

## 26. Success Metrics

- TTFHW (time to first hello-world API): clone → `docker compose up` → model Post → `GET /api/v1/posts` <15 min (measured in usability test, n≥5 devs).
- Leak rate: 0 draft-leak incidents in CI + pen-test fixture suite.
- Schema-to-API lead time: Builder save → API live <5s p95.
- Permission correctness: 100% of FR-020…023 + owner-only matrix pass in CI.
- Admin schema-fidelity: 0 hardcoded content forms (lint: no `PostForm`, `ProductForm` components).
- API predictability: OpenAPI validates 100% of MVP routes; TS client compiles without `any` for content shapes.
- Operability: cold start p95 ≤2.5s, health uptime fixture 99.9% in staging week.

## 27. Risks

R-01 Dynamic-schema trap (DDL-per-edit) → mitigated by D1 JSONB-first.
R-02 Draft-leak via mis-scoped query → mitigated by Query Engine predicate injection + CI gate.
R-03 Better Auth integration risk → spike complete; residual C-01…C-05 code confirmations gate kickoff; AuthPort isolation retained; fallback custom sessions without domain change.
R-04 Serverless timeouts on uploads/webhooks → signed direct uploads + async outbox; never in-request fan-out.
R-05 Plugin breakage → public API only, semver, degraded boot.
R-06 Admin complexity (dynamic forms × i18n × zones) → shared schema renderer, builder/manager same client.
R-07 Neon scale-to-zero latency → documented budget, warmed preview for demo, local PG for tests.

## 28. Assumptions (D1–D10 locked)

D1 JSONB-first (`document_versions.data`), GIN + extracted columns; no per-type DDL in MVP. D2 single-project-per-deploy. D3 document-per-locale. D4 publish per locale. D5 `/api/v1` prefix from day one. D6 REST-first, GraphQL as future plugin. D7 owner-only as sole MVP condition. D8 local Postgres (Docker) for dev/test, Neon for preview/prod. D9 Better Auth for human authN — spike complete (scrypt default; session schema + Express/Lambda/multi-tenant findings in `docs/00-better-auth-spike.md`); C-01…C-05 confirmations gate kickoff. D10 Nx monorepo with tags + boundary lint.

## 29. Open Questions — RESOLVED (v0.2.0)

OQ-01. RESOLVED — Better Auth spike complete (`docs/00-better-auth-spike.md`): scrypt default hashing; `user/session/account/verification` tables via `@better-auth/drizzle-adapter` (`provider: "pg"`); `expiresIn` 7d / `updateAge` 24h / 5-min JWE cookie cache; `toNodeHandler(auth)` Express mount; Lambda pattern attested; organization plugin deferred per D2. Residual C-01…C-05 code confirmations gate build kickoff.
OQ-02. RESOLVED — Use Cloudinary responsive transformations for MVP with provisional presets (`thumb, card, hero, original`; `f_auto,q_auto`); finalize exact preset list after verifying selected plan limits during implementation (FR-028).
OQ-03. RESOLVED — Per-target rate limits, independently configurable (SR-09 baselines: Lambda 5/100/30, Vercel 10/200/30, Fly.io 5/150/30 per min for auth/public/publish); counters in Postgres, never process memory.
OQ-04. RESOLVED — 12-month audit retention; redact secrets/credentials/tokens/passwords/unnecessary PII at write; retention period config-driven, no schema redesign to change (FR-031, SR-15).
OQ-05. RESOLVED — Scheduled AWS Lambda MVP webhook worker (async + retry + manual replay); Inngest deferred unless volume/complexity justifies it (FR-030).
OQ-06. RESOLVED — Default locale immutable after seed; post-data change requires explicit migration, never a flag flip (§15, DB doc §15).

---
*End of PRD v0.2.0. Normative requirements are §21–§23. All IDs stable across revisions.*
