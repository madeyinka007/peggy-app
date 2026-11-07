import { describe, it, expect } from "vitest";
import { MediaService } from "./media-service.js";
import type { StorageProvider } from "./provider.js";

// deliveryUrl() reads cfg() (CLOUDINARY_CLOUD_NAME via parseConfig), which
// requires the base env even though these are pure unit tests. Provide the
// same minimal defaults a dev shell would have from .env.development.
process.env.DATABASE_URL ??= "postgres://peggy:peggy@localhost:5432/peggy_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-that-is-at-least-32-chars";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.ADMIN_URL ??= "http://localhost:3001";
process.env.CORS_ORIGINS ??= "http://localhost:3001";
process.env.COOKIE_DOMAIN ??= "localhost";

// Provider stub: key is always live so confirm reaches the DB branch.
const stubProvider: StorageProvider = {
  async signUpload() { throw new Error("provider.signUpload must not be reached"); },
  async verifyAsset() { return { exists: true, mime: "image/png", sizeBytes: 100 }; },
  transformUrl() { return "https://example.com/t"; },
  async destroy() {},
};

interface Seen {
  inserted: boolean;
  patched: unknown;
}

/**
 * Minimal chainable stand-in for the drizzle client. MediaService only uses
 * select().from().where(), update().set().where().returning() and
 * insert().values().returning(), so a structural fake is enough to pin the
 * delete-then-reupload branching without a database.
 */
function fakeDb(existing: Record<string, unknown> | null, seen: Seen) {
  return {
    select: () => ({ from: () => ({ where: async () => (existing ? [existing] : []) }) }),
    update: () => ({
      set: (patch: unknown) => ({
        where: () => ({
          returning: async () => {
            seen.patched = patch;
            return [{ ...existing, ...(patch as Record<string, unknown>) }];
          },
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => {
          seen.inserted = true;
          return [{ id: "new-id", providerKey: "k" }];
        },
      }),
    }),
  };
}

function service(existing: Record<string, unknown> | null, seen: Seen) {
  return new MediaService(fakeDb(existing, seen) as never, stubProvider);
}

// Delete-then-reupload: the soft-deleted row holds the (provider,
// providerKey) unique slot, so confirm must resurrect it instead of
// inserting (which would hit the unique constraint → 409).
describe("confirmUpload delete-then-reupload", () => {
  it("resurrects a soft-deleted row with the same providerKey", async () => {
    const seen: Seen = { inserted: false, patched: null };
    const svc = service(
      { id: "old-id", provider: "cloudinary", providerKey: "k", deletedAt: new Date("2026-01-01") },
      seen,
    );
    const out = await svc.confirmUpload({ providerKey: "k", mime: "image/png", sizeBytes: 100 });
    expect(seen.inserted).toBe(false);
    expect(seen.patched).toMatchObject({ deletedAt: null });
    expect(out).toMatchObject({ id: "old-id", deletedAt: null });
    expect(out).toHaveProperty("transformUrls");
  });

  it("still rejects a live duplicate with PROVIDER_KEY_CONFLICT", async () => {
    const seen: Seen = { inserted: false, patched: null };
    const svc = service(
      { id: "live-id", provider: "cloudinary", providerKey: "k", deletedAt: null },
      seen,
    );
    await expect(
      svc.confirmUpload({ providerKey: "k", mime: "image/png", sizeBytes: 100 }),
    ).rejects.toThrow(/PROVIDER_KEY_CONFLICT/);
    expect(seen.inserted).toBe(false);
    expect(seen.patched).toBeNull();
  });

  it("inserts when no row holds the key", async () => {
    const seen: Seen = { inserted: false, patched: null };
    const svc = service(null, seen);
    const out = await svc.confirmUpload({ providerKey: "k", mime: "image/png", sizeBytes: 100 });
    expect(seen.inserted).toBe(true);
    expect(out).toMatchObject({ id: "new-id" });
  });
});
