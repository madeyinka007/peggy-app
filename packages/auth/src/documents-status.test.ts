import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
} from "./documents.js";
import { publishDocument } from "./publishing.js";
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
  // Ensure default locale exists
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

async function seedPostType(slugField = true) {
  const ct = await createContentType({
    name: "post",
    kind: "collection",
    collectionSlug: "posts",
    displayName: "Post",
  });
  await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", required: true, sortOrder: 1 });
  if (slugField) {
    await createField({ contentTypeId: ct.id, name: "slug", fieldType: "uid", required: true, sortOrder: 2 });
  }
  return ct;
}

// T081: HTTP status codes for document endpoints (service-level contract)
describe("document endpoint status codes (T081)", () => {
  it("201 create document", async () => {
    const ct = await seedPostType();
    const doc = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "Hello", slug: "hello" } });
    expect(doc).toBeDefined();
    // createDocument returns 201-equivalent payload with version data
    expect((doc as { version: number }).version).toBe(1);
  });

  it("422 invalid data (missing required field)", async () => {
    const ct = await seedPostType();
    await expect(
      createDocument({ contentTypeId: ct.id, locale: "en", data: { slug: "no-title" } }),
    ).rejects.toThrow(/Missing required/);
  });

  it("200 get document", async () => {
    const ct = await seedPostType();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } });
    const fetched = await getDocument((created as { id: string }).id, "en");
    expect(fetched).not.toBeNull();
  });

  it("404 get nonexistent document", async () => {
    const fetched = await getDocument("00000000-0000-0000-0000-000000000000", "en");
    expect(fetched).toBeNull();
  });

  it("200 update document", async () => {
    const ct = await seedPostType();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } });
    const updated = await updateDocument((created as { id: string }).id, {
      locale: "en",
      data: { title: "T2", slug: "t" },
    });
    expect((updated as { version: number }).version).toBe(2);
  });

  it("same-document new version keeps slug (no false 409)", async () => {
    const ct = await seedPostType();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "keep" } });
    const updated = await updateDocument((created as { id: string }).id, {
      locale: "en",
      data: { title: "T2", slug: "keep" },
    });
    expect((updated as { version: number }).version).toBe(2);
  });

  it("409 slug conflict across documents", async () => {
    const ct = await seedPostType();
    const first = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "A", slug: "clash" } });
    await publishDocument((first as { id: string }).id, "en");
    const second = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "B", slug: "other" } });
    // Cross-document uniqueness is enforced by the DB trigger at write time (0005)
    await expect(
      updateDocument((second as { id: string }).id, { locale: "en", data: { title: "B2", slug: "clash" } }),
    ).rejects.toThrow(/conflict/i);
  });

  it("204 delete document (tombstone)", async () => {
    const ct = await seedPostType();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } });
    const ok = await deleteDocument((created as { id: string }).id);
    expect(ok).toBe(true);
    const fetched = await getDocument((created as { id: string }).id, "en");
    expect(fetched).toBeNull();
  });
});
