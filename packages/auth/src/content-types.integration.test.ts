import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import {
  createContentType, getContentType, listContentTypes, updateContentType, deleteContentType,
  createField, getFields, getField, updateField, deleteField,
  createComponent, getComponent, listComponents, deleteComponent,
} from "./index.js";

let raw: pg.Client;

beforeAll(async () => {
  raw = new pg.Client({ connectionString: process.env.DATABASE_URL! });
  await raw.connect();
});

afterAll(async () => {
  await raw.end();
});

beforeEach(async () => {
  // TRUNCATE, not DELETE: 0004_convergence makes document_versions immutable
  // via a row trigger that rejects DELETEs. TRUNCATE bypasses row triggers;
  // CASCADE resolves FK ordering in a single statement.
  await raw.query("TRUNCATE document_locales, document_versions, document_relations, documents, media_usage, content_fields, components, content_types CASCADE");
  await raw.query("DELETE FROM schema_versions WHERE owner_kind IN ('content_type','component')");
});

describe("Content Type CRUD (T057)", () => {
  it("creates a content type with activeSchemaVersion 1", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts", displayName: "Blog Post" });
    expect(ct.name).toBe("post");
    expect(ct.activeSchemaVersion).toBe(1);
  });

  it("lists content types", async () => {
    await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const list = await listContentTypes();
    expect(list.length).toBe(1);
  });

  it("gets content type by id", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const fetched = await getContentType(ct.id);
    expect(fetched?.name).toBe("post");
  });

  it("updates content type", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const updated = await updateContentType(ct.id, { displayName: "Updated" });
    expect(updated?.displayName).toBe("Updated");
  });

  it("deletes content type", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await deleteContentType(ct.id);
    expect(await getContentType(ct.id)).toBeNull();
  });

  it("soft-blocks delete when documents exist (placeholder — no docs table yet)", async () => {
    // Documents are Slice 3; delete should succeed when no documents
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await deleteContentType(ct.id);
    expect(await getContentType(ct.id)).toBeNull();
  });
});

describe("Field CRUD (T058)", () => {
  it("creates a field and bumps schema version", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const field = await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", required: true, sortOrder: 1 });
    expect(field).not.toBeNull();
    expect(field!.name).toBe("title");
    const updated = await getContentType(ct.id);
    expect(updated).not.toBeNull();
    expect(updated!.activeSchemaVersion).toBe(2);
  });

  it("rejects reserved field name", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await expect(createField({ contentTypeId: ct.id, name: "id", fieldType: "text" })).rejects.toThrow("Reserved");
  });

  it("rejects invalid field type", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await expect(createField({ contentTypeId: ct.id, name: "foo", fieldType: "invalid" })).rejects.toThrow("Invalid field type");
  });

  it("lists fields ordered by sortOrder", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", sortOrder: 2 });
    await createField({ contentTypeId: ct.id, name: "slug", fieldType: "uid", sortOrder: 1 });
    const fields = await getFields(ct.id);
    expect(fields[0]?.name).toBe("slug");
    expect(fields[1]?.name).toBe("title");
  });

  it("updates a field and bumps schema version", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const field = await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", sortOrder: 1 });
    const updated = await updateField(field!.id, { label: "Title", required: true });
    expect(updated).not.toBeNull();
    expect(updated!.label).toBe("Title");
    expect(updated!.required).toBe(true);
    const reloaded = await getContentType(ct.id);
    // create bumped 1 -> 2, update bumps 2 -> 3
    expect(reloaded!.activeSchemaVersion).toBe(3);
  });

  it("updateField returns null for unknown id", async () => {
    await expect(updateField("00000000-0000-0000-0000-000000000000", { label: "x" })).resolves.toBeNull();
  });

  it("deletes (deprecates) a field and bumps schema version", async () => {
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    const field = await createField({ contentTypeId: ct.id, name: "title", fieldType: "text", sortOrder: 1 });
    const deleted = await deleteField(field!.id);
    expect(deleted).not.toBeNull();
    // Deprecated, not dropped: row still readable
    expect(await getField(field!.id)).not.toBeNull();
    const reloaded = await getContentType(ct.id);
    expect(reloaded!.activeSchemaVersion).toBe(3);
  });

  it("deleteField returns null for unknown id", async () => {
    await expect(deleteField("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
  });

  it("updates and deletes a component-owned field", async () => {
    const comp = await createComponent({ name: "seo" });
    const field = await createField({ componentId: comp.id, name: "meta", fieldType: "text", sortOrder: 1 });
    const updated = await updateField(field!.id, { label: "Meta title" });
    expect(updated!.label).toBe("Meta title");
    const deleted = await deleteField(field!.id);
    expect(deleted).not.toBeNull();
    expect(await getField(field!.id)).not.toBeNull();
    // Exercise the component-scoped list path used by GET /components/:id/fields
    expect(await getFields(undefined, comp.id)).toHaveLength(1);
  });
});

describe("Component CRUD (T059)", () => {
  it("creates a component with activeSchemaVersion 1", async () => {
    const comp = await createComponent({ name: "seo", displayName: "SEO", category: "seo" });
    expect(comp.name).toBe("seo");
    expect(comp.activeSchemaVersion).toBe(1);
  });

  it("lists components", async () => {
    await createComponent({ name: "seo" });
    const list = await listComponents();
    expect(list.length).toBe(1);
  });

  it("gets component by id", async () => {
    const comp = await createComponent({ name: "seo" });
    const fetched = await getComponent(comp.id);
    expect(fetched?.name).toBe("seo");
  });

  it("blocks delete when referenced by fields", async () => {
    const comp = await createComponent({ name: "seo" });
    const ct = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    await createField({ contentTypeId: ct.id, name: "seo", fieldType: "component", componentConfig: { componentId: comp.id } });
    await expect(deleteComponent(comp.id)).rejects.toThrow("referenced");
  });

  it("allows delete when not referenced", async () => {
    const comp = await createComponent({ name: "seo" });
    await deleteComponent(comp.id);
    expect(await getComponent(comp.id)).toBeNull();
  });
});
