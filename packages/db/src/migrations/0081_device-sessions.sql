CREATE TYPE "public"."device_session_platform" AS ENUM('ios', 'android');--> statement-breakpoint
ALTER TYPE "public"."ai_cost_transport" ADD VALUE 'appetize';--> statement-breakpoint
ALTER TYPE "public"."ai_usage_operation" ADD VALUE 'mobile_preview' BEFORE 'topup_adjust';--> statement-breakpoint
CREATE TABLE "device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid,
	"platform" "device_session_platform" NOT NULL,
	"appetize_session_token" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"minutes" integer,
	"billed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_sessions_appetizeSessionToken_uq" ON "device_sessions" USING btree ("appetize_session_token") WHERE "device_sessions"."appetize_session_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "device_sessions_unbilled_startedAt_idx" ON "device_sessions" USING btree ("started_at") WHERE "device_sessions"."billed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "device_sessions_userId_startedAt_idx" ON "device_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "device_sessions_organizationId_startedAt_idx" ON "device_sessions" USING btree ("organization_id","started_at");