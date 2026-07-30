CREATE TYPE "public"."mcp_connector_auth_kind" AS ENUM('mcp_dcr', 'oauth_prereg');--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connector_id" uuid NOT NULL,
	"oauth_state" text,
	"code_verifier" text,
	"return_url" text,
	"client_info" jsonb,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text,
	"auth_kind" "mcp_connector_auth_kind" NOT NULL,
	"mcp_server_url" text,
	"authorization_url" text,
	"token_url" text,
	"scopes" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_connector_id_mcp_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."mcp_connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_userId_connectorId_uq" ON "mcp_connections" USING btree ("user_id","connector_id");--> statement-breakpoint
CREATE INDEX "mcp_connections_oauthState_idx" ON "mcp_connections" USING btree ("oauth_state");--> statement-breakpoint
CREATE INDEX "mcp_connections_userId_idx" ON "mcp_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connectors_slug_uq" ON "mcp_connectors" USING btree ("slug");