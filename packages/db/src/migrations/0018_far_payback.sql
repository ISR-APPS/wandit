CREATE TABLE "organization_billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"attribution_user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"open_checkout_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_billing_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"default_member_monthly_credit_limit" integer,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_billing_settings_default_limit_positive_ck" CHECK ("organization_billing_settings"."default_member_monthly_credit_limit" IS NULL OR "organization_billing_settings"."default_member_monthly_credit_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "organization_member_credit_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"monthly_credit_limit" integer NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_credit_limits_positive_ck" CHECK ("organization_member_credit_limits"."monthly_credit_limit" > 0)
);
--> statement-breakpoint
DROP INDEX "subscriptions_userId_nonTerminal_uq";--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_plan_hold_pools" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "billing_change_intents" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "organizations_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "credit_plan_hold_pools" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "organization_billing_customers" ADD CONSTRAINT "organization_billing_customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_customers" ADD CONSTRAINT "organization_billing_customers_attribution_user_id_user_id_fk" FOREIGN KEY ("attribution_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_customers" ADD CONSTRAINT "organization_billing_customers_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_settings" ADD CONSTRAINT "organization_billing_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_settings" ADD CONSTRAINT "organization_billing_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_credit_limits" ADD CONSTRAINT "organization_member_credit_limits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_credit_limits" ADD CONSTRAINT "organization_member_credit_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_credit_limits" ADD CONSTRAINT "organization_member_credit_limits_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_billing_customers_orgId_uq" ON "organization_billing_customers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_billing_customers_provider_customerId_uq" ON "organization_billing_customers" USING btree ("provider","provider_customer_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_status_idx" ON "invitation" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organizationId_userId_uq" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uq" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organization_createdAt_idx" ON "organization" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_credit_limits_org_user_uq" ON "organization_member_credit_limits" USING btree ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "billing_change_intents" ADD CONSTRAINT "billing_change_intents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD CONSTRAINT "billing_checkout_attempts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_hold_pools" ADD CONSTRAINT "credit_plan_hold_pools_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD CONSTRAINT "credit_plan_holds_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_orgId_nonTerminal_uq" ON "subscriptions" USING btree ("organization_id") WHERE "subscriptions"."status" NOT IN ('canceled', 'incomplete_expired') AND "subscriptions"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ai_usage_events_orgId_userId_createdAt_idx" ON "ai_usage_events" USING btree ("organization_id","user_id","created_at") WHERE "ai_usage_events"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_ledger_orgId_createdAt_idx" ON "credit_ledger" USING btree ("organization_id","created_at") WHERE "credit_ledger"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_ledger_orgId_bucket_idx" ON "credit_ledger" USING btree ("organization_id","bucket") WHERE "credit_ledger"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_plan_hold_pools_orgId_idx" ON "credit_plan_hold_pools" USING btree ("organization_id") WHERE "credit_plan_hold_pools"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_plan_holds_orgId_active_idx" ON "credit_plan_holds" USING btree ("organization_id","active") WHERE "credit_plan_holds"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_org_dashboard_idx" ON "projects" USING btree ("organization_id","updated_at") WHERE "projects"."deleted_at" IS NULL AND "projects"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_userId_nonTerminal_uq" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" NOT IN ('canceled', 'incomplete_expired') AND "subscriptions"."organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_owner_present_ck" CHECK ("credit_ledger"."user_id" IS NOT NULL OR "credit_ledger"."organization_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "credit_plan_hold_pools" ADD CONSTRAINT "credit_plan_hold_pools_owner_present_ck" CHECK ("credit_plan_hold_pools"."user_id" IS NOT NULL OR "credit_plan_hold_pools"."organization_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "credit_plan_holds" ADD CONSTRAINT "credit_plan_holds_owner_present_ck" CHECK ("credit_plan_holds"."user_id" IS NOT NULL OR "credit_plan_holds"."organization_id" IS NOT NULL);