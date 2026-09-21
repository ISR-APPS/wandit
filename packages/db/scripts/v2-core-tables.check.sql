-- Checks the constraints of migration 0072 (V2 core tables) on a scratch database.
-- Apply the migrations first with `pnpm -F @wandit/db db:migrate`, then run from
-- the repo root: psql "$DATABASE_URL" -f packages/db/scripts/v2-core-tables.check.sql

BEGIN;

-- Parent rows: one user and one project carry every new table.
INSERT INTO "user" ("id", "name", "email")
VALUES ('v2-check-user', 'V2 Check', 'v2-check@example.com');

INSERT INTO "projects" ("id", "user_id", "name")
VALUES ('00000000-0000-0000-0000-0000000000b1', 'v2-check-user', 'v2 check');

-- One active turn per project: the second `running` row must fail.
INSERT INTO "builder_turns"
	("user_id", "project_id", "request_key", "turn_number", "spec", "status")
VALUES
	('v2-check-user', '00000000-0000-0000-0000-0000000000b1', 'rk-1', 1, '{}', 'running');

DO $$
BEGIN
	INSERT INTO "builder_turns"
		("user_id", "project_id", "request_key", "turn_number", "spec", "status")
	VALUES
		('v2-check-user', '00000000-0000-0000-0000-0000000000b1', 'rk-2', 2, '{}', 'running');
	RAISE EXCEPTION 'check failed: a second running turn was accepted';
EXCEPTION WHEN unique_violation THEN
	IF SQLERRM LIKE '%builder_turns_active_project_uq%' THEN
		RAISE NOTICE 'ok: builder_turns_active_project_uq blocked a second running turn';
	ELSE
		RAISE;
	END IF;
END $$;

-- A terminal status does not count as active, so this row passes.
INSERT INTO "builder_turns"
	("user_id", "project_id", "request_key", "turn_number", "spec", "status")
VALUES
	('v2-check-user', '00000000-0000-0000-0000-0000000000b1', 'rk-3', 3, '{}', 'succeeded');

-- An existing project reads the V1 defaults.
DO $$
DECLARE
	v_engine text;
	v_languages text[];
BEGIN
	SELECT "engine"::text, "languages" INTO v_engine, v_languages
	FROM "projects"
	WHERE "id" = '00000000-0000-0000-0000-0000000000b1';
	IF v_engine <> 'v1_page' THEN
		RAISE EXCEPTION 'check failed: projects.engine default is %', v_engine;
	END IF;
	IF v_languages <> '{}'::text[] THEN
		RAISE EXCEPTION 'check failed: projects.languages default is %', v_languages;
	END IF;
	RAISE NOTICE 'ok: project reads engine=v1_page and languages={}';
END $$;

-- The allowed set passes; an unknown language fails the check.
UPDATE "projects" SET "languages" = '{ar,fr,en}'
WHERE "id" = '00000000-0000-0000-0000-0000000000b1';

DO $$
BEGIN
	UPDATE "projects" SET "languages" = '{es}'
	WHERE "id" = '00000000-0000-0000-0000-0000000000b1';
	RAISE EXCEPTION 'check failed: projects.languages accepted es';
EXCEPTION WHEN check_violation THEN
	IF SQLERRM LIKE '%projects_languages_allowed_ck%' THEN
		RAISE NOTICE 'ok: projects_languages_allowed_ck rejected es';
	ELSE
		RAISE;
	END IF;
END $$;

-- One project has at most one backend.
INSERT INTO "app_backends" ("user_id", "project_id", "region", "request_key")
VALUES ('v2-check-user', '00000000-0000-0000-0000-0000000000b1', 'eu-west', 'ab-1');

DO $$
BEGIN
	INSERT INTO "app_backends" ("user_id", "project_id", "region", "request_key")
	VALUES ('v2-check-user', '00000000-0000-0000-0000-0000000000b1', 'eu-west', 'ab-2');
	RAISE EXCEPTION 'check failed: a second backend was accepted for one project';
EXCEPTION WHEN unique_violation THEN
	IF SQLERRM LIKE '%app_backends_projectId_uq%' THEN
		RAISE NOTICE 'ok: app_backends_projectId_uq blocked a second backend';
	ELSE
		RAISE;
	END IF;
END $$;

-- The harness enum defaults to claude_code and accepts opencode only.
INSERT INTO "chats" ("id", "project_id")
VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');

INSERT INTO "builder_sessions" ("user_id", "project_id", "chat_id")
VALUES
	('v2-check-user', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

DO $$
DECLARE
	v_harness text;
BEGIN
	SELECT "harness"::text INTO v_harness
	FROM "builder_sessions"
	WHERE "chat_id" = '00000000-0000-0000-0000-0000000000c1';
	IF v_harness <> 'claude_code' THEN
		RAISE EXCEPTION 'check failed: builder_sessions.harness default is %', v_harness;
	END IF;
	RAISE NOTICE 'ok: builder_sessions.harness defaults to claude_code';
END $$;

UPDATE "builder_sessions" SET "harness" = 'opencode'
WHERE "chat_id" = '00000000-0000-0000-0000-0000000000c1';

DO $$
BEGIN
	UPDATE "builder_sessions" SET "harness" = 'other_agent'
	WHERE "chat_id" = '00000000-0000-0000-0000-0000000000c1';
	RAISE EXCEPTION 'check failed: builder_harness accepted an unknown value';
EXCEPTION WHEN invalid_text_representation THEN
	RAISE NOTICE 'ok: builder_harness rejected an unknown value';
END $$;

-- A project delete removes its backend row.
DELETE FROM "projects" WHERE "id" = '00000000-0000-0000-0000-0000000000b1';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "app_backends"
		WHERE "project_id" = '00000000-0000-0000-0000-0000000000b1'
	) THEN
		RAISE EXCEPTION 'check failed: app_backends row survived the project delete';
	END IF;
	RAISE NOTICE 'ok: project delete removed the app_backends row';
END $$;

ROLLBACK;
