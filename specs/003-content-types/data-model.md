# Data Model: Content Types and Schema Registry (Slice 2)

## Content Types

### content_types
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL, UNIQUE |
| kind | text | NOT NULL, CHECK(kind IN ('collection','single')) |
| collectionSlug | text | NOT NULL, UNIQUE, CHECK(collection_slug ~ '^[a-z0-9-]+$') |
| displayName | text | nullable |
| description | text | nullable |
| isLocalized | boolean | default false, NOT NULL |
| hasDraftPublish | boolean | default true, NOT NULL |
| activeSchemaVersion | int | default 1, NOT NULL |
| createdBy | uuid | FK → user.id, ON DELETE SET NULL |
| createdAt | timestamp | default now, NOT NULL |
| updatedAt | timestamp | default now, NOT NULL |

## Content Fields

### content_fields
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| contentTypeId | uuid | FK → content_types.id, ON DELETE CASCADE, nullable |
| componentId | uuid | FK → components.id, ON DELETE CASCADE, nullable |
| name | text | NOT NULL |
| label | text | nullable |
| fieldType | text | NOT NULL (text\|richtext\|markdown\|number\|boolean\|date\|datetime\|time\|json\|email\|uid\|enumeration\|media\|relation\|component\|dynamiczone) |
| required | boolean | default false, NOT NULL |
| uniqueScope | text | nullable (null\|per_locale\|global) |
| defaultValue | jsonb | nullable |
| localized | boolean | default false, NOT NULL |
| searchable | boolean | default false, NOT NULL |
| indexedHint | boolean | default false, NOT NULL |
| validation | jsonb | NOT NULL, default '{}' |
| relationConfig | jsonb | nullable |
| componentConfig | jsonb | nullable |
| dynamiczoneConfig | jsonb | nullable |
| mediaConfig | jsonb | nullable |
| sortOrder | int | NOT NULL, default 0 |
| createdAt | timestamp | default now, NOT NULL |
| updatedAt | timestamp | default now, NOT NULL |

**Constraints:**
- CHECK(contentTypeId IS NULL) <> (componentId IS NULL) — exactly one owner
- UNIQUE(contentTypeId, name) WHERE contentTypeId IS NOT NULL
- UNIQUE(componentId, name) WHERE componentId IS NOT NULL

## Components

### components
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL, UNIQUE |
| displayName | text | nullable |
| category | text | nullable |
| activeSchemaVersion | int | default 1, NOT NULL |
| createdAt | timestamp | default now, NOT NULL |
| updatedAt | timestamp | default now, NOT NULL |

## Schema Versions

### schema_versions
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| ownerKind | text | NOT NULL (content_type\|component) |
| ownerId | uuid | NOT NULL |
| version | int | NOT NULL |
| snapshot | jsonb | NOT NULL |
| createdAt | timestamp | default now, NOT NULL |

**Constraints:**
- UNIQUE(ownerKind, ownerId, version)

## Relationships

- content_type 1:N content_field (via contentTypeId, cascade delete)
- component 1:N content_field (via componentId, cascade delete)
- content_type 1:N schema_version (via ownerKind='content_type' + ownerId)
- component 1:N schema_version (via ownerKind='component' + ownerId)

## State Transitions

- **ContentType**: created (v1) → field mutations (v bumps) → soft-blocked delete if documents exist
- **Component**: created (v1) → field mutations (v bumps) → blocked delete if referenced by fields
- **ContentField**: added → configured → deprecated (hidden from new docs, readable on old) — never silently dropped
