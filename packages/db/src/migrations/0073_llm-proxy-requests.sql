CREATE TYPE "public"."llm_proxy_inbound_format" AS ENUM('anthropic', 'openai');--> statement-breakpoint
CREATE TYPE "public"."llm_proxy_request_status" AS ENUM('ok', 'upstream_error', 'cap_rejected', 'model_denied', 'client_aborted', 'rate_limited');--> statement-breakpoint
CREATE TABLE "llm_proxy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"turn_id" uuid,
	"user_id" text,
	"project_id" uuid,
	"organization_id" text,
	"provider" text,
	"model" text,
	"inbound_format" "llm_proxy_inbound_format" NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"usd_micros" integer,
	"status" "llm_proxy_request_status" NOT NULL,
	"reason" text,
	"upstream_request_id" text,
	"claude_session_id" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_proxy_requests" ADD CONSTRAINT "llm_proxy_requests_turn_id_builder_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."builder_turns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_proxy_requests" ADD CONSTRAINT "llm_proxy_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_proxy_requests" ADD CONSTRAINT "llm_proxy_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_proxy_requests" ADD CONSTRAINT "llm_proxy_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_proxy_requests_runId_idx" ON "llm_proxy_requests" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "llm_proxy_requests_turnId_idx" ON "llm_proxy_requests" USING btree ("turn_id");--> statement-breakpoint
CREATE INDEX "llm_proxy_requests_projectId_createdAt_idx" ON "llm_proxy_requests" USING btree ("project_id","created_at");