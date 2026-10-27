# Feature Specification: Content Types and Schema Registry (Slice 2)

**Feature Branch**: `003-content-types`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Slice 2 — Content Types and Schema Registry. The registry that defines all content models at runtime (content types, fields, components, dynamic zones), versioned schema migrations, and the admin API to manage them. No content documents yet (Slice 3)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a content type (Priority: P1)

An admin defines a new content type (e.g., "post") with a collection slug, display name, and localization/publish flags. The type is persisted in the registry and immediately available for field definitions and future document creation.

**Why this priority**: Everything in the CMS depends on content types existing. This is the foundation for fields, components, and documents.

**Independent Test**: POST /api/v1/content-types with name, kind, collectionSlug → 201 with content type data. GET /api/v1/content-types → lists the new type.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they POST to `/api/v1/content-types` with name "post", kind "collection", collectionSlug "posts", **Then** a content type is created with activeSchemaVersion 1 and returned with 201.
2. **Given** a content type exists, **When** admin GETs `/api/v1/content-types`, **Then** the type appears in the list.
3. **Given** a content type with documents, **When** admin attempts DELETE without force, **Then** 409 Conflict with document count.
4. **Given** an admin, **When** they POST with a duplicate name or slug, **Then** 409 Conflict.

---

### User Story 2 - Admin defines fields on a content type (Priority: P1)

An admin adds typed fields (text, number, boolean, media, relation, component, etc.) to a content type. Each field has validation rules, localization flag, required flag, and ordering. Fields are versioned — adding or modifying a field bumps the schema version.

**Why this priority**: Fields define the shape of content. Without fields, content types are empty shells.

**Independent Test**: POST /api/v1/content-types/{id}/fields with field definitions → 201. GET /api/v1/content-types/{id} → returns fields ordered by sortOrder.

**Acceptance Scenarios**:

1. **Given** a content type, **When** admin adds a field "title" of type "text" with required=true, **Then** the field is persisted and the content type's activeSchemaVersion increments.
2. **Given** a content type with fields, **When** admin GETs the content type, **Then** fields are returned ordered by sortOrder.
3. **Given** a field with a reserved name (e.g., "id", "createdAt"), **When** admin attempts to add it, **Then** 422 with validation error.
4. **Given** a field with type "relation", **When** config is provided (targetType, kind, inverse, onDelete), **Then** the relation_config JSONB is stored.
5. **Given** a field with type "component", **When** config references a componentId, **Then** the component_config JSONB is stored.

---

### User Story 3 - Admin creates reusable components (Priority: P2)

An admin creates reusable component definitions (e.g., "seo", "hero") with their own fields. Components can be embedded in content type fields (component type) or used in dynamic zones.

**Why this priority**: Components are essential for structured content but depend on content types and fields working first.

**Independent Test**: POST /api/v1/components with name, displayName, category → 201. POST /api/v1/components/{id}/fields → 201. GET /api/v1/components → lists components with their fields.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they create a component "seo" with category "seo", **Then** the component is persisted with activeSchemaVersion 1.
2. **Given** a component, **When** admin adds fields to it, **Then** fields are stored with owner_kind='component' and the component's schema version increments.
3. **Given** a component with a duplicate name, **When** admin attempts creation, **Then** 409 Conflict.
4. **Given** an admin, **When** they GET /api/v1/components, **Then** all components with their field counts are listed.

---

### User Story 4 - Admin manages dynamic zones (Priority: P3)

An admin configures dynamic zones on a content type — an ordered list of allowed components. A dynamic zone field references the zone and validates that only allowed components are used.

**Why this priority**: Dynamic zones are advanced composition. They depend on components and fields working.

**Independent Test**: POST /api/v1/content-types/{id}/fields with type "dynamiczone" and dynamiczone_config listing allowed component IDs → 201. GET content type → field includes allowedComponents.

**Acceptance Scenarios**:

1. **Given** a content type and two components, **When** admin adds a dynamiczone field with allowedComponents=[comp1, comp2], **Then** the field is persisted with the config.
2. **Given** a dynamiczone field, **When** admin updates the allowed components list, **Then** the schema version increments and the old list is replaced.

---

### Edge Cases

- What happens when a content type is deleted that has documents? → 409 Conflict unless force=true (soft-blocked).
- What happens when a field is removed that was used in existing documents? → Field is deprecated (hidden from new docs, readable on old), never silently dropped.
- What happens when a field name conflicts with a reserved name (id, documentId, createdAt, etc.)? → 422 validation error.
- What happens when a component referenced by a field is deleted? → 409 Conflict if referenced; must remove references first.
- How does the system handle schema version bumps? → Each field add/modify/delete increments active_schema_version and creates a schema_versions row.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide CRUD for content types (create, read, list, update, delete) at `/api/v1/content-types`.
- **FR-002**: Content type MUST have: name (unique), kind (collection|single), collectionSlug (unique, lowercase slug), displayName, description, isLocalized, hasDraftPublish, activeSchemaVersion, createdBy, timestamps.
- **FR-003**: System MUST enforce uniqueness on content type name and collectionSlug.
- **FR-004**: System MUST soft-block delete of content types with existing documents (409 unless force=true).
- **FR-005**: System MUST provide CRUD for content fields (create, read, list, update, delete) at `/api/v1/content-types/{id}/fields` and `/api/v1/components/{id}/fields`.
- **FR-006**: Field MUST have: name (unique per owner), label, fieldType (text|richtext|markdown|number|boolean|date|datetime|time|json|email|uid|enumeration|media|relation|component|dynamiczone), required, uniqueScope (null|per_locale|global), defaultValue (JSONB), localized, searchable, indexedHint, validation (JSONB), relationConfig, componentConfig, dynamiczoneConfig, mediaConfig, sortOrder, timestamps.
- **FR-007**: System MUST enforce exactly-one-owner on fields: contentTypeId XOR componentId (no polymorphic FK).
- **FR-008**: System MUST block reserved field names (id, documentId, __component, createdAt, updatedAt, publishedAt, locale, etc.) at the service layer.
- **FR-009**: System MUST bump activeSchemaVersion and create a schema_versions row on any field change.
- **FR-010**: System MUST provide CRUD for components at `/api/v1/components`.
- **FR-011**: Component MUST have: name (unique), displayName, category, activeSchemaVersion, timestamps.
- **FR-012**: System MUST soft-block delete of components referenced by fields (409 unless references removed).
- **FR-013**: System MUST support field types: text, richtext, markdown, number, boolean, date, datetime, time, json, email, uid, enumeration, media, relation, component, dynamiczone.
- **FR-014**: System MUST store type-specific config in JSONB columns (relation_config, component_config, dynamiczone_config, media_config, validation).
- **FR-015**: System MUST enforce field name uniqueness per owner (content type or component).
- **FR-016**: System MUST provide an OpenAPI snapshot at `/api/v1/openapi.json` covering all routes.

### Key Entities

- **ContentType**: id (uuid), name (unique), kind (collection|single), collectionSlug (unique), displayName, description, isLocalized, hasDraftPublish, activeSchemaVersion, createdBy (FK→user), createdAt, updatedAt.
- **ContentField**: id (uuid), contentTypeId (FK nullable), componentId (FK nullable), name, label, fieldType, required, uniqueScope, defaultValue (JSONB), localized, searchable, indexedHint, validation (JSONB), relationConfig (JSONB), componentConfig (JSONB), dynamiczoneConfig (JSONB), mediaConfig (JSONB), sortOrder, createdAt, updatedAt. Exactly one of contentTypeId/componentId is set.
- **Component**: id (uuid), name (unique), displayName, category, activeSchemaVersion, createdAt, updatedAt.
- **SchemaVersion**: id (uuid), ownerKind (content_type|component), ownerId (uuid), version (int), snapshot (JSONB), createdAt. Created on any field change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can create a content type with fields in under 2 seconds.
- **SC-002**: Content type + field CRUD operations return correct HTTP status codes (200/201/404/409/422).
- **SC-003**: Schema version increments on every field mutation.
- **SC-004**: Reserved field names are rejected with 422.
- **SC-005**: All routes are covered by OpenAPI snapshot.
- **SC-006**: Content type deletion with documents returns 409 unless force=true.

## Assumptions

- Content types are single-project scoped (D2, no tenant_id).
- Field validation rules are stored as JSONB and enforced at the service layer, not DB constraints.
- Schema versioning is append-only — old versions are retained for lenient reads.
- Components are global (not scoped to a content type) — reusable across types.
- Dynamic zones reference components by ID, validated at the service layer.
- The organization plugin is NOT installed (D2 single-project).
- Content documents are out of scope (Slice 3) — this slice only defines the schema registry.EOF
echo "written"; wc -l specs/003-content-types/spec.md