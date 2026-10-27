import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "/Users/mac/Documents/peggy-app/packages/db/src/schema.ts",
  out: "/Users/mac/Documents/peggy-app/packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: "postgres://peggy:peggy@localhost:5432/peggy_slice1" },
});
