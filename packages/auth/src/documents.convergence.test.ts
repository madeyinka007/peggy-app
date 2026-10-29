import { describe, it, expect } from "vitest";

describe("documents convergence", () => {
  it("module exports createDocument", async () => {
    const mod = await import("./documents.js");
    expect(typeof mod.createDocument).toBe("function");
  });
});
