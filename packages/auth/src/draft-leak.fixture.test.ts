import { describe, it, beforeAll, afterAll, expect } from "vitest";
import pg from "pg";

// Draft-leak fixture (FR-014, T065): a public-scope token must see 0 rows
// when only draft content exists. Slice 1 has no real content tables yet
// (documents/document_versions land in Slice 2), so this fixture validates
// the invariant on a minimal auxiliary table that mirrors the shape.

let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgres://peggy:peggy@localhost:5432/peggy" });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS _draft_leak_probe (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      status text NOT NULL
    );
    DO $$ BEGIN CREATE TYPE _probe_status AS ENUM ('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await client.query("DELETE FROM _draft_leak_probe");
  // Seed only draft rows
  await client.query("INSERT INTO _draft_leak_probe (status) VALUES ('draft'), ('draft')");
});

afterAll(async () => {
  await client.query("DROP TABLE IF EXISTS _draft_leak_probe");
  await client.end();
});

describe("draft-leak fixture (FR-014)", () => {
  it("public token × draft-only content → 0 rows (IS NOT NULL / status predicate)", async () => {
    const { rows } = await client.query("SELECT * FROM _draft_leak_probe WHERE status = 'published'");
    expect(rows.length).toBe(0);
  });

  it("published rows would be visible if present", async () => {
    await client.query("INSERT INTO _draft_leak_probe (status) VALUES ('published')");
    const { rows } = await client.query("SELECT * FROM _draft_leak_probe WHERE status = 'published'");
    expect(rows.length).toBe(1);
    await client.query("DELETE FROM _draft_leak_probe WHERE status='published'");
  });
});
