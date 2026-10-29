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

-- Exactly-one-draft invariant
ALTER TABLE document_locales ADD CONSTRAINT IF NOT EXISTS document_locales_draft_ne_published
  CHECK (draft_version_id IS DISTINCT FROM published_version_id);

-- Partial unique index for slug per locale
CREATE UNIQUE INDEX IF NOT EXISTS document_versions_slug_unique_per_locale
  ON document_versions (locale, slug)
  WHERE slug IS NOT NULL;

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
