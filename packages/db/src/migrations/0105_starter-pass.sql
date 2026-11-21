CREATE TYPE "public"."starter_pass_source" AS ENUM('stripe', 'slickpay', 'offline', 'grandfathered', 'admin');--> statement-breakpoint
CREATE TABLE "starter_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organization_id" text,
	"source" "starter_pass_source" NOT NULL,
	"receipt_id" uuid,
	"granted_by_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"revoked_reason" text,
	CONSTRAINT "starter_passes_one_owner_ck" CHECK (num_nonnulls("starter_passes"."user_id", "starter_passes"."organization_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "product_settings" ALTER COLUMN "dzd_per_usd_rate" SET DEFAULT 25000;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "starter_pass_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "starter_passes" ADD CONSTRAINT "starter_passes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_passes" ADD CONSTRAINT "starter_passes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_passes" ADD CONSTRAINT "starter_passes_receipt_id_billing_topup_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."billing_topup_receipts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_passes" ADD CONSTRAINT "starter_passes_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_passes" ADD CONSTRAINT "starter_passes_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "starter_passes_live_user_uq" ON "starter_passes" USING btree ("user_id") WHERE "starter_passes"."organization_id" IS NULL AND "starter_passes"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "starter_passes_live_organization_uq" ON "starter_passes" USING btree ("organization_id") WHERE "starter_passes"."organization_id" IS NOT NULL AND "starter_passes"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "starter_passes_receiptId_idx" ON "starter_passes" USING btree ("receipt_id");--> statement-breakpoint
-- Hand-written: move the old default rate (270.00 DZD) to 250.00. A rate that an admin chose stays.
UPDATE "product_settings" SET "dzd_per_usd_rate" = 25000, "version" = "version" + 1, "updated_at" = now() WHERE "dzd_per_usd_rate" = 27000;
