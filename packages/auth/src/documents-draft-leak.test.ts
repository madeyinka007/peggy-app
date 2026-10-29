import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createDocument } from "./documents.js";
import { publishDocument } from "./publishing.js";
import { queryPublished } from "./query-engine.js";
import { createContentType, createField } from "./index.js";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

let raw: pg.Client;

beforeAll(async () => {
  raw = new pg.Client({ connectionString: mustEnv("DATABASE_URL") });
  await raw.connect();
  await raw.query(
    `INSERT INTO locales (code, name, is_default, is_active) VALUES ('en', 'English', true, true)
     ON CONFLICT (code) DO UPDATE SET is_default = true`,
  );
});

afterAll(async () => {
  await raw.end();
});

beforeEach(async () => {
  await raw.query("DELETE FROM document_locales");
  await raw.query("DELETE FROM document_versions");
  await raw.query("DELETE FROM documents");
  await raw.query("DELETE FROM content_fields");
  await raw.query("DELETE FROM schema_versions WHERE owner_kind IN ('content_type','component')");
  await raw.query("DELETE FROM components");
  await raw.query("DELETE FROM content_types");
  await raw.query(
    `INSERT INTO locales (code, name, is_default, is_active) VALUES ('en', 'English', true, true)
     ON CONFLICT (code) DO UPDATE SET is_default = true`,
  );
});

// T082: draft-leak prevention — public query returns 0 rows for draft-only content
describe("draft-leak prevention (T082)", () => {
  it("public query returns 0 rows for draft-only content", async () => {
    const ct = await createContentType({
      name: "post",
      kind: "collection",
      collectionSlug: "posts",
      displayName: "Post",
    });
    await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", required: true, sortOrder: 1 });
    await createField({ contentTypeId: ct.id, name: "slug", fieldType: "uid", required: true, sortOrder: 2 });

    await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "Draft only", slug: "draft-only" } });

    const result = await queryPublished(ct.id, { locale: "en" });
    expect(result.data.length).toBe(0);
    expect(result.meta.pagination.total).toBe(0);
  });

  it("published content is visible via public query", async () => {
    const ct = await createContentType({
      name: "post",
      kind: "collection",
      collectionSlug: "posts",
      displayName: "Post",
    });
    await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", required: true, sortOrder: 1 });
    await createField({ contentTypeId: ct.id, name: "slug", fieldType: "uid", required: true, sortOrder: 2 });

    const doc = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "Live", slug: "live" } });
    await publishDocument((doc as { id: string }).id, "en");

    const result = await queryPublished(ct.id, { locale: "en" });
    expect(result.data.length).toBe(1);
    expect(result.meta.pagination.total).toBe(1);
  });
});
