# Feature Specification: Content Documents and Publishing (Slice 3)

**Feature Branch**: `004-content-documents`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Slice 3 — Content Documents and Publishing. The core CMS feature: creating, versioning, publishing, and querying content documents. Includes draft/published lifecycle, per-locale publish pointers, slug uniqueness, and the public API (published-only)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a document (Priority: P1)

An admin creates a new content document of a given content type. The system creates the document identity, a draft version with validated payload, and locale pointers. The document is in draft state (not publicly visible).

**Why this priority**: All content operations depend on documents existing. This is the foundation for versioning, publishing, and querying.

**Independent Test**: POST /api/v1/documents with contentTypeId and data → 201 with document + draft version. GET /api/v1/documents/:id → returns document with draft version.

**Acceptance Scenarios**:

1. **Given** an authenticated admin and a content type "post" with fields, **When** they POST to `/api/v1/documents` with contentTypeId and data payload, **Then** a document is created with a draft version (v1) and a locale pointer, returned with 201.
2. **Given** a document exists, **When** admin GETs `/api/v1/documents/:id`, **Then** the document with its draft version data is returned.
3. **Given** a document with a slug field, **When** the slug conflicts with an existing published document in the same locale, **Then** 409 Conflict.
4. **Given** invalid data (missing required field), **When** admin creates a document, **Then** 422 validation error.

---

### User Story 2 - Admin publishes a document (Priority: P1)

An admin publishes a draft version of a document for a specific locale. The system flips the published pointer (O(1) metadata operation, no data copy). Published content becomes visible via the public API.

**Why this priority**: Publishing is the core value proposition of a CMS. Without it, content is never visible.

**Independent Test**: POST /api/v1/documents/:id/publish with locale → 200. GET /api/v1/public/posts?locale=en → returns published document.

**Acceptance Scenarios**:

1. **Given** a document with a draft version, **When** admin POSTs to `/api/v1/documents/:id/publish` with locale "en", **Then** the published pointer is set, publishedAt is recorded, and 200 is returned.
2. **Given** a published document, **When** a public consumer GETs `/api/v1/public/posts?locale=en`, **Then** the published version's data is returned.
3. **Given** a document with no published version, **When** a public consumer queries, **Then** the document is not in results (draft-leak: 0 rows).
4. **Given** a published document, **When** admin unpublishes, **Then** published pointer is cleared, document no longer visible publicly.

---

### User Story 3 - Admin saves a new version (Priority: P2)

An admin saves changes to a document, creating a new immutable version. The draft pointer moves to the new version. Old versions are retained for history and restore.

**Why this priority**: Versioning enables content history and rollback. Depends on document creation working.

**Independent Test**: PUT /api/v1/documents/:id with new data → 200 with new version number. GET /api/v1/documents/:id/versions → lists all versions.

**Acceptance Scenarios**:

1. **Given** a document with v1 draft, **When** admin PUTs new data, **Then** v2 is created, draft pointer moves to v2, and 200 is returned.
2. **Given** a document with multiple versions, **When** admin GETs versions, **Then** all versions are listed with version numbers and timestamps.
3. **Given** a document, **When** admin restores to v1, **Then** a new version (v3) is created with v1's data, and draft pointer moves to v3.

---

### User Story 4 - Public consumer queries published content (Priority: P2)

A public consumer (website, mobile app) queries published content via the public API. Only published documents are returned. Filtering, sorting, and pagination are supported. Draft content is never leaked.

**Why this priority**: Public API is the primary consumption path. Depends on publishing working.

**Independent Test**: GET /api/v1/public/posts?locale=en&filters[title][$contains]=hello → returns only published documents matching filter.

**Acceptance Scenarios**:

1. **Given** published and draft documents, **When** a public consumer queries `/api/v1/public/posts`, **Then** only published documents are returned (draft-leak: 0 rows for draft-only).
2. **Given** published documents, **When** a consumer filters by a field value, **Then** only matching published documents are returned.
3. **Given** published documents, **When** a consumer sorts by a field, **Then** results are sorted correctly.
4. **Given** published documents, **When** a consumer paginates, **Then** correct page of results is returned.

---

### User Story 5 - Admin deletes a document (Priority: P3)

An admin soft-deletes a document (tombstone). The document identity and all versions are retained for audit/restore. The document is no longer visible publicly or in admin lists (unless explicitly including deleted).

**Why this priority**: Deletion is important but lower priority than create/version/publish.

**Independent Test**: DELETE /api/v1/documents/:id → 204. GET /api/v1/documents/:id → 404 (or 410 if including deleted).

**Acceptance Scenarios**:

1. **Given** a document, **When** admin DELETEs it, **Then** deletedAt is set (tombstone), and 204 is returned.
2. **Given** a deleted document, **When** admin GETs it (without includeDeleted), **Then** 404.
3. **Given** a deleted document, **When** admin GETs it with includeDeleted=true, **Then** the document with deletedAt is returned.

---

### Edge Cases

- What happens when a document is published in multiple locales? → Each locale has its own published pointer; publish is per-locale.
- What happens when a slug conflicts? → 409 Conflict if a published document in the same locale has the same slug.
- What happens when schema version changes after document creation? → Document's schemaVersion records the version at write time; reads use lenient validation.
- What happens when a document is deleted? → Tombstone (deletedAt set); locales/versions retained for restore/audit.
- How does the system handle concurrent publishes? → Optimistic concurrency via version pointers; publish is an O(1) pointer flip in a transaction.
- What happens when a public query has no locale? → Defaults to the default locale from the locales table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide document creation (POST /api/v1/documents) with contentTypeId, locale, and data payload.
- **FR-002**: System MUST create a document identity (documents table) + draft version (document_versions) + locale pointer (document_locales) in one transaction.
- **FR-003**: System MUST validate data payload against the content type's schema (field types, required, validation rules) at write time.
- **FR-004**: System MUST provide document read (GET /api/v1/documents/:id) returning draft version data.
- **FR-005**: System MUST provide document update (PUT /api/v1/documents/:id) creating a new immutable version and moving the draft pointer.
- **FR-006**: System MUST provide version history (GET /api/v1/documents/:id/versions) listing all versions with numbers and timestamps.
- **FR-007**: System MUST provide document restore (POST /api/v1/documents/:id/restore) creating a new version from an old version's data.
- **FR-008**: System MUST provide publish (POST /api/v1/documents/:id/publish) setting the published pointer for a locale (O(1) metadata flip).
- **FR-009**: System MUST provide unpublish (POST /api/v1/documents/:id/unpublish) clearing the published pointer.
- **FR-010**: System MUST provide soft-delete (DELETE /api/v1/documents/:id) setting deletedAt tombstone.
- **FR-011**: System MUST provide public query API (GET /api/v1/public/{collectionSlug}) returning only published documents.
- **FR-012**: Public query MUST support filtering, sorting, and pagination.
- **FR-013**: Public query MUST enforce draft-leak prevention: 0 rows for draft-only content (IS NOT NULL on published_version_id).
- **FR-014**: System MUST enforce slug uniqueness per locale (partial unique index on content_type_id + locale + slug).
- **FR-015**: System MUST record schema_version on each document version (registry version at write time).
- **FR-016**: System MUST support per-locale publish (each locale has its own published pointer).
- **FR-017**: System MUST provide locale listing (GET /api/v1/locales) and locale management.
- **FR-018**: System MUST enforce RBAC on all document mutations (document.create, document.read, document.update, document.publish, document.delete).

### Key Entities

- **Document**: id (uuid), documentId (uuid, public/stable), contentTypeId (FK→content_types, immutable), createdBy (FK→user), createdAt, deletedAt (tombstone).
- **DocumentLocale**: documentId (FK), locale (FK→locales), draftVersionId (FK→document_versions, nullable), publishedVersionId (FK→document_versions, nullable), publishedAt, firstPublishedAt, scheduledAt, updatedAt. PK(documentId, locale).
- **DocumentVersion**: id (uuid), documentId (FK), locale, version (int), status (draft|published|in_review|scheduled|archived), data (JSONB), schemaVersion (int), slug (text, nullable), publishedAtSnapshot, createdBy (FK→user), createdAt (immutable).
- **DocumentRelation**: id (uuid), sourceDocumentId (FK), targetDocumentId (FK), relationField (text), createdAt.
- **Locale**: code (text PK, BCP47), name, isDefault, isActive, direction (ltr|rtl), fallbackChain (text[]).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can create a document and publish it in under 3 seconds.
- **SC-002**: Public query returns only published content (draft-leak: 0 rows for draft-only).
- **SC-003**: Publish is an O(1) pointer flip (no data copy).
- **SC-004**: Version history retains all versions (no data loss).
- **SC-005**: Slug uniqueness enforced per locale.
- **SC-006**: All document endpoints return correct HTTP status codes (200/201/204/404/409/422).

## Assumptions

- Content types and fields are already defined (Slice 2).
- Auth and RBAC are in place (Slice 1).
- Locale registry has at least one default locale seeded.
- Document validation uses the content type's activeSchemaVersion at write time.
- Published content is read-only (no mutations to published versions).
- Soft-delete retains all history for audit/restore.
- The Query Engine handles filtering/sorting/pagination on published content.
- Content relations are out of scope for this slice (Slice 4).
