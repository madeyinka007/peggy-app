import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { documents, documentVersions, documentLocales, locales } from "@peggy/db";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

export async function publishDocument(documentId: string, locale?: string) {
  const db = getDb();
  const loc = locale ?? (await (async () => {
    const rows = await db.select().from(locales).where(eq(locales.isDefault, true));
    return rows[0]?.code ?? "en";
  })());

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw new Error("Document not found");
  if (doc.deletedAt) throw new Error("Document is deleted");

  const [dl] = await db.select().from(documentLocales).where(
    and(eq(documentLocales.documentId, documentId), eq(documentLocales.locale, loc))
  );
  if (!dl || !dl.draftVersionId) throw new Error("No draft version to publish");

  const [dv] = await db.select().from(documentVersions).where(eq(documentVersions.id, dl.draftVersionId));
  if (!dv) throw new Error("Draft version not found");

  // Slug uniqueness check for published content
  if (dv.slug) {
    const existing = await db.select().from(documentLocales).innerJoin(
      documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id)
    );
    for (const row of existing) {
      const pubDv = (row as { document_versions?: { slug?: string; locale?: string; documentId?: string } }).document_versions;
      if (pubDv?.slug === dv.slug && pubDv?.locale === loc && pubDv?.documentId !== documentId) {
        throw new Error("Slug conflict: a published document with this slug already exists");
      }
    }
  }

  const now = new Date();
  const updatedRows = await db.update(documentLocales).set({
    publishedVersionId: dl.draftVersionId,
    publishedAt: now,
    firstPublishedAt: dl.firstPublishedAt ?? now,
    updatedAt: now,
  }).where(and(
    eq(documentLocales.documentId, documentId),
    eq(documentLocales.locale, loc),
    eq(documentLocales.draftVersionId, dl.draftVersionId),
  )).returning();
  if (updatedRows.length === 0) throw new Error("Conflict: draft pointer changed concurrently");

  const [updated] = await db.select().from(documentLocales).where(
    and(eq(documentLocales.documentId, documentId), eq(documentLocales.locale, loc))
  );
  if (!updated) throw new Error("Failed to update locale");
  return { documentId, locale: loc, publishedVersionId: updated.publishedVersionId, publishedAt: updated.publishedAt, firstPublishedAt: updated.firstPublishedAt };
}

export async function unpublishDocument(documentId: string, locale: string) {
  const db = getDb();

  const [dl] = await db.select().from(documentLocales).where(
    and(eq(documentLocales.documentId, documentId), eq(documentLocales.locale, locale))
  );
  if (!dl) throw new Error("Locale not found");

  await db.update(documentLocales).set({
    publishedVersionId: null,
    publishedAt: null,
    updatedAt: new Date(),
  }).where(and(eq(documentLocales.documentId, documentId), eq(documentLocales.locale, locale)));

  return { documentId, locale, publishedVersionId: null };
}
