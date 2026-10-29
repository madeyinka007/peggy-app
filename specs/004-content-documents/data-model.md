# Data Model: Content Documents and Publishing (Slice 3)

## Documents

### documents
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| documentId | uuid | UNIQUE, NOT NULL (public stable ID) |
| contentTypeId | uuid | FK → content_types.id, ON DELETE RESTRICT, NOT NULL |
| createdBy | uuid | FK → user.id, ON DELETE SET NULL |
| createdAt | timestamp | default now, NOT NULL |
| deletedAt | timestamp | nullable (tombstone) |

**Constraints**: content_type_id immutable (trigger rejects UPDATE). UNIQUE(document_id).

### document_locales
| Field | Type | Constraints |
|---|---|---|
| documentId | uuid | FK → documents.id, ON DELETE CASCADE, NOT NULL |
| locale | text | FK → locales.code, ON DELETE RESTRICT, NOT NULL |
| draftVersionId | uuid | FK → document_versions.id, nullable |
| publishedVersionId | uuid | FK → document_versions.id, nullable |
| publishedAt | timestamp | nullable |
| firstPublishedAt | timestamp | nullable |
| scheduledAt | timestamp | nullable (reserved) |
| scheduledVersionId | uuid | FK → document_versions.id, nullable |
| updatedAt | timestamp | default now, NOT NULL |
| PK | (documentId, locale) | composite |

**Constraints**: CHECK(draftVersionId <> publishedVersionId OR either null). FKs DEFERRABLE.

### document_versions
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| documentId | uuid | FK → documents.id, ON DELETE CASCADE, NOT NULL |
| locale | text | NOT NULL (denormalized) |
| version | int | NOT NULL |
| status | text | NOT NULL (draft\|published\|in_review\|scheduled\|archived) |
| data | jsonb | NOT NULL, CHECK(jsonb_typeof(data) = 'object') |
| schemaVersion | int | NOT NULL |
| slug | text | nullable |
| publishedAtSnapshot | timestamp | nullable |
| createdBy | uuid | FK → user.id, ON DELETE SET NULL |
| createdAt | timestamp | default now, NOT NULL (immutable) |

**Constraints**: UNIQUE(documentId, locale, version). IMMUTABLE: trigger rejects UPDATE/DELETE.

### document_relations
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| sourceDocumentId | uuid | FK → documents.id, ON DELETE CASCADE, NOT NULL |
| targetDocumentId | uuid | FK → documents.id, ON DELETE CASCADE, NOT NULL |
| relationField | text | NOT NULL |
| createdAt | timestamp | default now, NOT NULL |

### locales
| Field | Type | Constraints |
|---|---|---|
| code | text | PK (BCP47) |
| name | text | NOT NULL |
| isDefault | boolean | default false, NOT NULL |
| isActive | boolean | default true, NOT NULL |
| direction | text | default 'ltr' (ltr\|rtl) |
| fallbackChain | text[] | NOT NULL, default '{}' |

## Relationships

- document 1:N document_locale (cascade delete)
- document 1:N document_version (cascade delete)
- document 1:N document_relation (cascade delete, both directions)
- document_locale 1:1 draft_version (nullable FK)
- document_locale 1:1 published_version (nullable FK)
- content_type 1:N document (RESTRICT on delete if documents exist)

## State Transitions

- **Document**: created (with first locale + v1 draft) → versions accumulate → tombstoned on delete
- **DocumentVersion**: insert-only (immutable) → pointed to by draft/published pointers
- **DocumentLocale**: created with draft pointer → publish sets published pointer → unpublish clears → delete tombstones parent
- **Publish**: O(1) pointer flip (published_version_id + published_at + first_published_at)
