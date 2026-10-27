# Feature Specification: Platform Foundation (Slice 0)

**Feature Branch**: `001-platform-foundation`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Slice 0 — Platform Foundation. The foundational layer that all other slices depend on: config, database client port + adapters, logger, error model, health/ready endpoints, Express app factory, Lambda handler, and local dev server. No feature code."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer boots the platform locally (Priority: P1)

A developer clones the repo, runs `docker compose up`, `npm install`, and `npm run dev`, and has a running API with health checks responding within minutes.

**Why this priority**: Nothing else can be built or tested without a bootable, observable platform. Every subsequent slice depends on this.

**Independent Test**: Clone fresh, follow README quick-start, verify `/health` returns 200 and `/ready` returns 200 with DB connectivity.

**Acceptance Scenarios**:

1. **Given** a fresh clone with Docker running, **When** developer runs `npm install && npm run dev`, **Then** the API starts on port 3000 and `/health` returns `{ status: "ok" }`.
2. **Given** the API is running, **When** developer calls `/ready`, **Then** response includes DB connectivity status (adapter type + latency).
3. **Given** invalid or missing env vars, **When** developer runs `npm run doctor`, **Then** actionable errors are printed and exit code is 1.

---

### User Story 2 - Operator deploys to Lambda (Priority: P2)

An operator deploys the API artifact to AWS Lambda via Serverless Framework and the handler responds to API Gateway events.

**Why this priority**: Validates the serverless deployment target; de-risks all future slices.

**Independent Test**: Deploy minimal handler to Lambda, invoke via API Gateway, verify `/health` returns 200.

**Acceptance Scenarios**:

1. **Given** the Lambda handler is deployed, **When** API Gateway routes a request to `/health`, **Then** response is 200 with `{ status: "ok" }`.
2. **Given** `AWS_LAMBDA_FUNCTION_NAME` is set, **When** the handler processes a request, **Then** `setResponse` completes without hanging (verified in spike C-03).

---

### User Story 3 - CI validates the platform (Priority: P3)

CI runs lint, typecheck, build, and smoke tests on every PR.

**Why this priority**: Establishes quality gates before feature code is written.

**Independent Test**: Open a PR; all CI jobs pass.

**Acceptance Scenarios**:

1. **Given** a PR is opened, **When** CI runs, **Then** lint, typecheck, and build jobs pass.
2. **Given** the integration job runs, **When** Postgres service container starts, **Then** the API boots and `/ready` returns 200.

---

### Edge Cases

- What happens when `DATABASE_URL` points to an unreachable host? `/ready` returns 503 with `db: false`.
- How does the system handle missing `BETTER_AUTH_SECRET`? `doctor` fails with actionable error; app fails to start.
- What happens when `CORS_ORIGINS` is empty? No origin is allowlisted; admin cannot call the API.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load and validate all environment variables via Zod schema at startup (`@peggy/config`).
- **FR-002**: System MUST provide a `peggy doctor` CLI that validates env, prints a redacted summary, and exits 0/1.
- **FR-003**: System MUST expose a `DbClient` port interface with `NeonHttpAdapter` (fetch-based, serverless) and `PgPoolAdapter` (long-lived, dev/worker).
- **FR-004**: System MUST select the adapter by environment (Neon URL → HTTP adapter; local URL → pool adapter).
- **FR-005**: System MUST provide a structured JSON logger with `requestId`/`traceId`/`spanId` reservation and secret masking.
- **FR-006**: System MUST provide typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, etc.) with HTTP status mapping.
- **FR-007**: System MUST expose `/health` (liveness, always 200) and `/ready` (DB connectivity + registry + plugins, 503 on failure).
- **FR-008**: System MUST provide `createApp()` factory with CORS allowlist, Better Auth mount point (before `express.json()`), and global error handler.
- **FR-009**: System MUST export a Lambda handler via `serverless-http(createApp(), { binary: false })` in `apps/api/src/lambda.ts`.
- **FR-010**: System MUST provide a local dev server via `apps/api/src/server.ts` using the same `createApp()`.
- **FR-011**: System MUST build all packages (`shared`, `config`, `db`, `http`, `api`) with `tsc -b` with zero errors.
- **FR-012**: System MUST NOT contain any domain logic, auth, content tables, or media code. Pure platform only.

### Key Entities

- **Config**: Zod-parsed environment configuration (all canonical vars from deployment guide §4).
- **DbClient**: Port interface for database access (adapter-agnostic).
- **Logger**: Structured JSON logger with context propagation.
- **PeggyError**: Base error class with code, message, and HTTP status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can clone, install, and boot the API locally in under 5 minutes following README.
- **SC-002**: `/health` returns 200 with `{ status: "ok" }` in under 100ms.
- **SC-003**: `/ready` returns 200 with DB connectivity check in under 500ms.
- **SC-004**: `peggy doctor` validates all required env vars and exits 0 on valid config.
- **SC-005**: All packages build with zero TypeScript errors.
- **SC-006**: Lambda handler responds to synthetic API Gateway events (verified with `AWS_LAMBDA_FUNCTION_NAME` set).
- **SC-007**: CI pipeline runs green on a clean PR.

## Assumptions

- Node.js 22 LTS and pnpm 9 are available in the development environment.
- Docker is available for local Postgres.
- Neon account is available for preview/prod (not required for local dev).
- AWS account with Lambda + API Gateway is available for deployment (not required for local dev).
- No feature code (auth, content, media) is included in this slice — those are separate slices.
- The `@peggy/db` package provides only the client port and adapters; schema tables are added in Slice 1+.
