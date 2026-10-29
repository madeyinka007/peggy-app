CREATE TABLE "document_locales" (
	"document_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"draft_version_id" uuid,
	"published_version_id" uuid,
	"published_at" timestamp,
	"first_published_at" timestamp,
	"scheduled_at" timestamp,
	"scheduled_version_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_locales_document_id_locale_pk" PRIMARY KEY("document_id","locale")
);
--> statement-breakpoint
CREATE TABLE "document_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"target_document_id" uuid NOT NULL,
	"relation_field" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"slug" text,
	"published_at_snapshot" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_doc_locale_version_unique" UNIQUE("document_id","locale","version"),
	CONSTRAINT "document_versions_status_check" CHECK ("document_versions"."status" IN ('draft', 'published', 'in_review', 'scheduled', 'archived')),
	CONSTRAINT "document_versions_data_check" CHECK (jsonb_typeof("document_versions"."data") = 'object')
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"content_type_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "documents_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"fallback_chain" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_locales" ADD CONSTRAINT "document_locales_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_locales" ADD CONSTRAINT "document_locales_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_locales" ADD CONSTRAINT "document_locales_draft_version_id_document_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_locales" ADD CONSTRAINT "document_locales_published_version_id_document_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_locales" ADD CONSTRAINT "document_locales_scheduled_version_id_document_versions_id_fk" FOREIGN KEY ("scheduled_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_target_document_id_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_versions_doc_locale_idx" ON "document_versions" USING btree ("document_id","locale","created_at");--> statement-breakpoint
CREATE INDEX "documents_content_type_idx" ON "documents" USING btree ("content_type_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_deleted_at_idx" ON "documents" USING btree ("deleted_at");