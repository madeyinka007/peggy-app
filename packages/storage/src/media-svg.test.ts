import { describe, it, expect, afterEach } from "vitest";
import { MediaService } from "./media-service.js";
import type { StorageProvider } from "./provider.js";

// Stub provider: policy rejections must fire before any provider or DB
// call, so these throw if the service ever reaches past the gate.
const stubProvider: StorageProvider = {
  async signUpload() { throw new Error("provider.signUpload must not be reached for SVG"); },
  async verifyAsset() { return { exists: true, mime: "image/svg+xml", sizeBytes: 128 }; },
  transformUrl() { return "https://example.com/t"; },
  async destroy() {},
};

function service() {
  // The SVG reject path fires before any DB access, so no client is needed.
  return new MediaService({} as never, stubProvider);
}

afterEach(() => {
  delete process.env.CLOUDINARY_ALLOW_SVG;
});

// T055: SVG is always rejected (stored XSS). The former
// CLOUDINARY_ALLOW_SVG escape hatch was removed — setting it must not
// re-enable uploads.
describe("SVG hard-reject (T055)", () => {
  it("signUpload rejects image/svg+xml", async () => {
    await expect(
      service().signUpload({ filename: "x.svg", mime: "image/svg+xml", sizeBytes: 128 }),
    ).rejects.toThrow(/MIME_NOT_ALLOWED/);
  });

  it("signUpload rejects even with CLOUDINARY_ALLOW_SVG=true (hatch removed)", async () => {
    process.env.CLOUDINARY_ALLOW_SVG = "true";
    await expect(
      service().signUpload({ filename: "x.svg", mime: "image/svg+xml", sizeBytes: 128 }),
    ).rejects.toThrow(/MIME_NOT_ALLOWED/);
  });

  it("confirmUpload rejects SVG against the verified MIME", async () => {
    await expect(
      service().confirmUpload({ providerKey: "k", mime: "image/svg+xml", sizeBytes: 128 }),
    ).rejects.toThrow(/MIME_NOT_ALLOWED/);
  });

  it("replaceAsset rejects SVG", async () => {
    await expect(
      service().replaceAsset("old-id", {
        providerKey: "k",
        policy: "update-references",
        mime: "image/svg+xml",
        sizeBytes: 128,
      }),
    ).rejects.toThrow(/MIME_NOT_ALLOWED/);
  });

  it("non-SVG images still pass the policy gate to the provider", async () => {
    const okProvider: StorageProvider = {
      ...stubProvider,
      async signUpload() { return { url: "https://example.com/sign", params: {} }; },
    };
    const out = await new MediaService({} as never, okProvider).signUpload({
      filename: "x.png",
      mime: "image/png",
      sizeBytes: 128,
    });
    expect(out.url).toBe("https://example.com/sign");
  });
});
