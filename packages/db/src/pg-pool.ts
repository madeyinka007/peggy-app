import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("pg");
const { Pool } = pg;

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { DbClient, DbHealth } from "./client.js";

export class PgPoolAdapter implements DbClient {
  readonly adapter = "pg-pool" as const;
  private pool: InstanceType<typeof Pool>;
  readonly db: ReturnType<typeof drizzle>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async healthCheck(): Promise<DbHealth> {
    const start = Date.now();
    try {
      await this.pool.query("SELECT 1");
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
