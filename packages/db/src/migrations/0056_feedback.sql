CREATE TYPE "public"."feedback_activity_kind" AS ENUM('received', 'status_changed', 'priority_changed', 'note_updated');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('bug', 'idea', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewing', 'planned', 'resolved');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"reporter_name" text NOT NULL,
	"reporter_email" text NOT NULL,
	"project_id" uuid,
	"category" "feedback_category",
	"message" text NOT NULL,
	"page_url" text NOT NULL,
	"replay_url" text,
	"sentry_event_id" text,
	"sentry_event_at" timestamp with time zone,
	"user_agent" text,
	"viewport_width" integer,
	"viewport_height" integer,
	"locale" text,
	"screenshot_url" text,
	"linear_issue_id" text,
	"linear_issue_url" text,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"priority" "feedback_priority" DEFAULT 'medium' NOT NULL,
	"admin_note" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"kind" "feedback_activity_kind" NOT NULL,
	"from_value" text,
	"to_value" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_activities" ADD CONSTRAINT "feedback_activities_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_activities" ADD CONSTRAINT "feedback_activities_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_createdAt_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_userId_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_activities_feedbackId_createdAt_idx" ON "feedback_activities" USING btree ("feedback_id","created_at");