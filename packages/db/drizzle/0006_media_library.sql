CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'cloudinary' NOT NULL,
	"provider_key" text NOT NULL,
	"url" text NOT NULL,
	"secure_url" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_s" integer,
	"hash_sha256" text,
	"folder_id" uuid,
	"alt" text,
	"caption" text,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" uuid,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_provider_key_unique" UNIQUE("provider","provider_key"),
	CONSTRAINT "media_assets_size_check" CHECK ("media_assets"."size_bytes" > 0 AND "media_assets"."size_bytes" <= 104857600),
	CONSTRAINT "media_assets_mime_check" CHECK ("media_assets"."mime" ~ '^.+/.+$')
);
--> statement-breakpoint
CREATE TABLE "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"path" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_folders_parent_name_unique" UNIQUE("parent_id","name"),
	CONSTRAINT "media_folders_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "media_usage" (
	"asset_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"field_path" text NOT NULL,
	"version_id" uuid
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "media_assets" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "media_assets_mime_idx" ON "media_assets" USING btree ("mime" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "media_assets_hash_idx" ON "media_assets" USING btree ("hash_sha256");--> statement-breakpoint
CREATE INDEX "media_assets_not_deleted_idx" ON "media_assets" USING btree ("deleted_at") WHERE "media_assets"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "media_folders_path_idx" ON "media_folders" USING btree ("path" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "media_usage_document_locale_idx" ON "media_usage" USING btree ("document_id","locale");--> statement-breakpoint
CREATE INDEX "media_usage_asset_idx" ON "media_usage" USING btree ("asset_id");--> statement-breakpoint


-- Folder path materialization, cycle guard, depth limit (research Decision 4)
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_media_folders_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "public"."media_folders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_no_self_parent"
  CHECK ("media_folders"."id" <> "media_folders"."parent_id");

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
    WHERE path LIKE OLD.path || '/%';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS media_folders_path_sync ON media_folders;
CREATE TRIGGER media_folders_path_sync
  BEFORE INSERT OR UPDATE OF parent_id, name ON media_folders
  FOR EACH ROW EXECUTE FUNCTION media_folders_sync_path();
