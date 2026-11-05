-- Immutability trigger: reject UPDATE/DELETE on document_versions
CREATE OR REPLACE FUNCTION reject_document_version_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_versions is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS document_versions_immutable ON document_versions;
CREATE TRIGGER document_versions_immutable BEFORE UPDATE OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION reject_document_version_mutation();

-- Content type immutability: reject UPDATE of content_type_id on documents
CREATE OR REPLACE FUNCTION reject_content_type_change() RETURNS trigger AS $$
BEGIN
  IF NEW.content_type_id IS DISTINCT FROM OLD.content_type_id THEN
    RAISE EXCEPTION 'content_type_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS documents_content_type_immutable ON documents;
CREATE TRIGGER documents_content_type_immutable BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION reject_content_type_change();

-- Exactly-one-draft invariant: NOT enforced as a CHECK constraint.
-- publishDocument() promotes in place (published_version_id := draft_version_id),
-- so draft and published legitimately point at the same version row after a
-- publish. A CHECK (draft_version_id IS DISTINCT FROM published_version_id)
-- would reject every publish -- it contradicts the application and was never
-- valid syntax (ADD CONSTRAINT has no IF NOT EXISTS) so it never applied
-- anywhere. If a "no stale draft" invariant is wanted later, enforce it in the
-- publish flow, not here.

-- Partial unique index for slug per locale: NOT created. document_versions
-- holds one row per version, and the slug travels forward with each new
-- version of the same document -- so (locale, slug) is not unique in this
-- table by design ("same-document new version keeps slug" must not 409).
-- Cross-document slug conflicts are enforced by the 0005 trigger
-- (document_versions_slug_unique), which correctly excludes other versions
-- of the same document.

-- Note: cross-table partial unique on (content_type_id, locale, slug) requires a
-- materialized approach; enforced additionally at application level.

-- Make FKs deferrable (recreate)
ALTER TABLE document_locales DROP CONSTRAINT IF EXISTS document_locales_document_id_documents_id_fk;
ALTER TABLE document_locales ADD CONSTRAINT document_locales_document_id_documents_id_fk
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE document_locales DROP CONSTRAINT IF EXISTS document_locales_locale_locales_code_fk;
ALTER TABLE document_locales ADD CONSTRAINT document_locales_locale_locales_code_fk
  FOREIGN KEY (locale) REFERENCES locales(code) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE document_locales DROP CONSTRAINT IF EXISTS document_locales_draft_version_id_document_versions_id_fk;
ALTER TABLE document_locales ADD CONSTRAINT document_locales_draft_version_id_document_versions_id_fk
  FOREIGN KEY (draft_version_id) REFERENCES document_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE document_locales DROP CONSTRAINT IF EXISTS document_locales_published_version_id_document_versions_id_fk;
ALTER TABLE document_locales ADD CONSTRAINT document_locales_published_version_id_document_versions_id_fk
  FOREIGN KEY (published_version_id) REFERENCES document_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
