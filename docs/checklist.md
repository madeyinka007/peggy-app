# Pre-Speckit Prerequisite Checklist

## Phase A — Monorepo skeleton
- [x] Directory layout (apps/*, packages/*, ci/)
- [x] Root tooling (pnpm workspace, nx, tsconfig base, eslint, prettier)
- [x] Package manifests + tsconfigs
- [x] .env.example (canonical env reference)
- [x] docker-compose.dev.yml (postgres:16)
- [x] CI sample workflows (ci/ci.yml, ci/deploy.yml, ci/amplify.yml)
- [x] README + checklist

## Phase B — Spike (C-01…C-05) ✅ COMPLETE
- [x] C-01 Better Auth + Drizzle adapter boot + sign-up/sign-in/session-read on local PG (baseline text IDs + UUID interop both pass)
- [x] C-02 Option shapes (`emailAndPassword.password.{hash,verify}`, `additionalFields`) compile; version pinned; ADR-008 written
- [x] C-03 toNodeHandler works under serverless-http (Lambda env vars required for setResponse drain logic)
- [x] C-04 cookieCache JWE works (`better-auth.session_data` JWE cookie, Max-Age=300, HttpOnly, SameSite=Lax)
- [x] C-05 Load assertion: 317 req/s, p50 140ms, p99 304ms, 0 errors, all 2xx

### Spike artifacts
- Harness: `spikes/auth-spike/` (throwaway; fold verified wiring into `packages/db` + `packages/auth`)
- Generated schema: `spikes/auth-spike/auth-schema.ts` (Better Auth CLI output, source of truth)
- UUID variant: `spikes/auth-spike/src/db/schema-uuid.ts`
- ADR: `docs/adr/ADR-008-better-auth.md`

## Phase C — CI skeleton ✅ COMPLETE
- [x] Workflows promoted to `.github/workflows/` (ci.yml, deploy.yml) + ci/amplify.yml sample
- [x] Jobs defined: setup, lint-typecheck-boundaries, unit, integration, contract, audit (ci.yml); migrate, deploy-api, deploy-admin (deploy.yml)
- [x] Concurrency groups + GitHub Environments documented (preview/production reviewers, OIDC) in deployment guide §9
- [ ] GitHub Environments + OIDC role assumption (infra, to be configured at first deploy)

## Phase D — Doctor + config + observability stubs ✅ COMPLETE
- [x] @peggy/config — Zod env schema (all canonical vars) + `peggy doctor` CLI with redaction + validation
- [x] @peggy/shared — structured JSON logger (requestId/traceId/spanId, secret masking) + typed error classes
- [x] /health + /ready endpoints in createApp (ready supports pluggable readyCheck)
- [x] @peggy/http — createApp factory (CORS allowlist, Better Auth mount before express.json, error handler), types
- [x] apps/api lambda.ts (serverless-http handler) + server.ts (local listen)
- [x] Typecheck passes for shared, config, http, api

## Slice 0 — Platform Foundation (speckit)
- [x] Spec: `specs/001-platform-foundation/spec.md`
- [x] Plan: `specs/001-platform-foundation/plan.md`
- [x] Research: `specs/001-platform-foundation/research.md`
- [x] Data model: `specs/001-platform-foundation/data-model.md`
- [x] Contracts: `specs/001-platform-foundation/contracts/health.md`
- [x] Quickstart: `specs/001-platform-foundation/quickstart.md`
- [x] @peggy/db — DbClient port + NeonHttpAdapter + PgPoolAdapter + factory
- [x] apps/api — wired DbClient into lambda.ts + server.ts readyCheck
- [x] apps/admin — Next.js static export skeleton
- [x] /health returns 200 { status: "ok" }
- [x] /ready returns 200 { status: "ready", db: true }
- [x] All packages typecheck with zero errors
