ALTER TABLE "llm_proxy_requests" ADD COLUMN "gateway_usd_micros" integer;--> statement-breakpoint
ALTER TABLE "llm_proxy_requests" ADD COLUMN "gateway_provider" text;