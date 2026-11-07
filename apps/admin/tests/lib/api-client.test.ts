import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ApiRequestError,
  confirmUpload,
  createComponent,
  createComponentField,
  createContentType,
  createContentTypeField,
  createDocument,
  deleteAsset,
  deleteComponent,
  deleteComponentField,
  deleteContentType,
  deleteContentTypeField,
  getComponent,
  getContentType,
  listAssets,
  listDocuments,
  publishDocument,
  signUpload,
  myPermissions,
  updateComponent,
  updateComponentField,
  updateContentType,
  updateField,
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

describe("registry mutations (builder foundation)", () => {
  it("creates a content type via POST /content-types", async () => {
    const mock = mockFetchOnce(201, { id: "ct1", name: "post", kind: "collection" });
    const out = await createContentType({ name: "post", kind: "collection", collectionSlug: "posts" });
    expect(out).toMatchObject({ id: "ct1" });
    expect(mock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "post", collectionSlug: "posts" });
  });

  it("updates a content type via PUT /content-types/:id", async () => {
    const mock = mockFetchOnce(200, { id: "ct1", displayName: "Posts" });
    await updateContentType("ct1", { displayName: "Posts" });
    expect(mock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("deletes a content type via DELETE, appending ?force=true only when forced", async () => {
    const plain = mockFetchOnce(204, null);
    await deleteContentType("ct1");
    expect(plain).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1",
      expect.objectContaining({ method: "DELETE" }),
    );
    const forced = mockFetchOnce(204, null);
    await deleteContentType("ct1", true);
    expect(forced).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1?force=true",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("reads a single content type and component", async () => {
    mockFetchOnce(200, { id: "ct1", fields: [] });
    await expect(getContentType("ct1")).resolves.toMatchObject({ id: "ct1" });
    mockFetchOnce(200, { id: "c1", fields: [] });
    await expect(getComponent("c1")).resolves.toMatchObject({ id: "c1" });
  });

  it("creates/updates components via POST/PUT /components", async () => {
    const post = mockFetchOnce(201, { id: "c1", name: "seo" });
    await createComponent({ name: "seo" });
    expect(post).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components",
      expect.objectContaining({ method: "POST" }),
    );
    const put = mockFetchOnce(200, { id: "c1" });
    await updateComponent("c1", { displayName: "SEO" });
    expect(put).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components/c1",
      expect.objectContaining({ method: "PUT" }),
    );
    const del = mockFetchOnce(204, null);
    await deleteComponent("c1");
    expect(del).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components/c1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("creates content-type and component fields via their POST endpoints", async () => {
    const ct = mockFetchOnce(201, { id: "f1", name: "title", fieldType: "text" });
    await createContentTypeField("ct1", { name: "title", fieldType: "text" });
    expect(ct).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1/fields",
      expect.objectContaining({ method: "POST" }),
    );
    const comp = mockFetchOnce(201, { id: "f2", name: "meta", fieldType: "text" });
    await createComponentField("c1", { name: "meta", fieldType: "text" });
    expect(comp).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components/c1/fields",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updates/deletes content-type and component fields via their nested endpoints", async () => {
    const putCt = mockFetchOnce(200, { id: "f1", label: "Title" });
    await updateField("ct1", "f1", { label: "Title" });
    expect(putCt).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1/fields/f1",
      expect.objectContaining({ method: "PUT" }),
    );
    const delCt = mockFetchOnce(204, null);
    await deleteContentTypeField("ct1", "f1");
    expect(delCt).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/content-types/ct1/fields/f1",
      expect.objectContaining({ method: "DELETE" }),
    );
    const putComp = mockFetchOnce(200, { id: "f2", label: "Meta" });
    await updateComponentField("c1", "f2", { label: "Meta" });
    expect(putComp).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components/c1/fields/f2",
      expect.objectContaining({ method: "PUT" }),
    );
    const delComp = mockFetchOnce(204, null);
    await deleteComponentField("c1", "f2");
    expect(delComp).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/components/c1/fields/f2",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces 422 reserved-name errors from field creation", async () => {
    mockFetchOnce(422, { error: "Reserved field name: id" });
    await expect(
      createContentTypeField("ct1", { name: "id", fieldType: "text" }),
    ).rejects.toMatchObject({ status: 422, message: "Reserved field name: id" });
  });
});
