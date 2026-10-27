import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const neon = require("@neondatabase/serverless");
const { neon: neonFn } = neon;

import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import type { DbClient, DbHealth } from "./client.js";

export class NeonHttpAdapter implements DbClient {
  readonly adapter = "neon-http" as const;
  private sql: ReturnType<typeof neonFn>;
  readonly db: ReturnType<typeof drizzle>;

  constructor(connectionString: string) {
    this.sql = neonFn(connectionString);
    this.db = drizzle(this.sql, { schema });
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.sql.query(sql, params ?? []);
    return result as T[];
  }

  async healthCheck(): Promise<DbHealth> {
    const start = Date.now();
    try {
      await this.sql`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    // HTTP driver is stateless; nothing to close
  }
}
