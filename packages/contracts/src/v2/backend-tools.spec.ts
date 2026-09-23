import { describe, expect, it } from "vitest";

import {
	applyMigrationToolInputSchema,
	applyMigrationToolOutputSchema,
	backendToolFailureSchema,
	deployFunctionToolInputSchema,
	deployFunctionToolOutputSchema,
	gateFindingSchema,
	getAdvisorsToolInputSchema,
	getAdvisorsToolOutputSchema,
	isDestructiveMigration,
	runSqlToolInputSchema,
	runSqlToolOutputSchema,
	setSecretToolInputSchema,
	setSecretToolOutputSchema,
} from "./backend-tools";
import { stripSqlNoise } from "./cloud";

const FINDING = {
	detail: "public.notes has RLS off.",
	level: "error",
	lintId: "wandit_rls_missing",
	remediationUrl:
		"https://supabase.com/docs/guides/database/postgres/row-level-security",
	table: "public.notes",
	title: "Table without row level security",
};

describe("backend tool inputs", () => {
	it("parses one valid input per tool", () => {
		expect(
			applyMigrationToolInputSchema.parse({
				name: "create_notes",
				sql: "  create table notes (id uuid primary key);  ",
			}),
		).toEqual({
			name: "create_notes",
			sql: "create table notes (id uuid primary key);",
		});
		expect(runSqlToolInputSchema.parse({ query: "select 1" })).toEqual({
			query: "select 1",
		});
		expect(
			deployFunctionToolInputSchema.parse({ slug: "hello-world" }),
		).toEqual({ slug: "hello-world" });
		expect(
			setSecretToolInputSchema.parse({
				name: "STRIPE_SECRET_KEY",
				source: "project_secret",
			}),
		).toEqual({ name: "STRIPE_SECRET_KEY", source: "project_secret" });
		expect(getAdvisorsToolInputSchema.parse({})).toEqual({});
	});

	it("rejects a migration name with a quote, a capital, or a dash", () => {
		for (const name of [
			"notes'; drop",
			"Create_notes",
			"create-notes",
			"1st",
		]) {
			expect(
				applyMigrationToolInputSchema.safeParse({ name, sql: "select 1" })
					.success,
			).toBe(false);
		}
	});

	it("rejects a migration above 100 000 characters", () => {
		expect(
			applyMigrationToolInputSchema.safeParse({
				name: "big",
				sql: "x".repeat(100_001),
			}).success,
		).toBe(false);
	});

	it("rejects a query above 20 000 characters", () => {
		expect(
			runSqlToolInputSchema.safeParse({ query: "x".repeat(20_001) }).success,
		).toBe(false);
	});

	it("rejects a slug with a slash, a dot, or a capital", () => {
		for (const slug of ["../etc", "hello.world", "Hello", "-hello"]) {
			expect(deployFunctionToolInputSchema.safeParse({ slug }).success).toBe(
				false,
			);
		}
	});

	it("rejects a secret name outside the project_secrets pattern", () => {
		expect(
			setSecretToolInputSchema.safeParse({
				name: "stripe_key",
				source: "generate",
			}).success,
		).toBe(false);
	});

	it("rejects the reserved SUPABASE_ prefix", () => {
		expect(
			setSecretToolInputSchema.safeParse({
				name: "SUPABASE_SERVICE_ROLE_KEY",
				source: "project_secret",
			}).success,
		).toBe(false);
	});

	it("rejects an unknown secret source", () => {
		expect(
			setSecretToolInputSchema.safeParse({ name: "API_KEY", source: "chat" })
				.success,
		).toBe(false);
	});
});

describe("backend tool outputs", () => {
	it("parses each success branch", () => {
		expect(
			applyMigrationToolOutputSchema.parse({
				file: "supabase/migrations/20260923101500_create_notes.sql",
				status: "applied",
			}).status,
		).toBe("applied");
		expect(
			applyMigrationToolOutputSchema.parse({
				status: "needs_approval",
				tool: "apply_destructive_migration",
			}).status,
		).toBe("needs_approval");
		expect(
			runSqlToolOutputSchema.parse({
				kind: "read",
				rowCount: 1,
				rows: [{ id: 1, title: "first" }],
				status: "ok",
				truncated: false,
			}).status,
		).toBe("ok");
		expect(
			deployFunctionToolOutputSchema.parse({
				status: "deployed",
				url: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/hello-world",
			}).status,
		).toBe("deployed");
		expect(
			setSecretToolOutputSchema.parse({ name: "API_KEY", status: "missing" })
				.status,
		).toBe("missing");
		expect(
			getAdvisorsToolOutputSchema.parse({ findings: [FINDING], status: "ok" })
				.status,
		).toBe("ok");
	});

	it("parses the four shared failures in every output", () => {
		const failures = [
			{ status: "backend_not_ready" },
			{ status: "backend_paused" },
			{ retryAfterSeconds: 3, status: "rate_limited" },
			{ reason: "Supabase did not answer", status: "failed" },
		];
		for (const failure of failures) {
			expect(backendToolFailureSchema.safeParse(failure).success).toBe(true);
			expect(setSecretToolOutputSchema.safeParse(failure).success).toBe(true);
		}
	});

	it("rejects a needs_approval branch that names the wrong tool", () => {
		expect(
			runSqlToolOutputSchema.safeParse({
				status: "needs_approval",
				tool: "apply_destructive_migration",
			}).success,
		).toBe(false);
	});
});

describe("gateFindingSchema", () => {
	it("parses a finding", () => {
		expect(gateFindingSchema.parse(FINDING)).toEqual(FINDING);
	});

	it("rejects the info level", () => {
		expect(
			gateFindingSchema.safeParse({ ...FINDING, level: "info" }).success,
		).toBe(false);
	});
});

describe("isDestructiveMigration", () => {
	it("answers false for an additive migration", () => {
		const sql = `
create table public.notes (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references auth.users (id) on delete cascade,
	type text not null
);
alter table public.notes enable row level security;
drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes for select using (auth.uid() = owner_id);
create index notes_owner_idx on public.notes (owner_id);
alter table public.notes alter column title drop default;
alter table public.notes drop constraint notes_owner_id_fkey, add constraint notes_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;
create trigger notes_touch before update on public.notes for each row execute function set_updated_at();
create policy "notes_update_own" on public.notes for update using (auth.uid() = owner_id);
alter table public.notes add constraint notes_owner_fk foreign key (owner_id) references auth.users (id) on update set null;
`;
		expect(isDestructiveMigration(sql)).toBe(false);
	});

	it("answers true for drop table, drop column, and a bare alter drop", () => {
		expect(isDestructiveMigration("drop table public.notes;")).toBe(true);
		expect(isDestructiveMigration("alter table notes drop column title;")).toBe(
			true,
		);
		expect(isDestructiveMigration("alter table notes drop title;")).toBe(true);
		expect(isDestructiveMigration("drop schema app;")).toBe(true);
	});

	it("answers true for truncate and delete from", () => {
		expect(isDestructiveMigration("truncate notes;")).toBe(true);
		expect(isDestructiveMigration("delete from notes where true;")).toBe(true);
	});

	it("answers true for update ... set, an upsert, and merge into", () => {
		expect(isDestructiveMigration("update public.notes set body = null;")).toBe(
			true,
		);
		expect(
			isDestructiveMigration(
				"insert into notes (id, body) values (1, 'x') on conflict (id) do update set body = excluded.body;",
			),
		).toBe(true);
		expect(
			isDestructiveMigration(
				"merge into notes n using old o on n.id = o.id when matched then delete;",
			),
		).toBe(true);
		expect(
			isDestructiveMigration(
				"update public.profiles as p set display_name = u.email from auth.users as u where u.id = p.id;",
			),
		).toBe(true);
	});

	it("answers true for a select that runs a function", () => {
		expect(isDestructiveMigration("select purge_notes();")).toBe(true);
		expect(
			isDestructiveMigration(
				"select cron.schedule('purge', '0 3 * * *', $$delete from notes$$);",
			),
		).toBe(true);
	});

	it("keeps a name with digits as one word", () => {
		expect(
			isDestructiveMigration(
				"alter table notes alter column a1b2 set data type int;",
			),
		).toBe(true);
	});

	it("reads the SQL after an escape string or a dollar tag with a digit", () => {
		expect(
			isDestructiveMigration(
				"comment on table notes is E'it\\'s'; drop table notes; comment on table notes is ''",
			),
		).toBe(true);
		expect(
			isDestructiveMigration(
				"comment on table notes is $a1$ ' $a1$; drop table notes; comment on table notes is ' '",
			),
		).toBe(true);
		expect(
			isDestructiveMigration(
				"create view v as select x$a$y from t; drop table notes; create view w as select z$a$w from t;",
			),
		).toBe(true);
	});

	it("answers true for a drop with cascade", () => {
		expect(isDestructiveMigration("drop function f() cascade;")).toBe(true);
	});

	it("answers true for a column type change", () => {
		expect(
			isDestructiveMigration("alter table notes alter column title type int;"),
		).toBe(true);
		expect(
			isDestructiveMigration(
				"alter table notes alter title set data type varchar(10);",
			),
		).toBe(true);
	});

	it("answers true for a do or a call block", () => {
		expect(
			isDestructiveMigration("do $$ begin drop table notes; end $$;"),
		).toBe(true);
		expect(isDestructiveMigration("call purge_notes();")).toBe(true);
	});

	it("ignores destructive words inside comments and strings", () => {
		expect(
			isDestructiveMigration(
				"-- drop table notes\ncomment on table notes is 'truncate me later';",
			),
		).toBe(false);
	});
});

describe("stripSqlNoise", () => {
	it("replaces comments, strings, and quoted names with a space", () => {
		expect(
			stripSqlNoise(`select 'drop' as "delete" -- truncate\nfrom t`).match(
				/[a-z]+/g,
			),
		).toEqual(["select", "as", "from", "t"]);
	});
});
