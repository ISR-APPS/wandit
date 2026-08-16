CREATE TABLE "story_link_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_link_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"utm_source" text NOT NULL,
	"utm_medium" text NOT NULL,
	"utm_campaign" text NOT NULL,
	"utm_content" text,
	"destination_path" text DEFAULT '/' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_scrape_attempts" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "story_link_clicks" ADD CONSTRAINT "story_link_clicks_story_link_id_story_links_id_fk" FOREIGN KEY ("story_link_id") REFERENCES "public"."story_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_link_clicks_storyLinkId_createdAt_idx" ON "story_link_clicks" USING btree ("story_link_id","created_at");--> statement-breakpoint
CREATE INDEX "story_link_clicks_createdAt_idx" ON "story_link_clicks" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_links_slug_uq" ON "story_links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "page_generation_attempts_pageKind_idx" ON "page_generation_attempts" USING btree (("spec" ->> 'pageKind'));