# Data Model: Platform Foundation (Slice 0)

Slice 0 has no domain entities. The only data structures are configuration and connection state.

## Config (Zod schema)

All environment variables from deployment guide §4, parsed and validated by `@peggy/config`. See `packages/config/src/env.ts`.

## DbClient (port interface)

```typescript
interface DbClient {
  adapter: "neon-http" | "pg-pool";
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
  close(): Promise<void>;
}
```

No tables, no migrations, no schema. Database schema is introduced in Slice 1 (auth) and Slice 2 (schema registry).

## Logger context

Structured JSON with `requestId`, `traceId`, `spanId`, and redacted secrets. See `packages/shared/src/logger.ts`.
