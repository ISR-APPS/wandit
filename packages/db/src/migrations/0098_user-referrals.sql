CREATE TABLE "user_referral_codes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"friend_credits" integer NOT NULL,
	"activation_credits" integer NOT NULL,
	"paid_credits" integer NOT NULL,
	"friend_granted_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"activation_granted_at" timestamp with time zone,
	"first_paid_at" timestamp with time zone,
	"paid_granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_referrals_friend_credits_nonnegative_ck" CHECK ("user_referrals"."friend_credits" >= 0),
	CONSTRAINT "user_referrals_activation_credits_nonnegative_ck" CHECK ("user_referrals"."activation_credits" >= 0),
	CONSTRAINT "user_referrals_paid_credits_nonnegative_ck" CHECK ("user_referrals"."paid_credits" >= 0),
	CONSTRAINT "user_referrals_not_self_ck" CHECK ("user_referrals"."referrer_user_id" <> "user_referrals"."referred_user_id")
);
--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "user_referrals_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "user_referral_friend_credits" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "user_referral_activation_credits" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "user_referral_paid_credits" integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_referral_codes" ADD CONSTRAINT "user_referral_codes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_referral_codes_code_uq" ON "user_referral_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_referrals_referredUserId_uq" ON "user_referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "user_referrals_referrerUserId_createdAt_idx" ON "user_referrals" USING btree ("referrer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_referrals_activationCandidates_idx" ON "user_referrals" USING btree ("created_at","id") WHERE "user_referrals"."activated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_user_referral_friend_credits_range_ck" CHECK ("product_settings"."user_referral_friend_credits" > 0 AND "product_settings"."user_referral_friend_credits" <= 1000000);--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_user_referral_activation_credits_range_ck" CHECK ("product_settings"."user_referral_activation_credits" > 0 AND "product_settings"."user_referral_activation_credits" <= 1000000);--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_user_referral_paid_credits_range_ck" CHECK ("product_settings"."user_referral_paid_credits" > 0 AND "product_settings"."user_referral_paid_credits" <= 1000000);