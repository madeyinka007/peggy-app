import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { contentTypes, schemaVersions } from "@peggy/db";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

const RESERVED_FIELD_NAMES = new Set([
  "id", "documentId", "__component", "createdAt", "updatedAt",
  "publishedAt", "locale", "contentTypeId", "componentId",
  "activeSchemaVersion", "createdBy",
]);

export function isReservedFieldName(name: string): boolean {
  return RESERVED_FIELD_NAMES.has(name);
}

export async function createContentType(data: {
  name: string;
  kind: "collection" | "single";
  collectionSlug: string;
  displayName?: string;
  description?: string;
  isLocalized?: boolean;
  hasDraftPublish?: boolean;
  createdBy?: string;
}) {
  const db = getDb();
  const [ct] = await db.insert(contentTypes).values({
    name: data.name,
    kind: data.kind,
    collectionSlug: data.collectionSlug,
    displayName: data.displayName ?? null,
    description: data.description ?? null,
    isLocalized: data.isLocalized ?? false,
    hasDraftPublish: data.hasDraftPublish ?? true,
    createdBy: data.createdBy ?? null,
  }).returning();
  if (!ct) throw new Error("Failed to create content type");

  // Create schema version 1
  await db.insert(schemaVersions).values({
    ownerKind: "content_type",
    ownerId: ct.id,
    version: 1,
    snapshot: { fields: [] },
  });

  return ct;
}

export async function getContentType(id: string) {
  const db = getDb();
  const [ct] = await db.select().from(contentTypes).where(eq(contentTypes.id, id));
  return ct ?? null;
}

export async function listContentTypes() {
  const db = getDb();
  return db.select().from(contentTypes);
}

export async function updateContentType(id: string, data: {
  name?: string;
  displayName?: string;
  description?: string;
  isLocalized?: boolean;
  hasDraftPublish?: boolean;
}) {
  const db = getDb();
  const [ct] = await db.update(contentTypes).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(contentTypes.id, id)).returning();
  return ct ?? null;
}

export async function deleteContentType(id: string, _force = false) {
  const db = getDb();
  // Soft-block: check if documents exist (Slice 3 will add document count check)
  // For now, allow delete
  await db.delete(contentTypes).where(eq(contentTypes.id, id));
  return true;
}

export async function getSchemaVersions(ownerKind: string, ownerId: string) {
  const db = getDb();
  return db.select().from(schemaVersions).where(
    and(eq(schemaVersions.ownerKind, ownerKind), eq(schemaVersions.ownerId, ownerId))
  );
}
