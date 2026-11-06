import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ApiRequestError,
  confirmUpload,
  createDocument,
  deleteAsset,
  listAssets,
  listDocuments,
  publishDocument,
  signUpload,
  myPermissions,
} from "@/lib/api-client";

function mockFetchOnce(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
});

describe("envelope parsing", () => {
  it("wraps { data } lists and passes credentials", async () => {
    const mock = mockFetchOnce(200, { data: [{ id: "1" }] });
    const out = await listDocuments("ct-posts", "en");
    expect(out.data).toHaveLength(1);
    expect(mock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/documents?contentTypeId=ct-posts&locale=en",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("parses string error bodies", async () => {
    mockFetchOnce(400, { error: "Missing required field: title" });
    await expect(createDocument({ contentTypeId: "x", data: {} })).rejects.toMatchObject({
      status: 400,
      message: "Missing required field: title",
    });
  });

  it("parses coded error objects incl. MEDIA_REFERENCED references", async () => {
    mockFetchOnce(409, {
      error: { code: "MEDIA_REFERENCED", message: "Asset is referenced", references: [{ id: "d1" }] },
    });
    const err: unknown = await deleteAsset("a1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      status: 409,
      code: "MEDIA_REFERENCED",
      references: [{ id: "d1" }],
    });
  });

  it("parses FILE_TOO_LARGE limit/received details", async () => {
    mockFetchOnce(422, {
      error: { code: "FILE_TOO_LARGE", message: "too big", limit: 5_000_000, received: 50_000_000 },
    });
    const err: unknown = await signUpload({ filename: "v.mp4", mime: "video/mp4", sizeBytes: 50_000_000 }).catch(
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ status: 422, code: "FILE_TOO_LARGE", limit: 5_000_000, received: 50_000_000 });
  });

  it("parses 422 policy errors on confirm", async () => {
    mockFetchOnce(422, { error: { code: "MIME_NOT_ALLOWED", message: "image/svg+xml blocked" } });
    await expect(
      confirmUpload({ providerKey: "k", mime: "image/svg+xml", sizeBytes: 10 }),
    ).rejects.toMatchObject({ status: 422, code: "MIME_NOT_ALLOWED" });
  });

  it("returns requestId when the envelope provides one", async () => {
    mockFetchOnce(500, { error: "boom", requestId: "req-123" });
    const err: unknown = await publishDocument("d1", "en").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 500, requestId: "req-123" });
  });

  it("resolves media pagination meta", async () => {
    mockFetchOnce(200, { data: [], meta: { page: 2, pageSize: 25 } });
    const out = await listAssets({ page: 2 });
    expect(out.meta).toEqual({ page: 2, pageSize: 25 });
  });

  it("myPermissions returns null when the read chain is absent (progressive disclosure)", async () => {
    mockFetchOnce(404, { error: "Not found" });
    await expect(myPermissions("u1")).resolves.toBeNull();
  });

  it("throws a network ApiRequestError when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(listDocuments("x")).rejects.toMatchObject({ status: 0 });
  });
});
