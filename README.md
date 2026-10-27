# Peggy CMS

Developer-focused headless CMS and scaffolding platform. See `docs/` for the full blueprint (v0.2.0).

## Quick start (dev)

```bash
cp .env.example .env.development
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm nx run api:dev
```

## Layout

- `apps/api` — Express API wrapped with `serverless-http` (AWS Lambda target)
- `apps/admin` — Next.js static export (AWS Amplify target)
- `packages/*` — shared packages (config, db, domain, auth, storage, http, shared)
- `docs/` — product, architecture, database, deployment, spike reports
- `ci/` — CI/deploy workflow samples (copy to `.github/workflows/` at implementation)
