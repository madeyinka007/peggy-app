/**
 * Upload state-machine + error-mapping tests (T026/US2). No network: the
 * pre-check and FR-009 mapper are pure functions; the XHR transfer is
 * exercised through the component with mocked api-client calls.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDropzone } from "@/components/UploadDropzone";
import {
  allowedMime,
  humanUploadMessage,
  maxForMime,
  precheckFile,
} from "@/lib/upload-machine";
import { ApiRequestError } from "@/lib/api-client";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    signUpload: vi.fn(),
    confirmUpload: vi.fn(),
  };
});

import { confirmUpload, signUpload } from "@/lib/api-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("precheckFile", () => {
  it("rejects SVG before signing", () => {
    const r = precheckFile({ type: "image/svg+xml", size: 100, name: "evil.svg" });
    expect(r?.code).toBe("SVG_REJECTED");
    expect(r?.message).toMatch("SVG");
  });

  it("rejects disallowed MIME", () => {
    const r = precheckFile({ type: "application/x-sh", size: 100, name: "run.sh" });
    expect(r?.code).toBe("MIME_NOT_ALLOWED");
  });

  it("rejects over-limit sizes with limit/received", () => {
    const r = precheckFile({ type: "image/png", size: maxForMime("image/png") + 1, name: "big.png" });
    expect(r?.code).toBe("FILE_TOO_LARGE");
    expect(r?.limit).toBe(maxForMime("image/png"));
    expect(r?.received).toBe(maxForMime("image/png") + 1);
  });

  it("accepts allowed files", () => {
    expect(precheckFile({ type: "image/png", size: 100, name: "ok.png" })).toBeNull();
    expect(precheckFile({ type: "application/pdf", size: 100, name: "ok.pdf" })).toBeNull();
  });

  it("mirrors the server allowlist", () => {
    expect(allowedMime("image/svg+xml")).toBe(false);
    expect(allowedMime("application/pdf")).toBe(true);
    expect(allowedMime("video/mp4")).toBe(true);
  });
});

describe("humanUploadMessage", () => {
  it("names limit/received for FILE_TOO_LARGE", () => {
    const err = new ApiRequestError(422, "too big", { code: "FILE_TOO_LARGE", limit: 10, received: 20 });
    expect(humanUploadMessage(err)).toMatch("20 B");
    expect(humanUploadMessage(err)).toMatch("10 B");
  });

  it("maps MIME_NOT_ALLOWED", () => {
    expect(humanUploadMessage(new ApiRequestError(422, "nope", { code: "MIME_NOT_ALLOWED" }))).toMatch(
      "not allowed",
    );
  });

  it("points 413 at the signed flow", () => {
    expect(humanUploadMessage(new ApiRequestError(413, "too large"))).toMatch("signed upload");
  });

  it("maps folder errors", () => {
    expect(humanUploadMessage(new ApiRequestError(422, "deep", { code: "FOLDER_DEPTH_EXCEEDED" }))).toMatch(
      "too deep",
    );
    expect(humanUploadMessage(new ApiRequestError(422, "cycle", { code: "FOLDER_CYCLE" }))).toMatch(
      "inside itself",
    );
  });
});

describe("UploadDropzone", () => {
  function file(name = "photo.png", type = "image/png", size = 100): File {
    const bytes = new Uint8Array(size);
    return new File([bytes], name, { type });
  }

  it("fails SVG in precheck without calling sign", async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);
    const input = screen.getByLabelText("Choose a file to upload");
    await user.upload(input, file("evil.svg", "image/svg+xml"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch("SVG");
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("runs sign → PUT → confirm to done", async () => {
    vi.mocked(signUpload).mockResolvedValue({ url: "https://provider/upload", params: { a: "1" } });
    vi.mocked(confirmUpload).mockResolvedValue({
      id: "asset-1",
      providerKey: "photo",
      mime: "image/png",
      sizeBytes: 100,
      width: null,
      height: null,
      folderId: null,
      alt: null,
      caption: null,
      deletedAt: null,
      createdAt: "2026-11-06T00:00:00.000Z",
    });
    // XHR stub: emit progress then resolve success.
    const realXHR = globalThis.XMLHttpRequest;
    let instance: {
      upload: { onprogress: ((ev: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
      open: (...args: unknown[]) => void;
      send: () => void;
      onload: (() => void) | null;
      onerror: (() => void) | null;
      status: number;
      responseText: string;
    } | null = null;
    class FakeXHR {
      upload: { onprogress: ((ev: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      status = 200;
      responseText = '{"public_id":"photo"}';
      open() {}
      send() {
        instance = this;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
    try {
      const onDone = vi.fn();
      const user = userEvent.setup();
      render(<UploadDropzone onDone={onDone} />);
      await user.upload(screen.getByLabelText("Choose a file to upload"), file());
      expect(await screen.findByText(/Uploaded/)).toBeTruthy();
      expect(signUpload).toHaveBeenCalledWith(
        expect.objectContaining({ filename: "photo.png", mime: "image/png", sizeBytes: 100 }),
      );
      expect(confirmUpload).toHaveBeenCalledWith(
        expect.objectContaining({ providerKey: "photo", mime: "image/png" }),
      );
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(instance).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
      void realXHR;
    }
  });

  it("maps sign errors to human failed state", async () => {
    vi.mocked(signUpload).mockRejectedValue(
      new ApiRequestError(422, "too big", { code: "FILE_TOO_LARGE", limit: 10, received: 20 }),
    );
    const user = userEvent.setup();
    render(<UploadDropzone />);
    await user.upload(screen.getByLabelText("Choose a file to upload"), file());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch("too large");
    expect(alert.textContent).toMatch("20 B");
  });
});
