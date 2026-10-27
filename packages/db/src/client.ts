import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

export type DbAdapter = "neon-http" | "pg-pool";
export type DrizzleDb = NodePgDatabase<Record<string, unknown>> | NeonHttpDatabase<Record<string, unknown>>;

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
}

export interface DbClient {
  readonly adapter: DbAdapter;
  readonly db: DrizzleDb;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  healthCheck(): Promise<DbHealth>;
  close(): Promise<void>;
}
