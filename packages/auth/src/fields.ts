import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { contentFields, contentTypes, components, schemaVersions } from "@peggy/db";
import { isReservedFieldName } from "./content-types.js";

const VALID_FIELD_TYPES = new Set([
  "text", "richtext", "markdown", "number", "boolean", "date", "datetime",
  "time", "json", "email", "uid", "enumeration", "media", "relation",
  "component", "dynamiczone",
]);

export function isValidFieldType(ft: string): boolean {
  return VALID_FIELD_TYPES.has(ft);
}

export async function createField(data: {
  contentTypeId?: string;
  componentId?: string;
  name: string;
  label?: string;
  fieldType: string;
  required?: boolean;
  uniqueScope?: string | null;
  defaultValue?: unknown;
  localized?: boolean;
  searchable?: boolean;
  indexedHint?: boolean;
  validation?: Record<string, unknown>;
  relationConfig?: Record<string, unknown> | null;
  componentConfig?: Record<string, unknown> | null;
  dynamiczoneConfig?: Record<string, unknown> | null;
  mediaConfig?: Record<string, unknown> | null;
  sortOrder?: number;
}) {
  if (isReservedFieldName(data.name)) {
    throw new Error(`Reserved field name: ${data.name}`);
  }
  if (!isValidFieldType(data.fieldType)) {
    throw new Error(`Invalid field type: ${data.fieldType}`);
  }

  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();

  const [field] = await db.insert(contentFields).values({
    contentTypeId: data.contentTypeId ?? null,
    componentId: data.componentId ?? null,
    name: data.name,
    label: data.label ?? null,
    fieldType: data.fieldType,
    required: data.required ?? false,
    uniqueScope: data.uniqueScope ?? null,
    defaultValue: data.defaultValue ?? null,
    localized: data.localized ?? false,
    searchable: data.searchable ?? false,
    indexedHint: data.indexedHint ?? false,
    validation: data.validation ?? {},
    relationConfig: data.relationConfig ?? null,
    componentConfig: data.componentConfig ?? null,
    dynamiczoneConfig: data.dynamiczoneConfig ?? null,
    mediaConfig: data.mediaConfig ?? null,
    sortOrder: data.sortOrder ?? 0,
  }).returning();

  // Bump schema version
  await bumpSchemaVersion(data.contentTypeId, data.componentId);

  return field;
}

async function bumpSchemaVersion(contentTypeId?: string, componentId?: string) {
  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();

  let ownerKind: string;
  let ownerId: string;
  let currentVersion: number;

  if (contentTypeId) {
    ownerKind = "content_type";
    ownerId = contentTypeId;
    const [ct] = await db.select().from(contentTypes).where(eq(contentTypes.id, contentTypeId));
    if (!ct) return;
    currentVersion = ct.activeSchemaVersion;
    await db.update(contentTypes).set({ activeSchemaVersion: currentVersion + 1, updatedAt: new Date() }).where(eq(contentTypes.id, contentTypeId));
  } else if (componentId) {
    ownerKind = "component";
    ownerId = componentId;
    const [comp] = await db.select().from(components).where(eq(components.id, componentId));
    if (!comp) return;
    currentVersion = comp.activeSchemaVersion;
    await db.update(components).set({ activeSchemaVersion: currentVersion + 1, updatedAt: new Date() }).where(eq(components.id, componentId));
  } else {
    return;
  }

  // Create schema version snapshot
  const fields = await db.select().from(contentFields).where(
    contentTypeId
      ? eq(contentFields.contentTypeId, contentTypeId)
      : eq(contentFields.componentId, componentId!)
  );

  await db.insert(schemaVersions).values({
    ownerKind,
    ownerId,
    version: currentVersion + 1,
    snapshot: { fields: fields.map(f => ({ name: f.name, type: f.fieldType })) },
  });
}

export async function getFields(contentTypeId?: string, componentId?: string) {
  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();
  if (contentTypeId) {
    return db.select().from(contentFields).where(eq(contentFields.contentTypeId, contentTypeId)).orderBy(contentFields.sortOrder);
  }
  if (componentId) {
    return db.select().from(contentFields).where(eq(contentFields.componentId, componentId)).orderBy(contentFields.sortOrder);
  }
  return [];
}

export async function getField(id: string) {
  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();
  const [f] = await db.select().from(contentFields).where(eq(contentFields.id, id));
  return f ?? null;
}

export async function updateField(id: string, data: Record<string, unknown>) {
  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();
  const [f] = await db.update(contentFields).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(contentFields.id, id)).returning();

  if (f) {
    await bumpSchemaVersion(f.contentTypeId ?? undefined, f.componentId ?? undefined);
  }
  return f ?? null;
}

export async function deleteField(id: string) {
  const db = ((): ReturnType<typeof drizzle> => {
    const config = parseConfig();
    const client = createDbClient(config.DATABASE_URL);
    return client.db as ReturnType<typeof drizzle>;
  })();
  const [f] = await db.select().from(contentFields).where(eq(contentFields.id, id));
  if (!f) return null;
  // Deprecate rather than drop
  await db.update(contentFields).set({ updatedAt: new Date() }).where(eq(contentFields.id, id));
  await bumpSchemaVersion(f.contentTypeId ?? undefined, f.componentId ?? undefined);
  return f;
}
