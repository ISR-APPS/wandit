CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"target_id" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "auth_session_id" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "failure_source" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "failure_provider" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "failure_provider_message" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "failure_request_id" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "sentry_event_id" text;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_events_adminUserId_createdAt_idx" ON "admin_audit_events" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_targetUserId_idx" ON "admin_audit_events" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_createdAt_idx" ON "admin_audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "chats_projectId_updatedAt_idx" ON "chats" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "messages_failureKind_createdAt_idx" ON "messages" USING btree ("failure_kind","created_at") WHERE "messages"."failure_kind" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "connector_generation_attempts_failureKind_createdAt_idx" ON "connector_generation_attempts" USING btree ("failure_kind","created_at") WHERE "connector_generation_attempts"."failure_kind" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "image_generation_attempts_failureKind_createdAt_idx" ON "image_generation_attempts" USING btree ("failure_kind","created_at") WHERE "image_generation_attempts"."failure_kind" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "marketing_assets_failureKind_createdAt_idx" ON "marketing_assets" USING btree ("failure_kind","created_at") WHERE "marketing_assets"."failure_kind" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "media_generation_attempts_failureKind_createdAt_idx" ON "media_generation_attempts" USING btree ("failure_kind","created_at") WHERE "media_generation_attempts"."failure_kind" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "page_generation_attempts_failureKind_createdAt_idx" ON "page_generation_attempts" USING btree ("failure_kind","created_at") WHERE "page_generation_attempts"."failure_kind" IS NOT NULL;