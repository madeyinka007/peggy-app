# Quickstart: Platform Foundation (Slice 0)

## Prerequisites

- Node.js 22 LTS, pnpm 9 (or npm 11)
- Docker (for local Postgres)

## Setup

```bash
git clone <peggy> && cd peggy
cp .env.example .env.development
docker compose -f docker-compose.dev.yml up -d
pnpm install   # or: npm install
```

## Validate

```bash
# 1. Doctor (env validation)
pnpm doctor   # or: npm run doctor
# Expected: "✓ All checks passed", exit 0

# 2. Build all packages
pnpm nx build  # or: npx tsc -b (per package)
# Expected: zero errors

# 3. Start dev server
pnpm nx run api:dev  # or: npm run dev --workspace=apps/api
# Expected: "peggy api listening on 3000"

# 4. Health check
curl -s http://localhost:3000/health
# Expected: {"status":"ok"}

# 5. Ready check
curl -s http://localhost:3000/ready
# Expected: {"status":"ready","db":{"adapter":"pg-pool",...}}

# 6. Lambda handler (synthetic)
AWS_LAMBDA_FUNCTION_NAME=peggy-api node -e "
  const h = require('./apps/api/dist/lambda.js').handler;
  h({version:'2.0',rawPath:'/health',requestContext:{http:{method:'GET',path:'/health'}},headers:{},isBase64Encoded:false},{}).then(r=>console.log(r.statusCode,r.body));
"
# Expected: 200 {"status":"ok"}
```

## Troubleshooting

- `/ready` returns 503: check `DATABASE_URL` and that Postgres is running.
- `doctor` fails: check `.env` against `.env.example`.
- Build fails: run `pnpm install` to ensure dependencies are installed.
