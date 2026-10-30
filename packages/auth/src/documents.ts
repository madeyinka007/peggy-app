import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { documents, documentVersions, documentLocales, contentTypes, contentFields, locales, mediaAssets, mediaUsage } from "@peggy/db";
import { randomUUID } from "node:crypto";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}


async function getDefaultLocale(db: ReturnType<typeof drizzle>): Promise<string> {
  const rows = await db.select().from(locales).where(eq(locales.isDefault, true));
  return rows[0]?.code ?? "en";
}

export async function createDocument(data: {
  contentTypeId: string;
  locale?: string;
  data: Record<string, unknown>;
  createdBy?: string;
}) {
  const db = getDb();
  let locale = data.locale;
  if (!locale) {
    const { locales } = await import("@peggy/db");
    const rows = await db.select().from(locales).where(eq(locales.isDefault, true));
    locale = rows[0]?.code ?? "en";
  }

  // Get content type for schema version
  const [ct] = await db.select().from(contentTypes).where(eq(contentTypes.id, data.contentTypeId));
  if (!ct) throw new Error("Content type not found");

  // Validate data against schema (basic: check required fields)
  const fields = await db.select().from(contentFields).where(eq(contentFields.contentTypeId, data.contentTypeId));
  for (const field of fields) {
    const val = data.data[field.name];
    if (field.required && (val === undefined || val === null)) {
      throw new Error(`Missing required field: ${field.name}`);
    }
    if (val !== undefined && val !== null) {
      const ok = validateFieldValue(field.fieldType, val);
      if (!ok) throw new Error(`Invalid type for field ${field.name}: expected ${field.fieldType}`);
      validateFieldRules(field.name, (field.validation ?? {}) as Record<string, unknown>, val);
    }
  }

  // Extract slug
  const slug = extractSlug(data.data, fields);

  // Check slug uniqueness
  if (slug) {
    // Check if any existing published version has this slug
    const publishedSlugs = await db.select().from(documentLocales).innerJoin(
      documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id)
    );
    for (const row of publishedSlugs) {
      const dv = (row as { document_versions?: { slug?: string; locale?: string } }).document_versions;
      if (dv?.slug === slug && dv?.locale === locale) {
        throw new Error("Slug conflict: a published document with this slug already exists");
      }
    }
  }

  const documentId = randomUUID();
  return await db.transaction(async (tx) => {
    const [doc] = await tx.insert(documents).values({
      documentId,
      contentTypeId: data.contentTypeId,
      createdBy: data.createdBy ?? null,
    }).returning();
    if (!doc) throw new Error("Failed to create document");

    const [version] = await tx.insert(documentVersions).values({
      documentId: doc.id,
      locale,
      version: 1,
      status: "draft",
      data: data.data,
      schemaVersion: ct.activeSchemaVersion,
      slug,
      createdBy: data.createdBy ?? null,
    }).returning();
    if (!version) throw new Error("Failed to create version");

    await tx.insert(documentLocales).values({
      documentId: doc.id,
      locale,
      draftVersionId: version.id,
    });

    // Ledger: record media asset references in media_usage (same transaction)
    const mediaFields = fields.filter((f) => f.fieldType === "media");
    for (const mf of mediaFields) {
      const val = data.data[mf.name];
      const ids: string[] = [];
      if (typeof val === "string") ids.push(val);
      else if (Array.isArray(val)) val.forEach((v) => { if (typeof v === "string") ids.push(v); else if (v && typeof v === "object" && "id" in (v as object)) ids.push(String((v as { id: unknown }).id)); });
      else if (val && typeof val === "object" && "id" in (val as object)) ids.push(String((val as { id: unknown }).id));
      for (const aid of ids) {
        // only insert if asset exists (best-effort)
        const existing = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, aid));
        if (existing.length > 0) {
          await tx.insert(mediaUsage).values({
            assetId: aid,
            documentId: doc.id,
            locale,
            fieldPath: mf.name,
            versionId: version.id,
          }).onConflictDoNothing();
        }
      }
    }

    return { ...doc, locale, version: version.version, data: version.data, schemaVersion: version.schemaVersion };
  });
}


function validateFieldValue(fieldType: string, val: unknown): boolean {
  switch (fieldType) {
    case "text":
    case "richtext":
    case "uid":
    case "email":
    case "url":
    case "date":
    case "datetime":
      return typeof val === "string";
    case "number":
    case "integer":
    case "decimal":
      return typeof val === "number";
    case "boolean":
      return typeof val === "boolean";
    case "json":
    case "component":
    case "relation":
      return typeof val === "object" && val !== null;
    case "media":
      return typeof val === "string" || (typeof val === "object" && val !== null);
    default:
      return true;
  }
}


function validateFieldRules(fieldName: string, validation: Record<string, unknown>, val: unknown): void {
  const v = validation ?? {};
  if (typeof val === "string") {
    if (typeof v.minLength === "number" && val.length < v.minLength) throw new Error(`Validation failed for ${fieldName}: minLength ${v.minLength}`);
    if (typeof v.maxLength === "number" && val.length > v.maxLength) throw new Error(`Validation failed for ${fieldName}: maxLength ${v.maxLength}`);
    if (typeof v.pattern === "string" && !new RegExp(v.pattern).test(val)) throw new Error(`Validation failed for ${fieldName}: pattern`);
  }
  if (typeof val === "number") {
    if (typeof v.min === "number" && val < v.min) throw new Error(`Validation failed for ${fieldName}: min ${v.min}`);
    if (typeof v.max === "number" && val > v.max) throw new Error(`Validation failed for ${fieldName}: max ${v.max}`);
  }
  if (v.required === true && (val === undefined || val === null || val === "")) throw new Error(`Validation failed for ${fieldName}: required`);
}

function extractSlug(data: Record<string, unknown>, fields: { name: string; fieldType: string }[]): string | null {
  const uidField = fields.find(f => f.fieldType === "uid");
  if (!uidField) return null;
  const val = data[uidField.name];
  if (typeof val === "string") {
    return val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  return null;
}

export async function getDocument(id: string, locale?: string, includeDeleted = false) {
  const db = getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return null;
  if (doc.deletedAt && !includeDeleted) return null;

  const loc = locale ?? (await getDefaultLocale(db));
  const [dl] = await db.select().from(documentLocales).where(
    and(eq(documentLocales.documentId, doc.id), eq(documentLocales.locale, loc))
  );
  if (!dl || !dl.draftVersionId) return { ...doc, locale: loc, draftVersion: null };

  const [dv] = await db.select().from(documentVersions).where(eq(documentVersions.id, dl.draftVersionId));
  let publishedVersion = null;
  if (dl.publishedVersionId) {
    const [pv] = await db.select().from(documentVersions).where(eq(documentVersions.id, dl.publishedVersionId));
    publishedVersion = pv ?? null;
  }
  return { ...doc, locale: loc, draftVersion: dv ?? null, publishedVersion, publishedVersionId: dl.publishedVersionId };
}

export async function listDocuments(contentTypeId: string, locale?: string) {
  const db = getDb();
  const loc = locale ?? (await getDefaultLocale(db));
  const docs = await db.select().from(documents).where(
    and(eq(documents.contentTypeId, contentTypeId), sql`${documents.deletedAt} IS NULL`)
  );
  const result = [];
  for (const doc of docs) {
    const [dl] = await db.select().from(documentLocales).where(
      and(eq(documentLocales.documentId, doc.id), eq(documentLocales.locale, loc))
    );
    if (dl) {
      result.push({ ...doc, locale: loc, draftVersionId: dl.draftVersionId, publishedVersionId: dl.publishedVersionId });
    }
  }
  return result;
}

export async function updateDocument(id: string, data: {
  locale?: string;
  data: Record<string, unknown>;
  createdBy?: string;
}) {
  const db = getDb();
  const loc = data.locale ?? (await getDefaultLocale(db));

  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) throw new Error("Document not found");
  if (doc.deletedAt) throw new Error("Document is deleted");

  const [ct] = await db.select().from(contentTypes).where(eq(contentTypes.id, doc.contentTypeId));
  if (!ct) throw new Error("Content type not found");

  const fields = await db.select().from(contentFields).where(eq(contentFields.contentTypeId, doc.contentTypeId));
  for (const field of fields) {
    const val = data.data[field.name];
    if (field.required && (val === undefined || val === null)) {
      throw new Error(`Missing required field: ${field.name}`);
    }
    if (val !== undefined && val !== null) {
      const ok = validateFieldValue(field.fieldType, val);
      if (!ok) throw new Error(`Invalid type for field ${field.name}: expected ${field.fieldType}`);
      validateFieldRules(field.name, (field.validation ?? {}) as Record<string, unknown>, val);
    }
  }

  const slug = extractSlug(data.data, fields);

  // Slug uniqueness check (published docs in same locale)
  if (slug) {
    const publishedSlugs = await db.select().from(documentLocales).innerJoin(
      documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id)
    );
    for (const row of publishedSlugs) {
      const dv = (row as { document_versions?: { slug?: string; locale?: string; documentId?: string } }).document_versions;
      if (dv?.slug === slug && dv?.locale === loc && dv?.documentId !== doc.id) {
        throw new Error("Slug conflict: a published document with this slug already exists");
      }
    }
  }

  const [dl] = await db.select().from(documentLocales).where(
    and(eq(documentLocales.documentId, doc.id), eq(documentLocales.locale, loc))
  );
  if (!dl) throw new Error("Locale not found");

  // Get current max version
  const versions = await db.select().from(documentVersions).where(
    and(eq(documentVersions.documentId, doc.id), eq(documentVersions.locale, loc))
  );
  const maxVersion = versions.reduce((max, v) => Math.max(max, v.version), 0);

  const [newVersion] = await db.insert(documentVersions).values({
    documentId: doc.id,
    locale: loc,
    version: maxVersion + 1,
    status: "draft",
    data: data.data,
    schemaVersion: ct.activeSchemaVersion,
    slug,
    createdBy: data.createdBy ?? null,
  }).returning();
  if (!newVersion) throw new Error("Failed to create version");

  await db.update(documentLocales).set({
    draftVersionId: newVersion.id,
    updatedAt: new Date(),
  }).where(and(eq(documentLocales.documentId, doc.id), eq(documentLocales.locale, loc)));

  // Ledger: record media asset references in media_usage (best-effort)
  const mediaFields2 = fields.filter((f) => f.fieldType === "media");
  for (const mf of mediaFields2) {
    const val = data.data[mf.name];
    const ids: string[] = [];
    if (typeof val === "string") ids.push(val);
    else if (Array.isArray(val)) val.forEach((v) => { if (typeof v === "string") ids.push(v); else if (v && typeof v === "object" && "id" in (v as object)) ids.push(String((v as { id: unknown }).id)); });
    else if (val && typeof val === "object" && "id" in (val as object)) ids.push(String((val as { id: unknown }).id));
    for (const aid of ids) {
      const existing = await db.select().from(mediaAssets).where(eq(mediaAssets.id, aid));
      if (existing.length > 0) {
        await db.insert(mediaUsage).values({
          assetId: aid,
          documentId: doc.id,
          locale: loc,
          fieldPath: mf.name,
          versionId: newVersion.id,
        }).onConflictDoNothing();
      }
    }
  }

  return { ...doc, locale: loc, version: newVersion.version, data: newVersion.data, schemaVersion: newVersion.schemaVersion };
}

export async function deleteDocument(id: string) {
  const db = getDb();
  await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
  return true;
}

export async function getVersionHistory(id: string, locale?: string) {
  const db = getDb();
  const loc = locale ?? (await getDefaultLocale(db));
  const versions = await db.select().from(documentVersions).where(
    and(eq(documentVersions.documentId, id), eq(documentVersions.locale, loc))
  );
  return versions.sort((a, b) => b.version - a.version);
}

export async function restoreVersion(id: string, version: number, locale?: string, createdBy?: string) {
  const db = getDb();
  const loc = locale ?? (await getDefaultLocale(db));

  const [oldVersion] = await db.select().from(documentVersions).where(
    and(eq(documentVersions.documentId, id), eq(documentVersions.locale, loc), eq(documentVersions.version, version))
  );
  if (!oldVersion) throw new Error("Version not found");

  const versions = await db.select().from(documentVersions).where(
    and(eq(documentVersions.documentId, id), eq(documentVersions.locale, loc))
  );
  const maxVersion = versions.reduce((max, v) => Math.max(max, v.version), 0);

  const [newVersion] = await db.insert(documentVersions).values({
    documentId: id,
    locale: loc,
    version: maxVersion + 1,
    status: "draft",
    data: oldVersion.data,
    schemaVersion: oldVersion.schemaVersion,
    slug: oldVersion.slug,
    createdBy: createdBy ?? null,
  }).returning();
  if (!newVersion) throw new Error("Failed to create version");

  await db.update(documentLocales).set({
    draftVersionId: newVersion.id,
    updatedAt: new Date(),
  }).where(and(eq(documentLocales.documentId, id), eq(documentLocales.locale, loc)));

  return { version: newVersion.version, data: newVersion.data };
}
