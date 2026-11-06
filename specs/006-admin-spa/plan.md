# Implementation Plan: Schema-Driven Admin SPA (Slice 6)

**Branch**: `006-admin-spa` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-admin-spa/spec.md`

## Summary

Build the Peggy admin SPA as a **pure API consumer** in `apps/admin` (Next.js 15 static export, React 19): session-cookie auth with RBAC-gated nav, schema-driven content list/table + create/edit forms generated at runtime from the registry API (`GET /api/v1/content-types[/:id]` + fields), locale switcher with per-locale publish/unpublish, a media library UI plus picker over the signed-upload flow, and read-only content-type views. No per-type components (P-06/P-07); no server imports (P-04). All data loads client-side after mount to stay compatible with `output: 'export'`.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 22 LTS, pnpm 9 (repo-locked)

**Primary Dependencies**: Next.js 15.1 (`output: 'export'`, `trailingSlash: true`, `images.unoptimized`), React 19, `better-auth` client lib (new — for `signIn.email`/`signOut`/`useSession` against `/api/auth/*`; cookie session, `credentials: 'include'` on all API fetch). No UI kit in repo — admin uses hand-rolled components + CSS (keeps static bundle lean; no new design-system dependency in this slice).

**Storage**: N/A — admin persists nothing. Ephemeral client state only (React state + URL search params for selected type/document/locale/folder so views are deep-linkable under static export). Session lives in the `HttpOnly` cookie owned by the API.

**Testing**: `vitest` + React Testing Library + `jsdom` as new `apps/admin` devDependencies (mirrors `packages/*` vitest setup); contract tests for the typed API client against recorded API fixtures; `fetch` mocked at the client boundary. E2E deferred — no Playwright in repo; quickstart validation is manual against a live API (see `quickstart.md`).

**Target Platform**: Static files on AWS Amplify Hosting with SPA-fallback rewrites; evergreen browsers. API base URL via `NEXT_PUBLIC_API_URL`; auth cookie domain via API config (`.parent`) — admin never hardcodes environments.

**Project Type**: Web SPA — frontend-only slice inside the existing pnpm/nx monorepo (`apps/admin`).

**Performance Goals**: Static CDN shell (instant TTFB); interactive after client fetch (<2s on broadband for list views); media grid pages at `pageSize ≤ 100` per API clamp; thumbnails via provider `transformUrl` presets (thumb/card) with unoptimized `<img>`.

**Constraints**: `output: 'export'` ⇒ no SSR/RSC data fetching — every data view is a client component fetching after mount with loading/error/empty states; no dynamic route segments (use search params: `/documents?contentType=…&id=…&locale=…`) so export never needs prerendered params; `trailingSlash: true` ⇒ use `<Link>`/trailing-slash-safe relative navigation.

**Scale/Scope**: Editorial-team scale (tens of users, hundreds–low-thousands of documents/assets per project). Documents list has **no server pagination** (verified: `listDocuments` returns full array) ⇒ client-side pagination in admin; acceptable at this scale, flagged as follow-up API work.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P-04 — Admin is a pure API consumer.** Admin bundle MUST NOT import `@peggy/db`, `@peggy/auth`, `@peggy/storage`, `@peggy/http`, `serverless-http`, Express, or any server-only module. Allowed: runtime `fetch` to `NEXT_PUBLIC_API_URL` + the `better-auth` *client* library only. Enforcement: eslint import ban + nx/arch check on `apps/admin` (task in implementation); build fails on violation.
- [x] **P-06/P-07 — Schema-driven, no per-type UI.** List columns, form widgets, validation markers, and type read-views all render from registry payloads at runtime. No `Post*`/`<TypeName>Form`-style components; CI grep for per-type component names (arch rule P-07) must stay green.
- [x] **Auth boundary.** Humans authenticate via Better Auth session cookie; permission strings are `resource.action` (`document.publish`, `media.manage`, …); super-admin bypass is server-side. Admin hides/disables controls based on its permission set but **never enforces** — every mutation path still handles 401/403 from the server (redirect-to-login on 401, forbidden notice on 403).
- [x] **No data-layer changes.** This slice adds zero tables, zero migrations, zero registry mutations. Content-type *mutation* UI is explicitly out of scope.
- [x] **Security baseline.** Generic login-failure message; no token storage in JS (HttpOnly cookie); `credentials: 'include'` + CSRF handling per API contract (verify CSRF requirement in research — Better Auth uses same-origin + secure cookies; confirm whether admin needs an explicit CSRF header on mutations); audit-relevant actions (publish/unpublish/force-delete) show confirmation + result with `requestId` where the envelope provides one.

**Post-design re-check**: design below introduces no new violations. One residual risk is carried, not a violation: two spec↔API contract gaps found during grounding (documents list has no `page`/`pageSize`; validation errors arrive as string `error`, not the `{ error: { details[{path,message}] } }` envelope the spec assumes) — both resolved as client-side adaptations in `research.md` (R-05, R-06), no API or constitution change required. A genuinely missing API surface (`GET` caller's permission set for nav gating) is resolved via a **no-new-endpoint** strategy (R-04).

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-spa/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── admin-api-client.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # root layout + AuthProvider + nav shell
│   │   ├── page.tsx              # dashboard/home (redirects to /content or login)
│   │   ├── login/page.tsx        # email+password form (client component)
│   │   ├── content/page.tsx      # type list + document table (search params)
│   │   ├── media/page.tsx        # library: folders + grid + upload (search params)
│   │   └── content-types/page.tsx# registry read views (search params)
│   ├── components/
│   │   ├── SchemaTable.tsx       # generic table from fields[] + rows[]
│   │   ├── SchemaForm.tsx        # generic form from fields[] (all widget types)
│   │   ├── FieldWidget.tsx       # per-fieldType input (text/number/bool/date/enum/relation/media/component/dynamic-zone)
│   │   ├── LocaleSwitcher.tsx    # locale list + missing-translation state
│   │   ├── PublishControls.tsx   # publish/unpublish w/ confirmation + per-locale status
│   │   ├── MediaPicker.tsx       # modal: folders + grid + search + select
│   │   ├── UploadDropzone.tsx    # sign → PUT → confirm state machine + progress
│   │   ├── ErrorState.tsx        # error envelope renderer + retry + requestId
│   │   └── Nav.tsx               # permission-gated navigation
│   ├── lib/
│   │   ├── api-client.ts         # typed fetch wrapper (base URL, credentials, envelope errors)
│   │   ├── auth.tsx              # session context, useSession, permission helpers, route guard
│   │   └── types.ts              # admin-side view-model types (mirror of data-model.md)
│   └── hooks/
│       └── useRegistry.ts        # cached content-types/components/locales loading
└── tests/
    ├── lib/api-client.test.ts
    ├── components/SchemaForm.test.tsx
    └── components/SchemaTable.test.tsx
```

**Structure Decision**: Single-project frontend slice — all new code lives under existing `apps/admin/src` (plus `apps/admin/tests` for vitest, mirroring `packages/*` conventions). No new workspace package: the typed API client is admin-local (`lib/api-client.ts`) because the checked-in OpenAPI (`apps/api/src/openapi.ts`) is stub-level summaries only and cannot generate a client yet; extracting a shared client package is a follow-up once the OpenAPI snapshot covers real schemas (constitution VII). No changes to `apps/api` source are planned (R-04 strategy); if `/speckit-tasks` discovers otherwise, it must come back through a spec amendment.

## Complexity Tracking

> No constitution violations — table intentionally empty.
