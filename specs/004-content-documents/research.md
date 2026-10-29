# Research: Content Documents and Publishing (Slice 3)

## Decision 1: Immutable versions + pointer-based publish

**Decision**: Every save creates a new immutable `document_versions` row. Publish is an O(1) pointer flip (`published_version_id` on `document_locales`). No data copy on publish.

**Rationale**: Constitution II (Metadata vs Content Separation) — content payloads are immutable JSONB versions. Pointers make publish non-destructive, unpublish trivial, and public queries a single `IS NOT NULL` predicate (draft-leak prevention).

**Alternatives considered**: In-place status flag on version (rejected — mutates immutable row, breaks history).

## Decision 2: Per-locale publish pointers

**Decision**: Each `(document, locale)` has its own `draft_version_id` and `published_version_id`. Publish is per-locale.

**Rationale**: D3/D4 per-locale identity. A document can be published in English but still draft in French.

**Alternatives considered**: Single global published version (rejected — can't support per-locale publish).

## Decision 3: Slug extraction and uniqueness

**Decision**: Slug is extracted from the document's data (uid field, normalized) and stored as a column on `document_versions`. Partial unique index on `(content_type_id, locale, slug) WHERE slug IS NOT NULL` enforces per-locale uniqueness. Global uniqueness via separate partial index when `unique_global` flag is set.

**Rationale**: Extracted column enables DB-level uniqueness without JSONB unique-index hacks. Per-locale vs global slugs supported.

**Alternatives considered**: JSONB unique index (rejected — complex, DB-specific).

## Decision 4: Soft-delete via tombstone

**Decision**: Delete sets `deleted_at` on `documents` (tombstone). Locales and versions are retained for audit/restore. Public queries filter `deleted_at IS NULL`.

**Rationale**: Non-destructive delete enables restore and audit trail. History preserved.

**Alternatives considered**: Hard delete with cascade (rejected — data loss, breaks audit).

## Decision 5: Version history and restore

**Decision**: Restore creates a NEW version (vN+1) with the old version's data. The draft pointer moves to the new version. Old versions are never modified.

**Rationale**: Immutability preserved. Restore is just another save with historical data. Full audit trail maintained.

**Alternatives considered**: In-place revert (rejected — mutates immutable row).

## Decision 6: Public query with filter/sort/paginate

**Decision**: The Query Engine builds SQL against `document_versions` joined to `document_locales` (published pointer IS NOT NULL) and `documents` (not deleted). Filtering uses extracted columns + GIN index on data JSONB. Sorting by extracted columns or created_at. Pagination via LIMIT/OFFSET.

**Rationale**: Single predicate (`published_version_id IS NOT NULL`) guarantees draft-leak prevention. GIN index enables JSONB filtering.

**Alternatives considered**: Separate public table (rejected — sync complexity, stale data risk).

## Decision 7: Locale registry with fallback chains

**Decision**: `locales` table stores BCP47 codes with fallback chains (ordered array). Default locale seeded on first migration. Public queries default to the default locale if none specified.

**Rationale**: Supports i18n from the start. Fallback chains enable graceful degradation when content isn't localized.

**Alternatives considered**: Hardcoded locale list (rejected — not extensible).
