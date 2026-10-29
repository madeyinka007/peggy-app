# Research: Media Library (Slice 5)

## Decision 1: Cloudinary signing without the SDK in core

- **Decision**: Use the `cloudinary` npm package ONLY inside `packages/storage/src/cloudinary-provider.ts`. Core service (`media-service.ts`) depends on the `StorageProvider` port interface. Signature generation (`api_sign_request`) follows Cloudinary's documented SHA-1/SHA-256 param-signing (sorted params + api_secret), so unit tests can assert signatures without network.
- **Rationale**: Constitution P-03 (NON-NEGOTIABLE): core never imports the Cloudinary SDK. Signing is pure crypto — no SDK needed for `sign`; the SDK (or plain fetch) is only needed for server-side HEAD cross-checks on confirm.
- **Alternatives considered**: (a) SDK everywhere — rejected (violates P-03). (b) No SDK at all, hand-rolled fetch — viable; keep SDK as an optional dependency of the provider adapter only if it simplifies upload-preset handling.

## Decision 2: Confirm via provider HEAD cross-check

- **Decision**: `POST /api/v1/media` confirm does a server-side HEAD/GET against the provider URL (or Cloudinary Admin API `resource` lookup) to verify `providerKey` exists and capture authoritative `mime`/`sizeBytes`/dimensions before inserting the metadata row. Mismatch → 422.
- **Rationale**: Prevents phantom rows pointing at nothing; captures dimensions without trusting client input. Spec edge case `PROVIDER_KEY_NOT_FOUND`.
- **Alternatives considered**: Trust client-reported metadata — rejected (integrity risk, spec requires cross-check).

## Decision 3: media_usage ledger written by document service

- **Decision**: `media_usage` rows are written/updated by the document service at version-create time (scan `data` JSONB for media field references per the content type's `media` fields), not by the media service. Delete-guard reads the ledger only (O(1)).
- **Rationale**: DB doc §16 reasoning: ledger survives data-shape changes; guards stay O(1). Document service owns version writes, so it owns ledger writes in the same transaction.
- **Alternatives considered**: JSON scan at delete time — rejected (O(n), breaks on shape changes).

## Decision 4: Folder path as materialized column with trigger

- **Decision**: `media_folders.path` maintained by a Postgres trigger on insert/update of `parent_id`/`name` (cascade to descendants in the same trigger via prefix update). Cycle check in the same trigger (ancestor walk, max 8 hops = depth limit).
- **Rationale**: DB doc §16/§17: `UNIQUE(path)`, `text_pattern_ops` index, single-statement move. Cycle + depth enforced at the DB layer so concurrent moves can't corrupt the tree.
- **Alternatives considered**: App-level path maintenance — rejected (race-prone, N+1 on move).

## Decision 5: Transform presets provisional, read-time only

- **Decision**: MVP presets `thumb (w=150)`, `card (w=600)`, `hero (w=1600)`, `original`, all with `f_auto,q_auto`. `transformUrl` builds a Cloudinary fetch URL (`https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{publicId}`); no DB writes, no `derived` rows in MVP (OQ-02 resolved: finalize exact presets after plan-limit check during implementation).
- **Rationale**: PRD FR-028 + NG scope. Read-time URLs keep the schema stable.
- **Alternatives considered**: Stored derived rows — deferred post-MVP per spec Out of Scope.

## Decision 6: File-size guard via route-level content-length check

- **Decision**: `POST /api/v1/media` and document routes reject `Content-Length` exceeding a service constant with `413 PAYLOAD_TOO_LARGE` + pointer to the signed flow, before body parsing. No multipart handling in the handler.
- **Rationale**: Spec FR-003 + serverless payload/timeout constraint (PRD §14). Signed flow is the only upload path.
- **Alternatives considered**: express.json limit only — insufficient (needs explicit 413 + guidance payload).
