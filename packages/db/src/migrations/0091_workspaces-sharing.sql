CREATE TYPE "public"."project_invitation_status" AS ENUM('pending', 'accepted', 'declined', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."project_member_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."project_workspace_access" AS ENUM('can_edit', 'can_view', 'restricted');--> statement-breakpoint
CREATE TABLE "invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"organization_id" text,
	"project_id" uuid,
	"role" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_links_one_target_ck" CHECK (num_nonnulls("invite_links"."organization_id", "invite_links"."project_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "project_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "project_member_role" NOT NULL,
	"status" "project_invitation_status" DEFAULT 'pending' NOT NULL,
	"inviter_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "project_member_role" NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "payer_user_id" text;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "payer_user_id" text;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD COLUMN "payer_user_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "personal_owner_user_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_access" "project_workspace_access" DEFAULT 'can_edit' NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_links_token_uq" ON "invite_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_links_org_role_active_uq" ON "invite_links" USING btree ("organization_id","role") WHERE "invite_links"."revoked_at" IS NULL AND "invite_links"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_links_project_active_uq" ON "invite_links" USING btree ("project_id") WHERE "invite_links"."revoked_at" IS NULL AND "invite_links"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_invitations_projectId_email_pending_uq" ON "project_invitations" USING btree ("project_id","email") WHERE "project_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "project_invitations_email_status_idx" ON "project_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_projectId_userId_uq" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_userId_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD CONSTRAINT "connector_generation_attempts_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_personal_owner_user_id_user_id_fk" FOREIGN KEY ("personal_owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_events_payerUserId_userId_createdAt_idx" ON "ai_usage_events" USING btree ("payer_user_id","user_id","created_at") WHERE "ai_usage_events"."payer_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_personal_owner_user_id_unique" UNIQUE("personal_owner_user_id");--> statement-breakpoint
-- Backfill (workspaces-sharing.md 1): one personal workspace and one owner member row
-- for each user that has none. The API rule is ensurePersonalWorkspace in WorkspacesService.
-- Name: the first word of the user name (else the email local part), cut to 38 characters,
-- plus "'s workspace", so the name has 50 characters at most.
-- Slug: 'personal-' plus the first 16 hex characters of a v4 uuid. 15 of them are random,
-- because character 13 is always '4'. The Better Auth org hooks must refuse this prefix.
-- The conflict target is personal_owner_user_id only, so a rerun is a no-op.
WITH "new_personal_orgs" AS (
	INSERT INTO "organization" ("id", "name", "slug", "personal_owner_user_id")
	SELECT
		gen_random_uuid()::text,
		left(
			coalesce(substring(u."name" from '\S+'), split_part(u."email", '@', 1)),
			38
		) || '''s workspace',
		'personal-' || left(replace(gen_random_uuid()::text, '-', ''), 16),
		u."id"
	FROM "user" u
	WHERE NOT EXISTS (
		SELECT 1 FROM "organization" o WHERE o."personal_owner_user_id" = u."id"
	)
	ON CONFLICT ("personal_owner_user_id") DO NOTHING
	RETURNING "id", "personal_owner_user_id"
)
INSERT INTO "member" ("id", "organization_id", "user_id", "role")
SELECT gen_random_uuid()::text, n."id", n."personal_owner_user_id", 'owner'
FROM "new_personal_orgs" n;
