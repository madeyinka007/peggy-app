# Research: Content Types and Schema Registry (Slice 2)

## Decision 1: Schema-as-data (no per-type DDL)

**Decision**: Content types, fields, and components are stored as rows in relational tables. No `CREATE TABLE` per content type. Field definitions are rows in `content_fields` with type-specific config in JSONB columns.

**Rationale**: Constitution II (Metadata vs Content Separation) mandates schema definitions are rows, never tables. A single stable schema supports arbitrary content models defined at runtime without migrations or downtime.

**Alternatives considered**: Per-content-type tables (rejected — requires DDL per type, violates DB-03 no in-request DDL).

## Decision 2: Exactly-one-owner on fields (no polymorphic FK)

**Decision**: `content_fields` has two nullable FKs (`content_type_id`, `component_id`) with a CHECK constraint `(content_type_id IS NULL) <> (component_id IS NULL)`. This enforces exactly one owner without polymorphic FKs (DB-02).

**Rationale**: Constitution III prohibits polymorphic foreign keys. The CHECK constraint gives referential integrity for both owners.

**Alternatives considered**: Single `owner_id` + `owner_kind` text (rejected — polymorphic, defeats FK integrity).

## Decision 3: Append-only schema versioning

**Decision**: Every field mutation (add/update/delete) increments `active_schema_version` on the owner (content type or component) and creates a `schema_versions` row with a JSON snapshot of the schema at that version.

**Rationale**: Enables lenient reads of old documents (a document created at v1 can be read even after v3) and provides audit trail. Versions are never deleted.

**Alternatives considered**: Overwrite-in-place (rejected — loses history, breaks document compatibility).

## Decision 4: Reserved-name blocking at service layer

**Decision**: A blocklist of reserved field names (id, documentId, __component, createdAt, updatedAt, publishedAt, locale, etc.) is enforced in the service layer, not the DB.

**Rationale**: The list may evolve; service-layer enforcement allows updates without migrations. DB CHECK against a hardcoded list would require DDL changes.

**Alternatives considered**: DB CHECK constraint (rejected — requires migration to update list).

## Decision 5: Soft-block delete

**Decision**: Content types with existing documents return 409 unless `force=true`. Components referenced by fields return 409 unless references are removed first.

**Rationale**: Prevents accidental data loss. Force flag allows admin override. Document count check is a service-layer query.

**Alternatives considered**: Hard delete with cascade (rejected — data loss risk).

## Decision 6: JSONB config columns per field type

**Decision**: Type-specific configuration (relation targets, component IDs, dynamic zone allowed components, media constraints, validation rules) stored in dedicated JSONB columns (`relation_config`, `component_config`, `dynamiczone_config`, `media_config`, `validation`).

**Rationale**: Keeps field-type-specific knobs schemaless without EAV explosion. Service layer validates config shape per fieldType.

**Alternatives considered**: Single `config JSONB` (rejected — less queryable, harder to validate).
