/**
 * SchemaTable tests (T020/US1). Scalar/placeholder/unknown-type columns,
 * badge rules, client pagination. No per-type component names (P-07).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaTable, cellText } from "@/components/SchemaTable";
import type { DocumentRow, RegistryField, RegistryView } from "@/lib/types";

function field(over: Partial<RegistryField>): RegistryField {
  return {
    id: over.name ?? "f",
    name: over.name ?? "f",
    label: over.label ?? null,
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
    ...over,
  };
}

function typeWith(fields: RegistryField[]): RegistryView {
  return {
    id: "ct-post",
    name: "post",
    kind: "collection",
    collectionSlug: "posts",
    displayName: "Post",
    description: null,
    isLocalized: true,
    hasDraftPublish: true,
    activeSchemaVersion: 3,
    fields,
  };
}

function row(over: Partial<DocumentRow>): DocumentRow {
  return {
    id: "doc-1",
    documentId: "doc-1",
    contentTypeId: "ct-post",
    locale: "en",
    draftVersionId: "v1",
    publishedVersionId: null,
    createdBy: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    deletedAt: null,
    data: {},
    ...over,
  };
}

describe("cellText", () => {
  it("renders scalar types as text", () => {
    expect(cellText(field({ name: "title", fieldType: "text" }), "Hello")).toBe("Hello");
    expect(cellText(field({ name: "n", fieldType: "number" }), 42)).toBe("42");
    expect(cellText(field({ name: "e", fieldType: "enumeration" }), "draft")).toBe("draft");
  });

  it("renders boolean as Yes/No", () => {
    expect(cellText(field({ name: "b", fieldType: "boolean" }), true)).toBe("Yes");
    expect(cellText(field({ name: "b", fieldType: "boolean" }), false)).toBe("No");
  });

  it("renders complex types as compact placeholders", () => {
    expect(cellText(field({ name: "m", fieldType: "media" }), "asset-1")).toBe("1 asset");
    expect(cellText(field({ name: "m", fieldType: "media" }), ["a", "b"])).toBe("2 assets");
    expect(cellText(field({ name: "d", fieldType: "dynamiczone" }), [{}, {}])).toBe("2 entries");
    expect(cellText(field({ name: "r", fieldType: "relation" }), "x")).toBe("relation");
    expect(cellText(field({ name: "c", fieldType: "component" }), {})).toBe("component");
    expect(cellText(field({ name: "r", fieldType: "richtext" }), "x")).toBe("rich text");
    expect(cellText(field({ name: "j", fieldType: "json" }), {})).toBe("JSON");
  });

  it("renders empty as an em dash", () => {
    expect(cellText(field({ name: "t" }), null)).toBe("—");
    expect(cellText(field({ name: "t" }), undefined)).toBe("—");
    expect(cellText(field({ name: "t" }), "")).toBe("—");
  });

  it("falls back to JSON dump + console.warn for unknown types", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(cellText(field({ name: "x", fieldType: "futuretype" }), { a: 1 })).toBe('{"a":1}');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("futuretype"));
    warn.mockRestore();
  });
});

describe("SchemaTable", () => {
  const type = typeWith([
    field({ name: "title", label: "Title", fieldType: "text", sortOrder: 1 }),
    field({ name: "cover", fieldType: "media", sortOrder: 2 }),
    field({ name: "pinned", fieldType: "boolean", sortOrder: 3 }),
  ]);

  it("renders derived columns plus status/locale/updated headers", () => {
    render(<SchemaTable type={type} rows={[row({ data: { title: "Hi", pinned: true } })]} locale="en" />);
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Hi")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Locale")).toBeTruthy();
    expect(screen.getByText("Updated")).toBeTruthy();
  });

  it("applies badge rules: published vs draft", () => {
    const { rerender } = render(
      <SchemaTable type={type} rows={[row({ publishedVersionId: "pv" })]} locale="en" />,
    );
    expect(screen.getByText("Published").getAttribute("data-status")).toBe("published");
    rerender(<SchemaTable type={type} rows={[row({ publishedVersionId: null })]} locale="en" />);
    expect(screen.getByText("Draft").getAttribute("data-status")).toBe("draft");
  });

  it("paginates 25 per page over the unpaginated array", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) =>
      row({ id: `d${i}`, data: { title: `Post ${i}` } }),
    );
    render(<SchemaTable type={type} rows={many} locale="en" />);
    expect(screen.getByText("Post 0")).toBeTruthy();
    expect(screen.queryByText("Post 25")).toBeNull();
    expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Post 25")).toBeTruthy();
    expect(screen.queryByText("Post 0")).toBeNull();
  });

  it("selects a row on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SchemaTable
        type={type}
        rows={[row({ id: "d1", data: { title: "One" } })]}
        locale="en"
        selectedId="d1"
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByText("One"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
