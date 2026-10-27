import { describe, it, expect } from "vitest";
import { evaluatePermission, clearPermissionCache } from "./rbac.js";

describe("evaluatePermission (pure evaluator — no DB)", () => {
  it("denies when user has no perms", () => {
    expect(evaluatePermission([], "content-type", "read", "u1")).toBe(false);
  });

  it("allows exact match", () => {
    expect(evaluatePermission(["content-type.read"], "content-type", "read", "u1")).toBe(true);
  });

  it("denies when only a different action/resource is held", () => {
    expect(evaluatePermission(["content-type.read"], "content-type", "delete", "u1")).toBe(false);
    expect(evaluatePermission(["content-type.read"], "document", "read", "u1")).toBe(false);
  });

  it("owner-only: different owner returns false", () => {
    expect(evaluatePermission(["document.delete"], "document", "delete", "u1", "u2")).toBe(false);
  });

  it("owner-only: matching owner returns true", () => {
    expect(evaluatePermission(["document.delete"], "document", "delete", "u1", "u1")).toBe(true);
  });

  it("ownerId undefined — non-owner check not applied", () => {
    expect(evaluatePermission(["document.delete"], "document", "delete", "u1", undefined)).toBe(true);
  });

  it("multiple perms — any match passes", () => {
    expect(evaluatePermission(["content-type.read", "document.read"], "document", "read", "u1")).toBe(true);
  });

  it("empty ownerId string treated as set -> denies non-matching", () => {
    expect(evaluatePermission(["document.delete"], "document", "delete", "u1", "")).toBe(false);
  });
});

describe("clearPermissionCache", () => {
  it("does not throw when clearing unknown user or all entries", () => {
    expect(() => clearPermissionCache("no-such")).not.toThrow();
    expect(() => clearPermissionCache()).not.toThrow();
  });
});

