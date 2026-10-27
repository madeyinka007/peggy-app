import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";

// Rate-limit counters (Constitution VI): persist in Postgres so brute-force
// protection survives stateless scale-out (never in process memory).
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    windowStart: timestamp("window_start").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [index("rate_limits_window_idx").on(table.windowStart)],
);
