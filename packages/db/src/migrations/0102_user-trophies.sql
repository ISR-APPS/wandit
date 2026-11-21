CREATE TABLE "user_trophies" (
	"user_id" text NOT NULL,
	"trophy_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	CONSTRAINT "user_trophies_user_id_trophy_id_pk" PRIMARY KEY("user_id","trophy_id")
);
--> statement-breakpoint
ALTER TABLE "user_trophies" ADD CONSTRAINT "user_trophies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;