/**
 * SchemaForm + error-mapper tests (T021/US1). Required markers, all widget
 * types from a fixture registry, R-06 mapper shapes incl. slug 409, and
 * payload preservation on failure.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm } from "@/components/SchemaForm";
import { mapServerError } from "@/lib/error-mapper";
import { ApiRequestError } from "@/lib/api-client";
import type { RegistryField, RegistryView } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, listAssets: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 50 } }), listFolders: vi.fn().mockResolvedValue({ data: [] }) };
});

function field(over: Partial<RegistryField> & { name: string }): RegistryField {
  const { name, ...rest } = over;
  return {
    id: name,
    name,
    label: null,
    fieldType: "text",
    required: false,
    localized: false,
    uniqueScope: null,
    defaultValue: null,
    searchable: false,
    validation: {},
    relationConfig: null,
    componentConfig: null,
    dynamiczoneConfig: null,
    mediaConfig: null,
    sortOrder: 0,
    ...rest,
  };
}

const ALL_TYPES: Array<[string, RegistryField]> = [
  ["text", field({ name: "f_text", fieldType: "text" })],
  ["email", field({ name: "f_email", fieldType: "email" })],
  ["uid", field({ name: "f_uid", fieldType: "uid" })],
  ["richtext", field({ name: "f_richtext", fieldType: "richtext" })],
  ["markdown", field({ name: "f_markdown", fieldType: "markdown" })],
  ["number", field({ name: "f_number", fieldType: "number" })],
  ["boolean", field({ name: "f_boolean", fieldType: "boolean" })],
  ["date", field({ name: "f_date", fieldType: "date" })],
  ["datetime", field({ name: "f_datetime", fieldType: "datetime" })],
  ["time", field({ name: "f_time", fieldType: "time" })],
  ["enumeration", field({ name: "f_enum", fieldType: "enumeration", validation: { options: ["a", "b"] } })],
  ["media", field({ name: "f_media", fieldType: "media" })],
  ["relation", field({ name: "f_relation", fieldType: "relation" })],
  ["component", field({ name: "f_component", fieldType: "component", componentConfig: { componentId: "seo" } })],
  ["dynamiczone", field({ name: "f_dz", fieldType: "dynamiczone", dynamiczoneConfig: { components: ["seo"] } })],
  ["json", field({ name: "f_json", fieldType: "json" })],
];

function formType(): RegistryView {
  return {
    id: "ct",
    name: "kitchen",
    kind: "collection",
    collectionSlug: "kitchen",
    displayName: "Kitchen sink",
    description: null,
    isLocalized: true,
    hasDraftPublish: true,
    activeSchemaVersion: 1,
    fields: ALL_TYPES.map(([, f], i) => ({ ...f, sortOrder: i })),
  };
}

const components = [
  {
    id: "seo",
    name: "seo",
    displayName: "SEO",
    category: null,
    fields: [field({ name: "metaTitle", fieldType: "text" })],
  },
];

describe("R-06 error mapper", () => {
  const names = { names: ["title", "slug", "count"], uidField: "slug" };

  it("maps Missing required field to the field path", () => {
    const err = new ApiRequestError(422, "Missing required field: title");
    expect(mapServerError(err, names)).toEqual({ fieldErrors: { title: "Missing required field: title" }, banner: null });
  });

  it("maps Invalid type for field to the field path", () => {
    const err = new ApiRequestError(400, "Invalid type for field count: expected number");
    expect(mapServerError(err, names).fieldErrors).toEqual({ count: "Invalid type for field count: expected number" });
  });

  it("maps Validation failed for <name> to the field path", () => {
    const err = new ApiRequestError(400, "Validation failed for title: minLength 3");
    expect(mapServerError(err, names).fieldErrors).toEqual({ title: "Validation failed for title: minLength 3" });
  });

  it("maps 409 slug conflicts to the uid field", () => {
    const err = new ApiRequestError(409, "Slug conflict: a published document with this slug already exists");
    expect(mapServerError(err, names)).toEqual({
      fieldErrors: { slug: "Slug conflict: a published document with this slug already exists" },
      banner: null,
    });
  });

  it("degrades unknown shapes to the banner", () => {
    const err = new ApiRequestError(500, "Something exploded");
    expect(mapServerError(err, names)).toEqual({ fieldErrors: {}, banner: "Something exploded" });
  });
});

describe("SchemaForm", () => {
  it("renders a widget for every registry field type", () => {
    render(
      <SchemaForm
        type={formType()}
        initialValues={{}}
        ctx={{ components }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByLabelText("f_text")).toBeTruthy();
    expect(screen.getByLabelText("f_email")).toBeTruthy();
    expect(screen.getByLabelText("f_richtext")).toBeTruthy();
    expect(screen.getByLabelText("f_number")).toBeTruthy();
    expect(screen.getByLabelText("f_boolean")).toBeTruthy();
    expect(screen.getByLabelText("f_date")).toBeTruthy();
    expect(screen.getByLabelText("f_enum")).toBeTruthy();
    expect(screen.getByLabelText("f_media")).toBeTruthy();
    expect(screen.getByLabelText("f_relation")).toBeTruthy();
    expect(screen.getByLabelText("f_json")).toBeTruthy();
    // Component sub-form renders the nested field; label text is bare (no htmlFor on group label).
    expect(screen.getByText("f_component")).toBeTruthy();
    expect(screen.getByText("f_dz")).toBeTruthy();
  });

  it("marks required fields and filters reserved names", () => {
    const type: RegistryView = {
      ...formType(),
      fields: [
        field({ name: "title", fieldType: "text", required: true }),
        field({ name: "documentId", fieldType: "text" }),
        field({ name: "createdAt", fieldType: "datetime" }),
      ],
    };
    render(<SchemaForm type={type} initialValues={{}} onSubmit={() => {}} />);
    const input = screen.getByLabelText(/title/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(screen.queryByLabelText("documentId")).toBeNull();
    expect(screen.queryByLabelText("createdAt")).toBeNull();
  });

  it("shows enum options from validation.options", async () => {
    const user = userEvent.setup();
    render(
      <SchemaForm
        type={formType()}
        initialValues={{}}
        ctx={{ components }}
        onSubmit={() => {}}
      />,
    );
    const select = screen.getByLabelText("f_enum");
    await user.selectOptions(select, "b");
    expect((select as HTMLSelectElement).value).toBe("b");
  });

  it("opens the media picker and populates the field on select (T025)", async () => {
    const user = userEvent.setup();
    render(
      <SchemaForm type={formType()} initialValues={{}} ctx={{ components }} onSubmit={() => {}} />,
    );
    const btn = screen.getByRole("button", { name: "Select media" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    await user.click(btn);
    expect(screen.getByRole("dialog", { name: "Choose media" })).toBeTruthy();
  });

  it("submits collected values and preserves payload on failure", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <SchemaForm
        type={formType()}
        initialValues={{ f_text: "kept" }}
        ctx={{ components }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Save draft/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ f_text: "kept" }));
    // Server failure: the typed value stays in the form (payload preserved).
    rerender(
      <SchemaForm
        type={formType()}
        initialValues={{ f_text: "kept" }}
        ctx={{ components }}
        onSubmit={onSubmit}
        saveError={new ApiRequestError(422, "Missing required field: f_uid")}
      />,
    );
    expect((screen.getByLabelText("f_text") as HTMLInputElement).value).toBe("kept");
    expect(screen.getByText("Missing required field: f_uid")).toBeTruthy();
  });

  it("shows the translation-missing empty state", () => {
    render(
      <SchemaForm
        type={formType()}
        initialValues={{}}
        translationMissing
        ctx={{ components }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch("No translation exists");
  });

  it("reorders dynamic-zone entries with up/down controls (T032)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const dzType: RegistryView = {
      ...formType(),
      fields: [field({ name: "blocks", fieldType: "dynamiczone", dynamiczoneConfig: { components: ["seo"] } })],
    };
    render(
      <SchemaForm
        type={dzType}
        initialValues={{
          blocks: [
            { __component: "seo", metaTitle: "first" },
            { __component: "seo", metaTitle: "second" },
          ],
        }}
        ctx={{ components }}
        onSubmit={onSubmit}
      />,
    );
    // Move the first entry down: order flips.
    await user.click(screen.getByRole("button", { name: "Move seo 1 down" }));
    await user.click(screen.getByRole("button", { name: /Save draft/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({ metaTitle: "second" }),
          expect.objectContaining({ metaTitle: "first" }),
        ],
      }),
    );
    // Edge buttons are disabled: first entry cannot move up, last cannot move down.
    const ups = screen.getAllByRole("button", { name: /up$/ });
    const downs = screen.getAllByRole("button", { name: /down$/ });
    expect((ups[0] as HTMLButtonElement).disabled).toBe(true);
    expect((downs[downs.length - 1] as HTMLButtonElement).disabled).toBe(true);
  });
});
