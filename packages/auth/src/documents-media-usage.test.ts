import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import {
  createDocument,
  updateDocument,
  restoreVersion,
} from "./documents.js";
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
  // TRUNCATE, not DELETE: 0004_convergence makes document_versions immutable
  // via a row trigger that rejects DELETEs. TRUNCATE bypasses row triggers;
  // CASCADE resolves FK ordering in a single statement.
  await raw.query("TRUNCATE document_locales, document_versions, document_relations, documents, media_usage, media_assets, content_fields, components, content_types CASCADE");
  await raw.query("DELETE FROM schema_versions WHERE owner_kind IN ('content_type','component')");
  await raw.query(
    `INSERT INTO locales (code, name, is_default, is_active) VALUES ('en', 'English', true, true)
     ON CONFLICT (code) DO UPDATE SET is_default = true`,
  );
});

async function seedMediaPostType() {
  const ct = await createContentType({
    name: "post",
    kind: "collection",
    collectionSlug: "posts",
    displayName: "Post",
  });
  await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", sortOrder: 1 });
  await createField({ contentTypeId: ct.id, name: "hero", fieldType: "media", sortOrder: 2 });
  return ct;
}

async function seedAsset(key: string): Promise<string> {
  const { rows } = await raw.query(
    `INSERT INTO media_assets (provider_key, url, secure_url, mime, size_bytes)
     VALUES ($1, $2, $3, 'image/png', 1234) RETURNING id`,
    [key, `https://example.com/${key}`, `https://example.com/${key}`],
  );
  return rows[0].id as string;
}

async function ledgerRows(documentId: string): Promise<{ asset_id: string; field_path: string }[]> {
  const { rows } = await raw.query(
    `SELECT asset_id, field_path FROM media_usage WHERE document_id = $1 ORDER BY field_path`,
    [documentId],
  );
  return rows;
}

// T054: media_usage reconciliation (delete-then-insert in the same
// transaction as the version write). These rows are exactly what the
// deleteAsset 409 guard reads, so asserting ledger state asserts the
// guard's inputs: a removed ref must not linger and cause a false 409,
// and a restored version's refs must be recorded.
describe("media_usage ledger reconciliation (T054)", () => {
  it("create records refs for media fields", async () => {
    const ct = await seedMediaPostType();
    const assetA = await seedAsset("t054-a");
    const doc = await createDocument({
      contentTypeId: ct.id,
      locale: "en",
      data: { title: "Hello", hero: assetA },
    }) as { id: string };
    expect(await ledgerRows(doc.id)).toEqual([{ asset_id: assetA, field_path: "hero" }]);
  });

  it("update replaces stale refs instead of appending (no false 409 source)", async () => {
    const ct = await seedMediaPostType();
    const assetA = await seedAsset("t054-a");
    const assetB = await seedAsset("t054-b");
    const doc = await createDocument({
      contentTypeId: ct.id,
      locale: "en",
      data: { title: "Hello", hero: assetA },
    }) as { id: string };

    await updateDocument(doc.id, { locale: "en", data: { title: "Hello", hero: assetB } });
    // Old append-only behavior would leave both rows; reconciliation
    // must leave exactly the live ref.
    expect(await ledgerRows(doc.id)).toEqual([{ asset_id: assetB, field_path: "hero" }]);
  });

  it("update removing a media ref clears the ledger row", async () => {
    const ct = await seedMediaPostType();
    const assetA = await seedAsset("t054-a");
    const doc = await createDocument({
      contentTypeId: ct.id,
      locale: "en",
      data: { title: "Hello", hero: assetA },
    }) as { id: string };

    await updateDocument(doc.id, { locale: "en", data: { title: "Hello" } });
    expect(await ledgerRows(doc.id)).toEqual([]);
  });

  it("restoreVersion records refs from the restored data", async () => {
    const ct = await seedMediaPostType();
    const assetA = await seedAsset("t054-a");
    const doc = await createDocument({
      contentTypeId: ct.id,
      locale: "en",
      data: { title: "Hello", hero: assetA },
    }) as { id: string };
    // v2 drops the ref; v3 restores v1's data via restoreVersion.
    await updateDocument(doc.id, { locale: "en", data: { title: "Hello" } });
    expect(await ledgerRows(doc.id)).toEqual([]);

    await restoreVersion(doc.id, 1, "en");
    expect(await ledgerRows(doc.id)).toEqual([{ asset_id: assetA, field_path: "hero" }]);
  });
});
