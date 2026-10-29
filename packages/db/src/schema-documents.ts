import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, index, unique, check, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./schema-auth.js";
import { contentTypes } from "./schema-content-types.js";

export const locales = pgTable(
  "locales",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    direction: text("direction").default("ltr").notNull(),
    fallbackChain: text("fallback_chain").array().default(sql`'{}'::text[]`).notNull(),
  },
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().unique(),
    contentTypeId: uuid("content_type_id").notNull().references(() => contentTypes.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("documents_content_type_idx").on(table.contentTypeId, table.createdAt),
    index("documents_deleted_at_idx").on(table.deletedAt),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("draft"),
    data: jsonb("data").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    slug: text("slug"),
    publishedAtSnapshot: timestamp("published_at_snapshot"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("document_versions_doc_locale_version_unique").on(table.documentId, table.locale, table.version),
    index("document_versions_doc_locale_idx").on(table.documentId, table.locale, table.createdAt),
    check("document_versions_status_check", sql`${table.status} IN ('draft', 'published', 'in_review', 'scheduled', 'archived')`),
    check("document_versions_data_check", sql`jsonb_typeof(${table.data}) = 'object'`),
  ],
);

export const documentLocales = pgTable(
  "document_locales",
  {
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().references(() => locales.code, { onDelete: "restrict" }),
    draftVersionId: uuid("draft_version_id").references(() => documentVersions.id, { onDelete: "set null" }),
    publishedVersionId: uuid("published_version_id").references(() => documentVersions.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at"),
    firstPublishedAt: timestamp("first_published_at"),
    scheduledAt: timestamp("scheduled_at"),
    scheduledVersionId: uuid("scheduled_version_id").references(() => documentVersions.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.locale] }),
    check("document_locales_draft_ne_published", sql`${table.draftVersionId} IS DISTINCT FROM ${table.publishedVersionId}`),
  ],
);

// Add composite PK via raw SQL in migration since drizzle doesn't support easily
// We'll handle this in the migration file

export const documentRelations = pgTable(
  "document_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceDocumentId: uuid("source_document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    targetDocumentId: uuid("target_document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    relationField: text("relation_field").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

// Relations
export const documentsRelations = relations(documents, ({ many }) => ({
  locales: many(documentLocales),
  versions: many(documentVersions),
  relations: many(documentRelations),
}));

export const documentLocalesRelations = relations(documentLocales, ({ one }) => ({
  document: one(documents, { fields: [documentLocales.documentId], references: [documents.id] }),
  draftVersion: one(documentVersions, { fields: [documentLocales.draftVersionId], references: [documentVersions.id] }),
  publishedVersion: one(documentVersions, { fields: [documentLocales.publishedVersionId], references: [documentVersions.id] }),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
}));
