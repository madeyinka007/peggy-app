# Implementation Plan: Platform Foundation (Slice 0)

**Branch**: `001-platform-foundation` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-platform-foundation/spec.md`

## Summary

Slice 0 delivers the platform foundation: config, database client port + adapters, logger, error model, health/ready endpoints, Express app factory, Lambda handler, and local dev server. Phases A–D already implemented config, shared, http, and api scaffolding. The remaining work is: `@peggy/db` DbClient port + NeonHttpAdapter + PgPoolAdapter, the `apps/admin` Next.js skeleton, and verification of all acceptance criteria.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js 22 LTS
**Primary Dependencies**: Express 4, serverless-http 3, Drizzle ORM 0.45, @neondatabase/serverless 0.10, pg 8, Zod 4, better-auth 1.7
**Storage**: PostgreSQL 16 (local Docker in dev, Neon in preview/prod)
**Testing**: Vitest (unit), integration tests against Postgres service container
**Target Platform**: AWS Lambda (API), AWS Amplify (admin SPA), local dev via Docker
**Project Type**: Monorepo (pnpm workspaces + Nx) — `apps/*` + `packages/*`
**Performance Goals**: `/health` < 100ms, `/ready` < 500ms, 100+ req/s session throughput
**Constraints**: Lambda 29s timeout, 1024MB memory, cold-start p95 ≤ 2.5s, no VPC
**Scale/Scope**: Single deploy = single project (D2). Platform only — no domain logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P-01 API never touches DB**: Controllers take services via DI; `createApp` accepts a `readyCheck` callback, not a direct DB handle. DbClient is injected.
- [x] **P-02 Domain never imports infra**: `@peggy/db` provides only port interface + adapters; no domain logic in this slice.
- [x] **P-03 Core never imports Cloudinary SDK**: No media code in Slice 0.
- [x] **P-04 Core never imports Next.js**: Admin is a separate app; no shared runtime code.
- [x] **DB-01/DB-02/DB-03**: No schema tables in this slice; no DDL; no polymorphic FKs.
- [x] **Auth Port**: No auth implementation in this slice; `createApp` accepts optional `auth` (none wired yet).
- [x] **D2 Single-project**: No tenant concept; one DB per deploy.
- [x] **Security baseline**: CORS allowlist, no wildcard with credentials, secret redaction in doctor.
- [x] **Quality gates**: Typecheck passes for all packages; CI wired.

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no domain entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (health/ready endpoint contracts)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/
├── shared/src/          # logger, errors (DONE)
├── config/src/          # env schema, doctor (DONE)
├── db/src/              # DbClient port + adapters (REMAINING)
│   ├── index.ts
│   ├── client.ts        # DbClient interface
│   ├── neon-http.ts     # NeonHttpAdapter
│   ├── pg-pool.ts       # PgPoolAdapter
│   └── factory.ts       # createDbClient(env)
├── http/src/            # createApp factory (DONE)
│   ├── app.ts
│   ├── types.ts
│   └── index.ts
└── (auth, domain, storage — Slice 1+)

apps/
├── api/src/             # lambda.ts, server.ts (DONE)
├── admin/               # Next.js skeleton (REMAINING)
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── src/app/
│       ├── layout.tsx
│       └── page.tsx
└── (api — done)

infra/
├── docker-compose.dev.yml (DONE)
└── ci/ (DONE)
```

**Structure Decision**: Monorepo with `apps/*` + `packages/*`. Platform packages (`shared`, `config`, `db`, `http`) are consumed by `apps/api`. `apps/admin` is a standalone Next.js static export with no shared runtime code (P-04).

## Complexity Tracking

> No violations. Table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | | |

