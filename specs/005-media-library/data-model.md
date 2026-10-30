# Data Model: Media Library (Slice 5)

Source: `doc/03-database-model.md` §16–§17. All three tables are **system metadata** (migrated, relational) per Constitution II.

## media_folders

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL |
| parent_id | uuid | FK → media_folders.id, ON DELETE CASCADE, nullable (NULL = root) |
| path | text | NOT NULL, materialized `/landing/hero`, trigger-maintained |
| created_by | uuid | FK → user.id, ON DELETE SET NULL |
| created_at / updated_at | timestamptz | defaults |

**Constraints**: `CHECK(id <> parent_id)`; `UNIQUE(parent_id, name)` + `UNIQUE(path)`; cycle-prevention trigger (ancestor walk); depth limit 8 (service constant + trigger hop cap); `INDEX(path text_pattern_ops)`; recursive CTE for descendants.

**State transitions**: create → rename/move (path cascade in one trigger) → delete (blocked if assets inside unless `recursive=true` + `media.manage`).

## media_assets

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| provider | text | NOT NULL, DEFAULT 'cloudinary' |
| provider_key | text | NOT NULL (Cloudinary public_id) |
| url / secure_url | text | NOT NULL |
| mime | text | NOT NULL, `CHECK(mime ~ '^.+/.+$')` |
| size_bytes | int | NOT NULL, `CHECK(> 0 AND <= 104857600)` |
| width / height | int | nullable |
| duration_s | numeric | nullable |
| hash_sha256 | text | nullable (dedupe/integrity) |
| folder_id | uuid | FK → media_folders, ON DELETE SET NULL |
| alt / caption | text | nullable |
| variants | jsonb | DEFAULT '[]' (named presets used) |
| uploaded_by | uuid | FK → user.id, ON DELETE SET NULL |
| deleted_at | timestamptz | nullable (soft-delete) |
| created_at / updated_at | timestamptz | defaults |

**Indexes**: `UNIQUE(provider, provider_key)`; `INDEX(folder_id)`; `INDEX(mime text_pattern_ops)`; `INDEX(hash_sha256)`; partial `INDEX WHERE deleted_at IS NULL`.

**Policy (service, not schema)**: SVG blocked by default (XSS) unless sanitized + explicit enable; MIME allowlist + size limits configurable via env.

**Lifecycle**: signed → confirmed (HEAD cross-check) → attached (media_usage row) → replaced (new row, refs moved per policy) → soft-deleted (provider destroy queued) → purged.

## media_usage

| Field | Type | Constraints |
|---|---|---|
| asset_id | uuid | FK → media_assets, ON DELETE CASCADE |
| document_id | uuid | FK → documents, ON DELETE CASCADE |
| locale | text | NOT NULL |
| field_path | text | NOT NULL (e.g. `cover`, `sections[2].image`) |
| version_id | uuid | FK → document_versions, nullable (records when) |
| PK | (asset_id, document_id, locale, field_path) | composite |

**Indexes**: PK; `INDEX(document_id, locale)`; `INDEX(asset_id)`.

**Written by**: document service at version-create time (same transaction as the version row). **Read by**: media delete-guard (O(1)) and "where is this used?" reverse lookup.

## Relationships

- `media_folders` self-nests (parent_id); contains `media_assets` (folder_id, SET NULL).
- `media_assets` ↔ `documents` via `media_usage` ledger (both CASCADE).
- `users.avatar_asset_id` → `media_assets.id` (SET NULL) — pre-existing FK, unaffected.
