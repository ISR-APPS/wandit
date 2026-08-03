CREATE TYPE "public"."affiliate_attribution_source" AS ENUM('signup_cookie', 'signup_body', 'manual');--> statement-breakpoint
CREATE TYPE "public"."affiliate_attribution_status" AS ENUM('active', 'voided');--> statement-breakpoint
CREATE TYPE "public"."affiliate_commission_entry_type" AS ENUM('earning', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."affiliate_commission_status" AS ENUM('pending', 'approved', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."affiliate_invoice_candidate_status" AS ENUM('pending_attribution', 'processed', 'ineligible');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_method" AS ENUM('manual', 'paypal', 'wise');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('draft', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."affiliate_program_kind" AS ENUM('percentage_recurring', 'fixed_one_time');--> statement-breakpoint
CREATE TYPE "public"."affiliate_program_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."beta_access_action" AS ENUM('granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."billing_change_intent_status" AS ENUM('open', 'processing', 'consumed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."billing_checkout_attempt_status" AS ENUM('created', 'session_attached', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."billing_checkout_purpose" AS ENUM('subscription', 'topup');--> statement-breakpoint
CREATE TYPE "public"."signup_grant_outbox_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."subscription_refill_slot_status" AS ENUM('pending', 'granted', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_operation" AS ENUM('chat', 'page_build', 'image', 'video', 'marketing', 'connector', 'lead_scrape', 'transcription', 'topup_adjust');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status" AS ENUM('reserved', 'settled', 'reconciled', 'refunded', 'reconcile_failed');--> statement-breakpoint
ALTER TYPE "public"."credit_bucket" ADD VALUE 'promo' BEFORE 'topup';--> statement-breakpoint
CREATE TABLE "affiliate_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"link_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_kind" "affiliate_program_kind" NOT NULL,
	"commission_rate_bps" integer,
	"fixed_amount_cents" integer,
	"fixed_currency" text,
	"commission_duration_months" integer,
	"clicked_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	"source" "affiliate_attribution_source" NOT NULL,
	"status" "affiliate_attribution_status" DEFAULT 'active' NOT NULL,
	"fraud_flags" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_attributions_commission_rate_bps_ck" CHECK ("affiliate_attributions"."commission_rate_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "affiliate_attributions_fixed_amount_cents_ck" CHECK ("affiliate_attributions"."fixed_amount_cents" > 0),
	CONSTRAINT "affiliate_attributions_percentage_terms_ck" CHECK ("affiliate_attributions"."program_kind" <> 'percentage_recurring' OR "affiliate_attributions"."commission_rate_bps" IS NOT NULL),
	CONSTRAINT "affiliate_attributions_fixed_terms_ck" CHECK ("affiliate_attributions"."program_kind" <> 'fixed_one_time' OR "affiliate_attributions"."fixed_amount_cents" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"landing_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribution_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"entry_type" "affiliate_commission_entry_type" NOT NULL,
	"original_commission_id" uuid,
	"stripe_invoice_id" text NOT NULL,
	"stripe_refund_id" text,
	"stripe_dispute_id" text,
	"stripe_charge_id" text NOT NULL,
	"currency" text NOT NULL,
	"base_amount_cents" integer NOT NULL,
	"rate_bps" integer,
	"amount_cents" integer NOT NULL,
	"status" "affiliate_commission_status" DEFAULT 'pending' NOT NULL,
	"hold_until" timestamp with time zone NOT NULL,
	"payout_id" uuid,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_commissions_rate_bps_ck" CHECK ("affiliate_commissions"."rate_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "affiliate_commissions_base_amount_cents_ck" CHECK ("affiliate_commissions"."base_amount_cents" >= 0),
	CONSTRAINT "affiliate_commissions_earning_amount_cents_ck" CHECK ("affiliate_commissions"."entry_type" = 'adjustment' OR "affiliate_commissions"."amount_cents" > 0),
	CONSTRAINT "affiliate_commissions_adjustment_original_ck" CHECK ("affiliate_commissions"."entry_type" <> 'adjustment' OR "affiliate_commissions"."original_commission_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "affiliate_invoice_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"user_id" text NOT NULL,
	"billing_reason" text NOT NULL,
	"base_amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"status" "affiliate_invoice_candidate_status" DEFAULT 'pending_attribution' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_invoice_candidates_base_amount_cents_ck" CHECK ("affiliate_invoice_candidates"."base_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"landing_path" text NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"method" "affiliate_payout_method" NOT NULL,
	"external_ref" text,
	"request_id" uuid NOT NULL,
	"status" "affiliate_payout_status" DEFAULT 'draft' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_payouts_total_cents_ck" CHECK ("affiliate_payouts"."total_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "affiliate_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "affiliate_program_kind" NOT NULL,
	"commission_rate_bps" integer,
	"fixed_amount_cents" integer,
	"fixed_currency" text,
	"commission_duration_months" integer,
	"hold_days" integer DEFAULT 30 NOT NULL,
	"cookie_window_days" integer DEFAULT 60 NOT NULL,
	"status" "affiliate_program_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_programs_commission_rate_bps_ck" CHECK ("affiliate_programs"."commission_rate_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "affiliate_programs_fixed_amount_cents_ck" CHECK ("affiliate_programs"."fixed_amount_cents" > 0),
	CONSTRAINT "affiliate_programs_percentage_terms_ck" CHECK ("affiliate_programs"."kind" <> 'percentage_recurring' OR "affiliate_programs"."commission_rate_bps" IS NOT NULL),
	CONSTRAINT "affiliate_programs_fixed_terms_ck" CHECK ("affiliate_programs"."kind" <> 'fixed_one_time' OR "affiliate_programs"."fixed_amount_cents" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"channel" text,
	"country" text,
	"payout_method" "affiliate_payout_method" DEFAULT 'manual' NOT NULL,
	"payout_details" jsonb,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" "beta_access_action" NOT NULL,
	"actor_user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_change_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"current_price_lookup_key" text NOT NULL,
	"target_price_lookup_key" text NOT NULL,
	"proration_date" timestamp with time zone NOT NULL,
	"preview_total_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "billing_change_intent_status" DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"provider_attempted_at" timestamp with time zone,
	"provider_outcome" text,
	"provider_hosted_invoice_url" text,
	"provider_pending_expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_checkout_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "billing_checkout_purpose" NOT NULL,
	"price_lookup_key" text,
	"pack_id" text,
	"provider_session_id" text,
	"status" "billing_checkout_attempt_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_applications" (
	"stripe_invoice_id" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_reason" text NOT NULL,
	"old_price_lookup_key" text,
	"new_price_lookup_key" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"credits_delta" integer NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"early_access_required" boolean DEFAULT true NOT NULL,
	"signup_grant_enabled" boolean DEFAULT false NOT NULL,
	"signup_grant_credits" integer DEFAULT 20 NOT NULL,
	"paid_subscriptions_enabled" boolean DEFAULT false NOT NULL,
	"topups_enabled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_settings_singleton_id_ck" CHECK ("product_settings"."id" = 1),
	CONSTRAINT "product_settings_signup_grant_credits_positive_ck" CHECK ("product_settings"."signup_grant_credits" > 0)
);
--> statement-breakpoint
CREATE TABLE "signup_grant_outbox" (
	"user_id" text PRIMARY KEY NOT NULL,
	"credits" integer NOT NULL,
	"settings_version" integer NOT NULL,
	"status" "signup_grant_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "signup_grant_outbox_credits_positive_ck" CHECK ("signup_grant_outbox"."credits" > 0),
	CONSTRAINT "signup_grant_outbox_attempts_nonnegative_ck" CHECK ("signup_grant_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscription_refill_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_ordinal" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"credits" integer NOT NULL,
	"funding_invoice_id" text NOT NULL,
	"funding_charge_id" text,
	"funding_payment_intent_id" text,
	"status" "subscription_refill_slot_status" DEFAULT 'pending' NOT NULL,
	"granted_at" timestamp with time zone,
	CONSTRAINT "subscription_refill_slots_period_ordinal_ck" CHECK ("subscription_refill_slots"."period_ordinal" BETWEEN 2 AND 12),
	CONSTRAINT "subscription_refill_slots_credits_positive_ck" CHECK ("subscription_refill_slots"."credits" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"operation" "ai_usage_operation" NOT NULL,
	"parent_event_id" uuid,
	"status" "ai_usage_status" DEFAULT 'reserved' NOT NULL,
	"model" text,
	"provider" text,
	"reserved_credits" integer NOT NULL,
	"final_credits" integer,
	"estimated_cost_usd_micros" integer,
	"reconciled_cost_usd_micros" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"raw_usage" jsonb,
	"pricing_snapshot" jsonb,
	"chat_id" uuid,
	"message_id" text,
	"attempt_ref" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"reconciled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_usage_generation_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_event_id" uuid NOT NULL,
	"gateway_generation_id" text NOT NULL,
	"step_usage" jsonb,
	"reconciled_cost_usd_micros" integer,
	"reconciled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_plan_hold_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"boundary_idempotency_key" text NOT NULL,
	"remaining_credits" integer NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_plan_hold_pools_remaining_nonnegative_ck" CHECK ("credit_plan_hold_pools"."remaining_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_plan_holds" (
	"consume_idempotency_key" text PRIMARY KEY NOT NULL,
	"consume_ledger_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"pool_id" uuid,
	"original_credits" integer NOT NULL,
	"refundable_credits" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_plan_holds_original_positive_ck" CHECK ("credit_plan_holds"."original_credits" > 0),
	CONSTRAINT "credit_plan_holds_refundable_range_ck" CHECK ("credit_plan_holds"."refundable_credits" >= 0 AND "credit_plan_holds"."refundable_credits" <= "credit_plan_holds"."original_credits")
);
--> statement-breakpoint
CREATE TABLE "model_prices" (
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"model_type" text NOT NULL,
	"input_usd_micros_per_mtok" integer,
	"output_usd_micros_per_mtok" integer,
	"cache_read_usd_micros_per_mtok" integer,
	"cache_write_usd_micros_per_mtok" integer,
	"image_usd_micros" integer,
	"raw" jsonb NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_tier_credits" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_applied_by" text;--> statement-breakpoint
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_attribution_id_affiliate_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."affiliate_attributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_original_commission_id_affiliate_commissions_id_fk" FOREIGN KEY ("original_commission_id") REFERENCES "public"."affiliate_commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payout_id_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_invoice_candidates" ADD CONSTRAINT "affiliate_invoice_candidates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access_events" ADD CONSTRAINT "beta_access_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access_events" ADD CONSTRAINT "beta_access_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_change_intents" ADD CONSTRAINT "billing_change_intents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_change_intents" ADD CONSTRAINT "billing_change_intents_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD CONSTRAINT "billing_checkout_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_applications" ADD CONSTRAINT "billing_invoice_applications_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_grant_outbox" ADD CONSTRAINT "signup_grant_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_refill_slots" ADD CONSTRAINT "subscription_refill_slots_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_parent_event_id_ai_usage_events_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."ai_usage_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_generation_refs" ADD CONSTRAINT "ai_usage_generation_refs_usage_event_id_ai_usage_events_id_fk" FOREIGN KEY ("usage_event_id") REFERENCES "public"."ai_usage_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_hold_pools" ADD CONSTRAINT "credit_plan_hold_pools_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD CONSTRAINT "credit_plan_holds_consume_ledger_id_credit_ledger_id_fk" FOREIGN KEY ("consume_ledger_id") REFERENCES "public"."credit_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD CONSTRAINT "credit_plan_holds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD CONSTRAINT "credit_plan_holds_pool_id_credit_plan_hold_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."credit_plan_hold_pools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_attributions_userId_uq" ON "affiliate_attributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "affiliate_attributions_linkId_idx" ON "affiliate_attributions" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "affiliate_attributions_affiliateId_idx" ON "affiliate_attributions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_attributions_programId_idx" ON "affiliate_attributions" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_linkId_createdAt_idx" ON "affiliate_clicks" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_earning_stripeInvoiceId_uq" ON "affiliate_commissions" USING btree ("stripe_invoice_id") WHERE "affiliate_commissions"."entry_type" = 'earning';--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_stripeRefundId_uq" ON "affiliate_commissions" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_stripeDisputeId_uq" ON "affiliate_commissions" USING btree ("stripe_dispute_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_affiliateId_status_idx" ON "affiliate_commissions" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_status_holdUntil_idx" ON "affiliate_commissions" USING btree ("status","hold_until");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_attributionId_idx" ON "affiliate_commissions" USING btree ("attribution_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_originalCommissionId_idx" ON "affiliate_commissions" USING btree ("original_commission_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_payoutId_idx" ON "affiliate_commissions" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_invoice_candidates_stripeInvoiceId_uq" ON "affiliate_invoice_candidates" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "affiliate_invoice_candidates_userId_idx" ON "affiliate_invoice_candidates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_links_code_uq" ON "affiliate_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliate_links_affiliateId_idx" ON "affiliate_links" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_links_programId_idx" ON "affiliate_links" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payouts_requestId_uq" ON "affiliate_payouts" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payouts_method_externalRef_uq" ON "affiliate_payouts" USING btree ("method","external_ref") WHERE "affiliate_payouts"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliateId_idx" ON "affiliate_payouts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_payouts_createdByUserId_idx" ON "affiliate_payouts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_userId_uq" ON "affiliates" USING btree ("user_id") WHERE "affiliates"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "beta_access_events_userId_createdAt_idx" ON "beta_access_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "beta_access_events_actorUserId_idx" ON "beta_access_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "billing_change_intents_userId_idx" ON "billing_change_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_change_intents_subscriptionId_idx" ON "billing_change_intents" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_change_intents_status_expiresAt_idx" ON "billing_change_intents" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_checkout_attempts_providerSessionId_uq" ON "billing_checkout_attempts" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "billing_checkout_attempts_userId_purpose_status_idx" ON "billing_checkout_attempts" USING btree ("user_id","purpose","status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_invoice_applications_stripeInvoiceId_uq" ON "billing_invoice_applications" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_applications_subscriptionId_idx" ON "billing_invoice_applications" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_applications_cycle_periodEnd_idx" ON "billing_invoice_applications" USING btree ("subscription_id","period_end") WHERE "billing_invoice_applications"."billing_reason" = 'subscription_cycle';--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_refill_slots_subscription_invoice_ordinal_uq" ON "subscription_refill_slots" USING btree ("subscription_id","funding_invoice_id","period_ordinal");--> statement-breakpoint
CREATE INDEX "subscription_refill_slots_status_dueAt_idx" ON "subscription_refill_slots" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_userId_createdAt_idx" ON "ai_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_reserved_status_idx" ON "ai_usage_events" USING btree ("status") WHERE "ai_usage_events"."status" = 'reserved';--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_events_idempotencyKey_uq" ON "ai_usage_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_usage_generation_refs_usageEventId_idx" ON "ai_usage_generation_refs" USING btree ("usage_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_generation_refs_gatewayGenerationId_uq" ON "ai_usage_generation_refs" USING btree ("gateway_generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_plan_hold_pools_boundary_key_uq" ON "credit_plan_hold_pools" USING btree ("boundary_idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_plan_hold_pools_userId_idx" ON "credit_plan_hold_pools" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_plan_holds_consumeLedgerId_uq" ON "credit_plan_holds" USING btree ("consume_ledger_id");--> statement-breakpoint
CREATE INDEX "credit_plan_holds_userId_active_idx" ON "credit_plan_holds" USING btree ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "model_prices_modelId_uq" ON "model_prices" USING btree ("model_id");