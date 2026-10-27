import { describe, it, expect } from "vitest";
import { createDbClient } from "@peggy/db";
import { checkRateLimit } from "./rate-limit.js";

function mustEnv(n: string) { const v = process.env[n]; if (!v) throw new Error(`missing ${n}`); return v; }

describe("checkRateLimit (Postgres-backed, T070)", () => {
  it("allows 5 then blocks 6th within window", async () => {
    const db = createDbClient(mustEnv("DATABASE_URL"));
    const key = `smoke:${Date.now()}`;
    for (let i = 1; i <= 5; i++) {
      const r = await checkRateLimit(db, key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(db, key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    await db.query("DELETE FROM rate_limits WHERE key = $1", [key]);
    await db.close();
  });
});
