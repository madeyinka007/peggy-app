import { PgPoolAdapter } from "./pg-pool.js";
import { NeonHttpAdapter } from "./neon-http.js";
import type { DbClient } from "./client.js";

export function createDbClient(connectionString: string): DbClient {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  // Neon URLs use neon.tech domain
  if (connectionString.includes("neon.tech") || connectionString.includes("neon.database")) {
    return new NeonHttpAdapter(connectionString);
  }
  return new PgPoolAdapter(connectionString);
}
