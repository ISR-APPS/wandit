ALTER TYPE "public"."app_commit_source" ADD VALUE IF NOT EXISTS 'github';--> statement-breakpoint
CREATE TABLE "github_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"github_login" text,
	"github_user_id" bigint,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"oauth_state" text,
	"oauth_state_created_at" timestamp with time zone,
	"return_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_github_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"installation_id" bigint NOT NULL,
	"repo_id" bigint NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"github_user_id" bigint NOT NULL,
	"last_synced_sha" text,
	"remote_head_sha" text,
	"mirrored_sha" text,
	"last_error" text,
	"github_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_links" ADD CONSTRAINT "project_github_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_links" ADD CONSTRAINT "project_github_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_links" ADD CONSTRAINT "project_github_links_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_connections_userId_uq" ON "github_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_connections_oauthState_idx" ON "github_connections" USING btree ("oauth_state");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_links_projectId_uq" ON "project_github_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_github_links_repoId_idx" ON "project_github_links" USING btree ("repo_id");