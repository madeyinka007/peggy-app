import { defineConfig } from "vitest/config";

// The smoke test requires DATABASE_URL; default to the local `peggy_test`
// database — never the dev `peggy` DB. Overridable from the environment
// (e.g. CI pointing at its postgres service DB).
export default defineConfig({
  test: {
    // Stale compiled copies under dist/ must never run as tests (the smoke
    // test uses Date.now() keys, so a src+dist double-run collides on the
    // same row and both copies fail).
    exclude: ["**/dist/**", "**/node_modules/**"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://peggy:peggy@localhost:5432/peggy_test",
    },
  },
});
