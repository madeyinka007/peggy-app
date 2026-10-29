-- Cross-table uniqueness enforcement for (content_type_id, locale, slug)
CREATE OR REPLACE FUNCTION check_slug_uniqueness() RETURNS trigger AS $$
DECLARE
  ct_id uuid;
  existing_count int;
BEGIN
  SELECT content_type_id INTO ct_id FROM documents WHERE id = NEW.document_id;
  SELECT count(*) INTO existing_count
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id
  WHERE d.content_type_id = ct_id
    AND dv.locale = NEW.locale
    AND dv.slug = NEW.slug
    AND dv.id <> NEW.id
    AND NEW.slug IS NOT NULL;
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'slug conflict: published/ existing document with same slug in locale';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS document_versions_slug_unique ON document_versions;
CREATE TRIGGER document_versions_slug_unique BEFORE INSERT OR UPDATE ON document_versions
  FOR EACH ROW WHEN (NEW.slug IS NOT NULL)
  EXECUTE FUNCTION check_slug_uniqueness();
