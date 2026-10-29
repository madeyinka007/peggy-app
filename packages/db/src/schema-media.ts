import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, index, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./schema-auth.js";

export const mediaFolders = pgTable(
  "media_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    path: text("path").notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    unique("media_folders_parent_name_unique").on(table.parentId, table.name),
    unique("media_folders_path_unique").on(table.path),
    index("media_folders_path_idx").using("btree", sql`${table.path} text_pattern_ops`),
    // check("media_folders_no_self_parent", sql`${table.id} <> ${table.parentId}`) — self-ref FK handled via raw SQL in migration,
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("cloudinary"),
    providerKey: text("provider_key").notNull(),
    url: text("url").notNull(),
    secureUrl: text("secure_url").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationS: integer("duration_s"),
    hashSha256: text("hash_sha256"),
    folderId: uuid("folder_id").references(() => mediaFolders.id, { onDelete: "set null" }),
    alt: text("alt"),
    caption: text("caption"),
    variants: jsonb("variants").default(sql`'[]'::jsonb`).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    unique("media_assets_provider_key_unique").on(table.provider, table.providerKey),
    index("media_assets_folder_idx").on(table.folderId),
    index("media_assets_mime_idx").using("btree", sql`${table.mime} text_pattern_ops`),
    index("media_assets_hash_idx").on(table.hashSha256),
    index("media_assets_not_deleted_idx").on(table.deletedAt).where(sql`${table.deletedAt} IS NULL`),
    check("media_assets_size_check", sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 104857600`),
    check("media_assets_mime_check", sql`${table.mime} ~ '^.+/.+$'`),
  ],
);

export const mediaUsage = pgTable(
  "media_usage",
  {
    assetId: uuid("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(),
    locale: text("locale").notNull(),
    fieldPath: text("field_path").notNull(),
    versionId: uuid("version_id"),
  },
  (table) => [
    index("media_usage_document_locale_idx").on(table.documentId, table.locale),
    index("media_usage_asset_idx").on(table.assetId),
  ],
);

export const mediaFoldersRelations = relations(mediaFolders, ({ one, many }) => ({
  parent: one(mediaFolders, { fields: [mediaFolders.parentId], references: [mediaFolders.id] }),
  children: many(mediaFolders),
  assets: many(mediaAssets),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  folder: one(mediaFolders, { fields: [mediaAssets.folderId], references: [mediaFolders.id] }),
  uploader: one(user, { fields: [mediaAssets.uploadedBy], references: [user.id] }),
}));
