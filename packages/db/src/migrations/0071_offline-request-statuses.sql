ALTER TYPE "public"."manual_subscription_request_status" ADD VALUE 'no_answer' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."manual_subscription_request_status" ADD VALUE 'call_back' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."manual_subscription_request_status" ADD VALUE 'wrong_number' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."manual_subscription_request_status" ADD VALUE 'awaiting_payment' BEFORE 'approved';--> statement-breakpoint
DROP INDEX "manual_subscription_requests_userId_open_uq";--> statement-breakpoint
DROP INDEX "manual_subscription_requests_orgId_open_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "manual_subscription_requests_userId_open_uq" ON "manual_subscription_requests" USING btree ("user_id") WHERE "manual_subscription_requests"."status" NOT IN ('approved', 'rejected', 'canceled') AND "manual_subscription_requests"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_subscription_requests_orgId_open_uq" ON "manual_subscription_requests" USING btree ("organization_id") WHERE "manual_subscription_requests"."status" NOT IN ('approved', 'rejected', 'canceled') AND "manual_subscription_requests"."organization_id" IS NOT NULL;