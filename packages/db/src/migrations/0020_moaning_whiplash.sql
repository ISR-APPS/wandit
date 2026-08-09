CREATE TABLE "auth_email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_canonical" text NOT NULL,
	"ip_hash" text,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "email_auth_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_email_sends_email_createdAt_idx" ON "auth_email_sends" USING btree ("email_canonical","created_at");--> statement-breakpoint
CREATE INDEX "auth_email_sends_ipHash_createdAt_idx" ON "auth_email_sends" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_key_uq" ON "rate_limit" USING btree ("key");--> statement-breakpoint
-- One-time backfill: canonicalize existing user emails so exact-match lookups
-- unify Google-first and email-first sign-ins (docs/features: email auth).
-- Rule mirrors packages/auth canonicalizeEmail(): lowercase + trim; strip one
-- +suffix from the local part (all domains); gmail/googlemail additionally
-- drop dots and normalize the domain to gmail.com. Rows whose canonical form
-- collides with another user are SKIPPED (two colliding rows = one human's
-- gmail dot-variants already registered twice; Google sign-in matches by
-- provider account id, so leaving them untouched is safe).
WITH canon AS (
	SELECT id, email,
		CASE
			WHEN split_part(lower(trim(email)), '@', 2) IN ('gmail.com', 'googlemail.com')
			THEN replace(split_part(split_part(lower(trim(email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
			ELSE split_part(split_part(lower(trim(email)), '@', 1), '+', 1) || '@' || split_part(lower(trim(email)), '@', 2)
		END AS canonical
	FROM "user"
),
-- Canonical forms claimed by more than one row, aggregated ONCE. A
-- correlated count per row would be O(n^2) and hold the deploy transaction
-- open across the whole user table.
collisions AS (
	SELECT canonical FROM canon GROUP BY canonical HAVING count(*) > 1
)
UPDATE "user" u
SET email = c.canonical
FROM canon c
WHERE u.id = c.id
	AND u.email <> c.canonical
	AND NOT EXISTS (
		SELECT 1 FROM "user" x WHERE x.email = c.canonical AND x.id <> u.id
	)
	AND NOT EXISTS (
		SELECT 1 FROM collisions d WHERE d.canonical = c.canonical
	);
