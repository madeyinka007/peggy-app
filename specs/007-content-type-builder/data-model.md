# Data Model: Content-Type Builder (Slice 7)

**Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

No new tables, no migrations, no API model changes. This slice renders and mutates the Slice 3 registry model through the admin view-model (extends `apps/admin/src/lib/types.ts` from Slice 6 T004).

## Existing entities (reused, not redefined)

- **content_types** (`packages/db/src/schema-content-types.ts`): `id, name!unique, kind ∈ {collection,single}, collectionSlug!unique ~ ^[a-z0-9-]+$, displayName?, description?, isLocalized, hasDraftPublish, activeSchemaVersion, createdBy→user(set null), createdAt, updatedAt`.
- **components**: `id, name!unique, displayName?, category?, activeSchemaVersion, createdAt, updatedAt`.
- **content_fields**: exactly one of `contentTypeId→content_types(cascade)` / `componentId→components(cascade)` (enforced by `content_fields_owner_check`); `name, label?, fieldType ∈ 16 VALID_FIELD_TYPES, required, uniqueScope?, defaultValue?(jsonb), localized, searchable, indexedHint, validation(jsonb {}), relationConfig?/componentConfig?/dynamiczoneConfig?/mediaConfig?(jsonb), sortOrder, createdAt, updatedAt`. Uniques are **per-owner** (`(contentTypeId,name)`, `(componentId,name)`).
- **schema_versions**: append-only snapshots `{ fields: [{ name, type }] }` per owner+version; written by `bumpSchemaVersion` on every field mutation.
- **documents.contentTypeId → content_types ON DELETE RESTRICT**: the real type-delete guard (R-07-03).

## Admin view-model additions (in `apps/admin/src/lib/types.ts`)

```ts
/** Draft state for the builder forms (never sent verbatim; mapped to Create*Input). */
export interface TypeDraft {
  name: string;
  kind: "collection" | "single";          // creation only; absent from edit drafts (FR-108)
  collectionSlug: string;
  displayName: string;
  description: string;
  isLocalized: boolean;
  hasDraftPublish: boolean;
}

export interface ComponentDraft {
  name: string;                            // creation only
  displayName: string;
  category: string;
}

export interface FieldDraft {
  owner: { kind: "content-type" | "component"; id: string };
  fieldId?: string;                        // set when editing
  name: string;                            // creation only in practice; rename constrained (R-07-02)
  label: string;
  fieldType: string;                       // one of the 16 VALID_FIELD_TYPES; change requires confirm (R-07-02)
  required: boolean;
  localized: boolean;
  searchable: boolean;
  uniqueScope: string;                     // "" = none
  defaultValue: string;                    // JSON text; validated client-side before send
  sortOrder: number;                       // managed via move up/down, not free entry (FR-106)
  validationText: string;                  // JSON text for `validation` (enum options etc.)
  relationConfigText: string;              // JSON text | ""
  componentConfigText: string;             // JSON text | ""
  dynamiczoneConfigText: string;           // JSON text | ""
  mediaConfigText: string;                 // JSON text | ""
}

/** Builder action the page is currently performing (drives search-param state). */
export type BuilderAction =
  | { view: "list" }
  | { view: "new-type" } | { view: "edit-type"; id: string }
  | { view: "new-component" } | { view: "edit-component"; id: string }
  | { view: "new-field"; owner: FieldDraft["owner"] }
  | { view: "edit-field"; owner: FieldDraft["owner"]; fieldId: string }
  | { view: "confirm-delete"; target: { kind: "type" | "component" | "field"; id: string; ownerId?: string } };
```

## State transitions

- Any field mutation (create/update/delete/reorder) on an owner: `activeSchemaVersion[N] → [N+1]` server-side; UI re-reads the owner detail and renders the new pointer (R-07-04). Metadata-only type/component edits leave the version unchanged — the UI must **not** present "saved" as a version advance.
- Field delete: row persists (deprecated); no `deletedAt` flag exists — UI renders the row as still-present with the deprecation notice from the confirm step, never a fake removed state.
- Type delete success: owner row gone; any `?type=<deleted-id>` selection falls back to the list with an "unknown entry" state (existing Slice 6 pattern).
