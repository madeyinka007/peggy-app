import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { user } from "./schema-auth.js";

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hashedToken: text("hashed_token").notNull().unique(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("api_tokens_userId_idx").on(table.userId)],
);

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(user, { fields: [apiTokens.userId], references: [user.id] }),
}));
