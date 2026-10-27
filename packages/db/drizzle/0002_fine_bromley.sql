CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"category" text,
	"active_schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "components_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "content_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type_id" uuid,
	"component_id" uuid,
	"name" text NOT NULL,
	"label" text,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"unique_scope" text,
	"default_value" jsonb,
	"localized" boolean DEFAULT false NOT NULL,
	"searchable" boolean DEFAULT false NOT NULL,
	"indexed_hint" boolean DEFAULT false NOT NULL,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relation_config" jsonb,
	"component_config" jsonb,
	"dynamiczone_config" jsonb,
	"media_config" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_fields_content_type_name_unique" UNIQUE("content_type_id","name"),
	CONSTRAINT "content_fields_component_name_unique" UNIQUE("component_id","name"),
	CONSTRAINT "content_fields_owner_check" CHECK (("content_fields"."content_type_id" IS NULL) <> ("content_fields"."component_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "content_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"collection_slug" text NOT NULL,
	"display_name" text,
	"description" text,
	"is_localized" boolean DEFAULT false NOT NULL,
	"has_draft_publish" boolean DEFAULT true NOT NULL,
	"active_schema_version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_types_name_unique" UNIQUE("name"),
	CONSTRAINT "content_types_collection_slug_unique" UNIQUE("collection_slug"),
	CONSTRAINT "content_types_kind_check" CHECK ("content_types"."kind" IN ('collection', 'single')),
	CONSTRAINT "content_types_slug_check" CHECK ("content_types"."collection_slug" ~ '^[a-z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "schema_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schema_versions_owner_version_unique" UNIQUE("owner_kind","owner_id","version")
);
--> statement-breakpoint
ALTER TABLE "content_fields" ADD CONSTRAINT "content_fields_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_fields" ADD CONSTRAINT "content_fields_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_fields_content_type_idx" ON "content_fields" USING btree ("content_type_id");--> statement-breakpoint
CREATE INDEX "content_fields_component_idx" ON "content_fields" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "content_types_kind_idx" ON "content_types" USING btree ("kind");