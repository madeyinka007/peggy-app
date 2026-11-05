-- Slice 5 convergence (T043/T044): media_usage integrity + trigger hardening.
--> statement-breakpoint
-- Dedupe legacy rows before adding the PK (the pre-0007 table had no PK, so
-- the append-only era may hold several rows per (asset, document, locale,
-- field_path) with differing versionIds). Keep exactly one row per key:
-- prefer rows that record a versionId, tie-break on physical row order.
DELETE FROM "media_usage" a
WHERE a."version_id" IS NULL AND EXISTS (
  SELECT 1 FROM "media_usage" b
  WHERE b."asset_id" = a."asset_id"
    AND b."document_id" = a."document_id"
    AND b."locale" = a."locale"
    AND b."field_path" = a."field_path"
    AND b."version_id" IS NOT NULL
);
--> statement-breakpoint
DELETE FROM "media_usage" a
WHERE a."ctid" NOT IN (
  SELECT max("ctid") FROM "media_usage"
  GROUP BY "asset_id", "document_id", "locale", "field_path"
);
--> statement-breakpoint
ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_pkey" PRIMARY KEY ("asset_id","document_id","locale","field_path");
--> statement-breakpoint
ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION media_folders_sync_path() RETURNS trigger AS $$
DECLARE
  new_path text;
  old_path text;
  depth int;
  ancestor uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    new_path := '/' || NEW.name;
  ELSE
    SELECT path INTO old_path FROM media_folders WHERE id = NEW.parent_id;
    IF old_path IS NULL THEN
      RAISE EXCEPTION 'MEDIA_FOLDER_PARENT_NOT_FOUND';
    END IF;
    new_path := old_path || '/' || NEW.name;
  END IF;

  depth := array_length(string_to_array(trim(both '/' from new_path), '/'), 1);
  IF depth > 8 THEN
    RAISE EXCEPTION 'FOLDER_DEPTH_EXCEEDED';
  END IF;

  ancestor := NEW.parent_id;
  WHILE ancestor IS NOT NULL LOOP
    IF ancestor = NEW.id THEN
      RAISE EXCEPTION 'FOLDER_CYCLE';
    END IF;
    SELECT parent_id INTO ancestor FROM media_folders WHERE id = ancestor;
  END LOOP;

  NEW.path := new_path;

  IF TG_OP = 'UPDATE' AND OLD.path IS DISTINCT FROM new_path THEN
    UPDATE media_folders
    SET path = new_path || substring(path from length(OLD.path) + 1)
    WHERE starts_with(path, OLD.path || '/');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
