ALTER TABLE "billing_invoice_applications" ADD COLUMN "amount_paid_minor" integer;--> statement-breakpoint
ALTER TABLE "billing_invoice_applications" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "billing_invoice_applications" ADD COLUMN "paid_at" timestamp with time zone;