// Smoke runner for T081/T082 without vitest: exercises the same assertions via tsx.
import pg from "pg";
import {
  createContentType, createField, createDocument, getDocument,
  updateDocument, deleteDocument, publishDocument, queryPublished,
} from "./index.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://peggy:peggy@localhost:5432/peggy_test";

async function main() {
  const raw = new pg.Client({ connectionString: DATABASE_URL });
  await raw.connect();
  await raw.query(
    `INSERT INTO locales (code, name, is_default, is_active) VALUES ('en', 'English', true, true)
     ON CONFLICT (code) DO UPDATE SET is_default = true`,
  );
  const clean = async () => {
    await raw.query("DELETE FROM document_locales");
    await raw.query("DELETE FROM document_versions");
    await raw.query("DELETE FROM documents");
    await raw.query("DELETE FROM content_fields");
    await raw.query("DELETE FROM schema_versions WHERE owner_kind IN ('content_type','component')");
    await raw.query("DELETE FROM components");
    await raw.query("DELETE FROM content_types");
  };
  const seed = async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts", displayName: "Post" });
    await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", required: true, sortOrder: 1 });
    await createField({ contentTypeId: ct.id, name: "slug", fieldType: "uid", required: true, sortOrder: 2 });
    return ct;
  };
  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) { pass++; console.log(`ok - ${name}`); }
    else { fail++; console.log(`NOT OK - ${name}`); }
  };

  // T082 draft-only -> 0 rows
  await clean();
  {
    const ct = await seed();
    await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "Draft", slug: "draft-only" } });
    const r = await queryPublished(ct.id, { locale: "en" });
    check("T082 draft-only returns 0 rows", r.data.length === 0 && r.meta.pagination.total === 0);
  }
  // T082 published visible
  await clean();
  {
    const ct = await seed();
    const doc = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "Live", slug: "live" } }) as { id: string };
    await publishDocument(doc.id, "en");
    const r = await queryPublished(ct.id, { locale: "en" });
    check("T082 published visible", r.data.length === 1 && r.meta.pagination.total === 1);
  }
  // T081 create 201-equivalent
  await clean();
  {
    const ct = await seed();
    const doc = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "H", slug: "h" } }) as { version: number };
    check("T081 create returns v1", doc.version === 1);
  }
  // T081 422 missing required
  await clean();
  {
    const ct = await seed();
    let threw422 = false;
    try { await createDocument({ contentTypeId: ct.id, locale: "en", data: { slug: "no-title" } }); }
    catch (e) { threw422 = /Missing required/.test(String(e)); }
    check("T081 missing required throws 422-equivalent", threw422);
  }
  // T081 get 200 / 404
  await clean();
  {
    const ct = await seed();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } }) as { id: string };
    const got = await getDocument(created.id, "en");
    check("T081 get returns document", got !== null);
    const miss = await getDocument("00000000-0000-0000-0000-000000000000", "en");
    check("T081 get missing returns null (404)", miss === null);
  }
  // T081 update 200
  await clean();
  {
    const ct = await seed();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } }) as { id: string };
    const upd = await updateDocument(created.id, { locale: "en", data: { title: "T2", slug: "t" } }) as { version: number };
    check("T081 update returns v2", upd.version === 2);
  }
  // T081 409 slug conflict on publish
  await clean();
  {
    const ct = await seed();
    const a = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "A", slug: "clash" } }) as { id: string };
    await publishDocument(a.id, "en");
    const b = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "B", slug: "other" } }) as { id: string };
    // Cross-version uniqueness is enforced by the DB trigger at write time (0005):
    // updating a draft to a slug held by another version must conflict.
    let threw409 = false;
    try { await updateDocument(b.id, { locale: "en", data: { title: "B2", slug: "clash" } }); }
    catch (e) { threw409 = /conflict/i.test(String(e)); }
    check("T081 duplicate slug write conflicts (409)", threw409);
  }
  // T081 delete tombstone
  await clean();
  {
    const ct = await seed();
    const created = await createDocument({ contentTypeId: ct.id, locale: "en", data: { title: "T", slug: "t" } }) as { id: string };
    await deleteDocument(created.id);
    const got = await getDocument(created.id, "en");
    check("T081 deleted doc reads null", got === null);
  }

  await raw.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
