import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, index, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./schema-auth.js";

export const contentTypes = pgTable(
  "content_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    kind: text("kind").notNull(),
    collectionSlug: text("collection_slug").notNull().unique(),
    displayName: text("display_name"),
    description: text("description"),
    isLocalized: boolean("is_localized").default(false).notNull(),
    hasDraftPublish: boolean("has_draft_publish").default(true).notNull(),
    activeSchemaVersion: integer("active_schema_version").default(1).notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("content_types_kind_idx").on(table.kind),
    check("content_types_kind_check", sql`${table.kind} IN ('collection', 'single')`),
    check("content_types_slug_check", sql`${table.collectionSlug} ~ '^[a-z0-9-]+$'`),
  ],
);

export const components = pgTable(
  "components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    displayName: text("display_name"),
    category: text("category"),
    activeSchemaVersion: integer("active_schema_version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
);

export const contentFields = pgTable(
  "content_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentTypeId: uuid("content_type_id").references(() => contentTypes.id, { onDelete: "cascade" }),
    componentId: uuid("component_id").references(() => components.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    label: text("label"),
    fieldType: text("field_type").notNull(),
    required: boolean("required").default(false).notNull(),
    uniqueScope: text("unique_scope"),
    defaultValue: jsonb("default_value"),
    localized: boolean("localized").default(false).notNull(),
    searchable: boolean("searchable").default(false).notNull(),
    indexedHint: boolean("indexed_hint").default(false).notNull(),
    validation: jsonb("validation").default(sql`'{}'::jsonb`).notNull(),
    relationConfig: jsonb("relation_config"),
    componentConfig: jsonb("component_config"),
    dynamiczoneConfig: jsonb("dynamiczone_config"),
    mediaConfig: jsonb("media_config"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("content_fields_content_type_idx").on(table.contentTypeId),
    index("content_fields_component_idx").on(table.componentId),
    unique("content_fields_content_type_name_unique").on(table.contentTypeId, table.name),
    unique("content_fields_component_name_unique").on(table.componentId, table.name),
    check("content_fields_owner_check", sql`(${table.contentTypeId} IS NULL) <> (${table.componentId} IS NULL)`),
  ],
);

export const schemaVersions = pgTable(
  "schema_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerKind: text("owner_kind").notNull(),
    ownerId: uuid("owner_id").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("schema_versions_owner_version_unique").on(table.ownerKind, table.ownerId, table.version),
  ],
);

// Relations
export const contentTypesRelations = relations(contentTypes, ({ many }) => ({
  fields: many(contentFields),
}));

export const componentsRelations = relations(components, ({ many }) => ({
  fields: many(contentFields),
}));

export const contentFieldsRelations = relations(contentFields, ({ one }) => ({
  contentType: one(contentTypes, { fields: [contentFields.contentTypeId], references: [contentTypes.id] }),
  component: one(components, { fields: [contentFields.componentId], references: [components.id] }),
}));
