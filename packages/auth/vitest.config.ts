import { defineConfig } from "vitest/config";

// Default test env: the local `peggy_test` database — never the dev `peggy`
// DB, because DB-backed tests wipe tables in beforeEach. Every value can be
// overridden from the real environment (e.g. CI pointing DATABASE_URL at its
// postgres service DB).
const testEnv: Record<string, string> = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://peggy:peggy@localhost:5432/peggy_test",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "peggy-test-secret-min-32-chars-long!",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ADMIN_URL: process.env.ADMIN_URL ?? "http://localhost:3001",
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? "http://localhost:3001",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? "localhost",
};

export default defineConfig({
  test: {
    fileParallelism: false,
    sequence: { concurrent: false },
    // Stale compiled copies under dist/ must never run as tests.
    exclude: ["**/dist/**", "**/node_modules/**"],
    env: testEnv,
  },
});
