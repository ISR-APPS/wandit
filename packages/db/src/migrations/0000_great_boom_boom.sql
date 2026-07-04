CREATE TYPE "public"."artifact_kind" AS ENUM('landing_page');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."credit_kind" AS ENUM('grant', 'consume', 'topup', 'expire', 'revoke');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'active', 'failed', 'superseded', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('to_confirm', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled');--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "artifact_kind" NOT NULL,
	"active_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"r2_key" text NOT NULL,
	"message_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role" "message_role" NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"kind" "credit_kind" NOT NULL,
	"idempotency_key" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_delta_sign_chk" CHECK (("credit_ledger"."kind" IN ('grant', 'topup') AND "credit_ledger"."delta" > 0) OR ("credit_ledger"."kind" IN ('consume', 'expire', 'revoke') AND "credit_ledger"."delta" < 0))
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"status" "deployment_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deployments_slug_dns_label_ck" CHECK ("deployments"."slug" ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' AND char_length("deployments"."slug") <= 63)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"deployment_id" uuid,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"wilaya" text,
	"commune" text,
	"extras" jsonb,
	"attribution" jsonb,
	"status" "lead_status" DEFAULT 'to_confirm' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_phone_e164_ck" CHECK ("leads"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"public_form_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"preview_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"meta_pixel_id" text,
	"tiktok_pixel_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_id_projectId_uq" ON "artifacts" USING btree ("id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "versions_artifactId_id_uq" ON "versions" USING btree ("artifact_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "versions_projectId_id_uq" ON "versions" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_projectId_id_uq" ON "deployments" USING btree ("project_id","id");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_active_version_fk" FOREIGN KEY ("id","active_version_id") REFERENCES "public"."versions"("artifact_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_artifact_project_fk" FOREIGN KEY ("artifact_id","project_id") REFERENCES "public"."artifacts"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_version_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "public"."versions"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_deployment_fk" FOREIGN KEY ("project_id","deployment_id") REFERENCES "public"."deployments"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_projectId_idx" ON "artifacts" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_project_landing_uq" ON "artifacts" USING btree ("project_id") WHERE "artifacts"."kind" = 'landing_page';--> statement-breakpoint
CREATE UNIQUE INDEX "versions_artifactId_number_uq" ON "versions" USING btree ("artifact_id","number");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_uq" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "chats_projectId_idx" ON "chats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "messages_chatId_seq_idx" ON "messages" USING btree ("chat_id","seq");--> statement-breakpoint
CREATE INDEX "credit_ledger_userId_createdAt_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotencyKey_uq" ON "credit_ledger" USING btree ("idempotency_key") WHERE "credit_ledger"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "deployments_projectId_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_active_slug_uq" ON "deployments" USING btree ("slug") WHERE "deployments"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_active_project_uq" ON "deployments" USING btree ("project_id") WHERE "deployments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "leads_projectId_createdAt_idx" ON "leads" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_projectId_status_createdAt_idx" ON "leads" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE INDEX "projects_userId_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_dashboard_idx" ON "projects" USING btree ("user_id","updated_at") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_publicFormId_uq" ON "projects" USING btree ("public_form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_previewToken_uq" ON "projects" USING btree ("preview_token");
