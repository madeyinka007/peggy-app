import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { components, contentFields } from "@peggy/db";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

export async function createComponent(data: {
  name: string;
  displayName?: string;
  category?: string;
}) {
  const db = getDb();
  const [comp] = await db.insert(components).values({
    name: data.name,
    displayName: data.displayName ?? null,
    category: data.category ?? null,
  }).returning();
  if (!comp) throw new Error("Failed to create component");

  // Create schema version 1
  const { schemaVersions } = await import("@peggy/db");
  await db.insert(schemaVersions).values({
    ownerKind: "component",
    ownerId: comp.id,
    version: 1,
    snapshot: { fields: [] },
  });

  return comp;
}

export async function getComponent(id: string) {
  const db = getDb();
  const [comp] = await db.select().from(components).where(eq(components.id, id));
  return comp ?? null;
}

export async function listComponents() {
  const db = getDb();
  return db.select().from(components);
}

export async function updateComponent(id: string, data: { displayName?: string; category?: string }) {
  const db = getDb();
  const [comp] = await db.update(components).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(components.id, id)).returning();
  return comp ?? null;
}

export async function deleteComponent(id: string) {
  const db = getDb();
  // Soft-block: check if referenced by fields (direct componentId FK or componentConfig JSONB)
  const directRefs = await db.select().from(contentFields).where(eq(contentFields.componentId, id));
  const allFields = await db.select().from(contentFields);
  const configRefs = allFields.filter((f) => {
    const cfg = f.componentConfig as { componentId?: string } | null;
    return cfg?.componentId === id;
  });
  if (directRefs.length > 0 || configRefs.length > 0) {
    throw new Error("Component is referenced by fields");
  }
  await db.delete(components).where(eq(components.id, id));
  return true;
}
