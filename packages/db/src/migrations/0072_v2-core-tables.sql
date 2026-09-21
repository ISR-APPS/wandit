CREATE TYPE "public"."app_backend_provider" AS ENUM('supabase');--> statement-breakpoint
CREATE TYPE "public"."app_backend_status" AS ENUM('creating', 'active', 'paused', 'restoring', 'deleting', 'error');--> statement-breakpoint
CREATE TYPE "public"."app_commit_source" AS ENUM('agent', 'restore', 'wip', 'merge');--> statement-breakpoint
CREATE TYPE "public"."builder_harness" AS ENUM('claude_code', 'opencode');--> statement-breakpoint
CREATE TYPE "public"."builder_turn_status" AS ENUM('queued', 'waiting', 'running', 'cancelling', 'waiting_for_answer', 'waiting_for_approval', 'succeeded', 'failed', 'canceled', 'stalled', 'stopped_no_credits', 'stopped_project_cap', 'stopped_disabled');--> statement-breakpoint
CREATE TYPE "public"."project_engine" AS ENUM('v1_page', 'v2_app');--> statement-breakpoint
CREATE TYPE "public"."project_target_platform" AS ENUM('web', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."sandbox_session_status" AS ENUM('creating', 'running', 'stopped', 'expired', 'destroyed', 'error');--> statement-breakpoint
CREATE TABLE "app_backends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"provider" "app_backend_provider" DEFAULT 'supabase' NOT NULL,
	"ref" text,
	"region" text NOT NULL,
	"org_id" text,
	"status" "app_backend_status" DEFAULT 'creating' NOT NULL,
	"anon_key" text,
	"service_role_secret_id" uuid,
	"db_password_secret_id" uuid,
	"db_host" text,
	"paused_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"deleting_at" timestamp with time zone,
	"request_key" text NOT NULL,
	"trigger_run_id" text,
	"error" text,
	"failure_code" text,
	"failure_kind" text,
	"failure_source" text,
	"failure_provider" text,
	"failure_provider_message" text,
	"failure_request_id" text,
	"sentry_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"head_sha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"turn_id" uuid,
	"message_id" text,
	"sha" text NOT NULL,
	"parent_sha" text,
	"message" text NOT NULL,
	"source" "app_commit_source" NOT NULL,
	"restored_from_sha" text,
	"numstat" jsonb,
	"patch_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"organization_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"project_id" uuid,
	"metadata" jsonb,
	"ip" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"provider_session_id" text,
	"resume_state" jsonb,
	"transcript_pointer" text,
	"model" text,
	"harness" "builder_harness" DEFAULT 'claude_code' NOT NULL,
	"template_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"session_id" uuid,
	"message_id" text,
	"status" "builder_turn_status" DEFAULT 'queued' NOT NULL,
	"request_key" text NOT NULL,
	"trigger_run_id" text,
	"turn_number" integer NOT NULL,
	"harness" "builder_harness",
	"model" text,
	"input_commit_sha" text,
	"output_commit_sha" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"credits" integer,
	"spec" jsonb NOT NULL,
	"error" text,
	"failure_code" text,
	"failure_kind" text,
	"failure_source" text,
	"failure_provider" text,
	"failure_provider_message" text,
	"failure_request_id" text,
	"sentry_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_cost_caps" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"monthly_cap_credits" integer,
	"per_turn_cap_credits" integer,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_cost_caps_monthly_cap_nonnegative_ck" CHECK ("project_cost_caps"."monthly_cap_credits" IS NULL OR "project_cost_caps"."monthly_cap_credits" >= 0),
	CONSTRAINT "project_cost_caps_per_turn_cap_nonnegative_ck" CHECK ("project_cost_caps"."per_turn_cap_credits" IS NULL OR "project_cost_caps"."per_turn_cap_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sandbox_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_sandbox_id" text,
	"image" text,
	"status" "sandbox_session_status" DEFAULT 'creating' NOT NULL,
	"preview_host" text,
	"expires_at" timestamp with time zone,
	"last_snapshot_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "v2_builder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "turn_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "engine" "project_engine" DEFAULT 'v1_page' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_platform" "project_target_platform";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "framework" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_version" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "app_backends" ADD CONSTRAINT "app_backends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_backends" ADD CONSTRAINT "app_backends_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_backends" ADD CONSTRAINT "app_backends_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_branches" ADD CONSTRAINT "app_branches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_branches" ADD CONSTRAINT "app_branches_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_branches" ADD CONSTRAINT "app_branches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_commits" ADD CONSTRAINT "app_commits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_commits" ADD CONSTRAINT "app_commits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_commits" ADD CONSTRAINT "app_commits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_commits" ADD CONSTRAINT "app_commits_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_commits" ADD CONSTRAINT "app_commits_turn_id_builder_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."builder_turns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_sessions" ADD CONSTRAINT "builder_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_sessions" ADD CONSTRAINT "builder_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_sessions" ADD CONSTRAINT "builder_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_sessions" ADD CONSTRAINT "builder_sessions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_turns" ADD CONSTRAINT "builder_turns_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_turns" ADD CONSTRAINT "builder_turns_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_turns" ADD CONSTRAINT "builder_turns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_turns" ADD CONSTRAINT "builder_turns_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_turns" ADD CONSTRAINT "builder_turns_session_id_builder_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."builder_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_caps" ADD CONSTRAINT "project_cost_caps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_caps" ADD CONSTRAINT "project_cost_caps_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_backends_projectId_uq" ON "app_backends" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_backends_provider_ref_uq" ON "app_backends" USING btree ("provider","ref") WHERE "app_backends"."ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "app_backends_requestKey_uq" ON "app_backends" USING btree ("request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "app_backends_projectId_id_uq" ON "app_backends" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_branches_projectId_name_uq" ON "app_branches" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "app_branches_projectId_id_uq" ON "app_branches" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_commits_projectId_sha_uq" ON "app_commits" USING btree ("project_id","sha");--> statement-breakpoint
CREATE INDEX "app_commits_projectId_createdAt_idx" ON "app_commits" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "app_commits_projectId_id_uq" ON "app_commits" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "audit_events_projectId_createdAt_idx" ON "audit_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actorUserId_createdAt_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_createdAt_idx" ON "audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_projectId_id_uq" ON "audit_events" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_sessions_chatId_uq" ON "builder_sessions" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_sessions_projectId_id_uq" ON "builder_sessions" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_turns_active_project_uq" ON "builder_turns" USING btree ("project_id") WHERE "builder_turns"."status" IN ('queued', 'running', 'cancelling');--> statement-breakpoint
CREATE UNIQUE INDEX "builder_turns_chatId_requestKey_uq" ON "builder_turns" USING btree ("chat_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_turns_projectId_turnNumber_uq" ON "builder_turns" USING btree ("project_id","turn_number");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_turns_projectId_id_uq" ON "builder_turns" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "builder_turns_projectId_createdAt_idx" ON "builder_turns" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_turns_triggerRunId_idx" ON "builder_turns" USING btree ("trigger_run_id") WHERE "builder_turns"."trigger_run_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "builder_turns_chatId_status_idx" ON "builder_turns" USING btree ("chat_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_sessions_live_project_uq" ON "sandbox_sessions" USING btree ("project_id") WHERE "sandbox_sessions"."status" IN ('creating', 'running', 'stopped');--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_sessions_projectId_id_uq" ON "sandbox_sessions" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "messages_turnId_idx" ON "messages" USING btree ("turn_id") WHERE "messages"."turn_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ai_usage_events_projectId_createdAt_idx" ON "ai_usage_events" USING btree ("project_id","created_at") WHERE "ai_usage_events"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_engine_idx" ON "projects" USING btree ("engine") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_languages_allowed_ck" CHECK ("projects"."languages" <@ ARRAY['ar','fr','en']::text[]);