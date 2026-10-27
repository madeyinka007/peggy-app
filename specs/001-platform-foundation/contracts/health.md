# Contract: Health & Ready Endpoints

## GET /health

**Purpose**: Liveness probe (no dependencies).

**Response 200**:
```json
{ "status": "ok" }
```

## GET /ready

**Purpose**: Readiness probe (DB connectivity + registry + plugins).

**Response 200** (ready):
```json
{ "status": "ready", "db": { "adapter": "pg-pool", "latencyMs": 43 }, "registry": "uninitialized", "plugins": [] }
```

**Response 503** (not ready):
```json
{ "status": "not_ready", "db": { "adapter": "pg-pool", "latencyMs": 0 }, "registry": "uninitialized", "plugins": [] }
```
