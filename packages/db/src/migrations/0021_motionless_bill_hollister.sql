ALTER TABLE "auth_email_sends" ADD COLUMN "actor_id" text;--> statement-breakpoint
CREATE INDEX "auth_email_sends_actorId_createdAt_idx" ON "auth_email_sends" USING btree ("actor_id","created_at");