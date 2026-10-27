import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema-uuid.ts",
  out: "./drizzle-uuid",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
