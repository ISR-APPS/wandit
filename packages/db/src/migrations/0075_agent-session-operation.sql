ALTER TYPE "public"."ai_usage_operation" ADD VALUE 'agent_session' BEFORE 'topup_adjust';--> statement-breakpoint
ALTER TYPE "public"."ai_usage_operation" ADD VALUE 'sandbox' BEFORE 'topup_adjust';