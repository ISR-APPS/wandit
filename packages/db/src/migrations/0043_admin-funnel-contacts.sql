CREATE TABLE "admin_funnel_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"contacted_by_user_id" text NOT NULL,
	"contacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_funnel_contacts" ADD CONSTRAINT "admin_funnel_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_funnel_contacts" ADD CONSTRAINT "admin_funnel_contacts_contacted_by_user_id_user_id_fk" FOREIGN KEY ("contacted_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_funnel_contacts_userId_uq" ON "admin_funnel_contacts" USING btree ("user_id");