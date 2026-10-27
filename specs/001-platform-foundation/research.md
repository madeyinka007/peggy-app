# Research: Platform Foundation (Slice 0)

## R-001: DbClient port design

**Decision**: Define a `DbClient` interface in `@peggy/db` with two implementations: `NeonHttpAdapter` (using `@neondatabase/serverless` + Drizzle) and `PgPoolAdapter` (using `pg` Pool + Drizzle). Factory function `createDbClient(env)` selects adapter based on `DATABASE_URL` hostname (neon.tech → HTTP, else → pool).

**Rationale**: Constitution DB-01 requires adapter-agnostic access; deployment guide §5 specifies Neon HTTP for prod and pooled PG for dev. The port pattern keeps domain code adapter-agnostic.

**Alternatives considered**: Single adapter with runtime detection (rejected — violates P-01 by coupling to env); Kysely (rejected — Drizzle is locked in §3 of DB doc).

## R-002: Health/ready endpoint contract

**Decision**: `/health` returns 200 `{ status: "ok" }` (liveness, no DB check). `/ready` returns 200/503 with `{ status, db: { adapter, latencyMs }, registry, plugins }`. Ready check is pluggable via `createApp({ readyCheck })`.

**Rationale**: Deployment guide §11 requires `/health` and `/ready` for load balancer and CI verification. Pluggable readyCheck allows Slice 1+ to add registry/plugin checks without modifying http package.

**Alternatives considered**: Single combined endpoint (rejected — liveness must not depend on DB).

## R-003: Admin skeleton

**Decision**: Minimal Next.js static export (`output: 'export'`) with a root layout and placeholder page. No data fetching, no auth, no routing beyond `/`. Amplify serves `out/` as SPA.

**Rationale**: Deployment guide §6 requires static export; admin is a pure API consumer (P-04). Full admin UI is Slice 6.

**Alternatives considered**: Full Next.js app with SSR (rejected — violates static-export requirement and adds server compute).

## R-004: Package build order

**Decision**: Build order: `shared` → `config` → `db` → `http` → `api` (and `admin` independently). Nx `dependsOn: ["^build"]` handles this automatically.

**Rationale**: Composite TypeScript projects require dependencies built first. Nx target defaults already configured in `nx.json`.

**Alternatives considered**: Single bundled package (rejected — violates modular monolith boundary P-01/P-02).
