CREATE TYPE "public"."domain_source" AS ENUM('purchased', 'external');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('registering', 'configuring', 'active', 'failed', 'expired', 'transferred_out');--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"tld" text NOT NULL,
	"source" "domain_source" NOT NULL,
	"status" "domain_status" DEFAULT 'registering' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"registrant" jsonb,
	"whois_privacy" boolean DEFAULT true NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"provider" text,
	"provider_domain_id" text,
	"cf_custom_hostname_id" text,
	"dns" jsonb,
	"price_snapshot" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_name_lowercase_ck" CHECK ("domains"."name" = lower("domains"."name") AND char_length("domains"."name") <= 253),
	CONSTRAINT "domains_tld_lowercase_ck" CHECK ("domains"."tld" = lower("domains"."tld") AND char_length("domains"."tld") <= 63),
	CONSTRAINT "domains_provider_ck" CHECK ("domains"."provider" IS NULL OR "domains"."provider" = 'openprovider')
);
--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domains_userId_idx" ON "domains" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domains_projectId_idx" ON "domains" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "domains_status_idx" ON "domains" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_name_uq" ON "domains" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_primary_project_uq" ON "domains" USING btree ("project_id") WHERE "domains"."is_primary" = true;