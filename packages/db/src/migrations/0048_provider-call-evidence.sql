-- Provider-call evidence: a durable receipt per non-gateway provider call
-- (Serper search pages, Higgsfield/MCP job submits). Reconciliation sums
-- these rows next to the gateway total; a refunded event may still carry
-- evidence (a failed lead scrape paid Serper). Purely additive, no backfill.
CREATE TYPE "public"."ai_cost_status" AS ENUM('measured', 'contract_rate', 'estimated', 'pending');--> statement-breakpoint
CREATE TYPE "public"."ai_cost_transport" AS ENUM('vercel', 'openrouter', 'serper', 'higgsfield', 'mcp');--> statement-breakpoint
CREATE TABLE "ai_provider_call_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_event_id" uuid NOT NULL,
	"transport" "ai_cost_transport" NOT NULL,
	"provider_request_id" text,
	"unit_kind" text NOT NULL,
	"units" integer NOT NULL,
	"charged_usd_micros" integer,
	"rate_usd_micros_per_unit" integer,
	"cost_status" "ai_cost_status" NOT NULL,
	"cost_source" text,
	"customer_billable" boolean DEFAULT true NOT NULL,
	"raw_receipt" jsonb,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_call_evidence_units_positive_ck" CHECK ("ai_provider_call_evidence"."units" > 0),
	CONSTRAINT "ai_provider_call_evidence_cost_present_ck" CHECK ("ai_provider_call_evidence"."cost_status" = 'pending' OR "ai_provider_call_evidence"."charged_usd_micros" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "ai_provider_call_evidence" ADD CONSTRAINT "ai_provider_call_evidence_usage_event_id_ai_usage_events_id_fk" FOREIGN KEY ("usage_event_id") REFERENCES "public"."ai_usage_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_call_evidence_usageEventId_idx" ON "ai_provider_call_evidence" USING btree ("usage_event_id");--> statement-breakpoint
CREATE INDEX "ai_provider_call_evidence_transport_createdAt_idx" ON "ai_provider_call_evidence" USING btree ("transport","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_call_evidence_idempotencyKey_uq" ON "ai_provider_call_evidence" USING btree ("idempotency_key");
