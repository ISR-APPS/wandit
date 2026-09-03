CREATE INDEX "billing_invoice_applications_paidAt_idx" ON "billing_invoice_applications" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "subscriptions_createdAt_idx" ON "subscriptions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "connector_generation_attempts_createdAt_idx" ON "connector_generation_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_createdAt_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_createdAt_idx" ON "credit_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "image_generation_attempts_createdAt_idx" ON "image_generation_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_scrape_attempts_createdAt_idx" ON "lead_scrape_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "marketing_assets_createdAt_idx" ON "marketing_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_generation_attempts_createdAt_idx" ON "media_generation_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_generation_attempts_completedAt_idx" ON "page_generation_attempts" USING btree ("completed_at");