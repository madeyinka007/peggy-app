import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Stale compiled copies under dist/ must never run as tests.
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
