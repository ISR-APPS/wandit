import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEMPLATE_ARCHIVE_DIR } from "../sandbox/template-init";

const BASE_SQL_PATH = "supabase/migrations/0000_base.sql";
// Provisioning applies this file to each new backend.
const WEB_BASE_SQL_FILE = join(TEMPLATE_ARCHIVE_DIR, "web-app", BASE_SQL_PATH);
const MOBILE_BASE_SQL_FILE = join(
	TEMPLATE_ARCHIVE_DIR,
	"mobile-app",
	BASE_SQL_PATH,
);

// PGlite has no pg_cron extension. The spec removes this one line of the real file.
const BASE_SQL = readFileSync(WEB_BASE_SQL_FILE, "utf8").replace(
	"create extension if not exists pg_cron;",
	"",
);

// The parts of a Supabase database that the base SQL uses and PGlite does not have.
// The default privileges copy Supabase. Without them, the `revoke` lines of the base SQL prove nothing.
const SUPABASE_STUB_SQL = `
	create role anon nologin;
	create role authenticated nologin;
	create role supabase_auth_admin nologin;
	create schema auth;
	grant usage on schema auth to anon, authenticated, supabase_auth_admin;
	create table auth.users (
		id uuid primary key,
		email text,
		email_confirmed_at timestamptz,
		is_anonymous boolean not null default false,
		created_at timestamptz not null default now()
	);
	alter table auth.users owner to supabase_auth_admin;
	create function auth.uid() returns uuid language sql stable as
		$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
	grant usage on schema public to anon, authenticated;
	alter default privileges in schema public grant all on tables to anon, authenticated;
	alter default privileges in schema public grant all on functions to anon, authenticated;
`;

// Account ids, in the sign-up order of `signUpTeam`.
const OWNER = "00000000-0000-0000-0000-000000000001";
const MEMBER = "00000000-0000-0000-0000-000000000002";
const PENDING = "00000000-0000-0000-0000-000000000003";
const WAITING = "00000000-0000-0000-0000-000000000004";
const REFUSED = "00000000-0000-0000-0000-000000000005";
// An id with no row in auth.users.
const NO_ACCOUNT = "00000000-0000-0000-0000-000000000009";
// The newest account of the backfill cases. It has the smallest id, so an order by id alone makes it the owner.
const NEWEST = "00000000-0000-0000-0000-000000000000";
// An account of an anonymous sign-in.
const ANONYMOUS = "00000000-0000-0000-0000-000000000006";
// An account with no confirmation time. It is the oldest account of the backfill cases.
const UNCONFIRMED = "00000000-0000-0000-0000-000000000007";

// The decision of the owner in the web template: a plain update of one column.
const SET_STATUS_SQL =
	"update public.app_access set status = $2 where user_id = $1 returning user_id";
// SQLSTATE insufficient_privilege: the role has no grant for the statement.
const PERMISSION_DENIED = { code: "42501" };

/**
 * Runs one statement as a database role, with `userId` as the JWT subject that `auth.uid()` reads.
 * Answers the rows. `set local` and the transaction keep the role change inside this call.
 */
async function runAs<Row extends Record<string, string | null>>(
	db: PGlite,
	role: "authenticated" | "supabase_auth_admin",
	userId: string,
	sql: string,
	params: string[],
): Promise<Row[]> {
	return db.transaction(async (tx) => {
		await tx.exec(`set local role ${role}`);
		await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
			userId,
		]);
		return (await tx.query<Row>(sql, params)).rows;
	});
}

/** One statement of a signed-in client: the role `authenticated` and the account id as the JWT subject. */
function asAccount<Row extends Record<string, string | null>>(
	db: PGlite,
	userId: string,
	sql: string,
	params: string[] = [],
): Promise<Row[]> {
	return runAs<Row>(db, "authenticated", userId, sql, params);
}

/**
 * The first write of a sign-up: Supabase Auth inserts the account as the role `supabase_auth_admin`.
 * The statement has no JWT and no confirmation time.
 */
async function signUpUnconfirmed(db: PGlite, userId: string): Promise<void> {
	await runAs(
		db,
		"supabase_auth_admin",
		"",
		"insert into auth.users (id, email) values ($1, $2)",
		[userId, `${userId}@app.test`],
	);
}

/**
 * The confirmation: Supabase Auth sets the time with an update that names the column.
 * With autoconfirm, it does this right after the insert. Else, it waits until the person confirms the email.
 */
async function confirmEmail(db: PGlite, userId: string): Promise<void> {
	await runAs(
		db,
		"supabase_auth_admin",
		"",
		"update auth.users set email_confirmed_at = now() where id = $1",
		[userId],
	);
}

/** A sign-up of a person with a confirmed email: the insert, then the confirmation. */
async function signUp(db: PGlite, userId: string): Promise<void> {
	await signUpUnconfirmed(db, userId);
	await confirmEmail(db, userId);
}

/**
 * Reads all access rows as the database owner, so no policy hides a row.
 * Answers one entry per account id, for example "member pending".
 */
async function accessByAccount(db: PGlite): Promise<Record<string, string>> {
	const { rows } = await db.query<{ user_id: string; access: string }>(
		"select user_id, role || ' ' || status as access from public.app_access",
	);
	return Object.fromEntries(rows.map((row) => [row.user_id, row.access]));
}

/** The answer of `private.data_owner_id()` for one signed-in account. */
async function dataOwnerId(db: PGlite, userId: string): Promise<string | null> {
	const rows = await asAccount<{ id: string | null }>(
		db,
		userId,
		"select private.data_owner_id() as id",
	);
	// A missing row is a failure of the query, not a null answer.
	if (rows[0] === undefined) throw new Error("data_owner_id gave no row");
	return rows[0].id;
}

/**
 * Makes the five accounts of a team app. A team app has no row in `private.app_config`.
 * The accounts: the owner, an approved member, two pending accounts, and a refused account.
 */
async function signUpTeam(db: PGlite): Promise<void> {
	for (const userId of [OWNER, MEMBER, PENDING, WAITING, REFUSED]) {
		await signUp(db, userId);
	}
	// The database owner sets the states, so the setup does not use the policy under test.
	await db.query(
		"update public.app_access set status = 'approved' where user_id = $1",
		[MEMBER],
	);
	await db.query(
		"update public.app_access set status = 'refused' where user_id = $1",
		[REFUSED],
	);
}

describe("templates/web-app/supabase/migrations/0000_base.sql", () => {
	// One database serves all cases: each PGlite start costs 1 to 4 s.
	let db: PGlite;

	// The first start compiles the WASM file of PGlite. 60 s covers a busy CI machine.
	beforeAll(async () => {
		db = new PGlite();
		await db.exec(SUPABASE_STUB_SQL);
		await db.exec(BASE_SQL);
	}, 60_000);

	// Each case starts with no account and with the audience 'team'. The cascade removes the access rows.
	beforeEach(async () => {
		await db.exec("delete from auth.users; delete from private.app_config;");
	});

	afterAll(async () => {
		await db.close();
	});

	it("runs a second time with accounts present and keeps the access rows", async () => {
		await signUpTeam(db);
		const before = await accessByAccount(db);

		await db.exec(BASE_SQL);

		expect(Object.keys(before)).toHaveLength(5);
		expect(await accessByAccount(db)).toEqual(before);
	});

	it.each([
		{
			state: "the table is empty: the oldest confirmed account is the owner",
			deleteRowsSql: "delete from public.app_access",
			expected: {
				[OWNER]: "owner approved",
				[MEMBER]: "member pending",
				[NEWEST]: "member pending",
			},
		},
		{
			state: "another account has a row: no account is the owner",
			deleteRowsSql: `delete from public.app_access where user_id = '${OWNER}'`,
			expected: {
				[OWNER]: "member pending",
				[MEMBER]: "member pending",
				[NEWEST]: "member pending",
			},
		},
	])("gives a row to each confirmed account from before the file, and to no other account, when $state", async ({
		deleteRowsSql,
		expected,
	}) => {
		await signUp(db, OWNER);
		await signUp(db, MEMBER);
		// One hour later than the accounts above: two sign-ups can get the same `now()` in PGlite.
		await db.query(
			"insert into auth.users (id, email_confirmed_at, created_at) values ($1, now(), now() + interval '1 hour')",
			[NEWEST],
		);
		// One hour older than the owner, with no confirmation time. The backfill must not read it as the oldest account.
		await db.query(
			"insert into auth.users (id, created_at) values ($1, now() - interval '1 hour')",
			[UNCONFIRMED],
		);
		// An account from before the file has no access row. The database owner removes the row to make that state.
		await db.exec(deleteRowsSql);

		await db.exec(BASE_SQL);

		expect(await accessByAccount(db)).toEqual(expected);
	});

	it("gives no row to an anonymous account, so it never takes the owner role", async () => {
		// One hour older than the owner, so the backfill reads it as the oldest account.
		// It has a confirmation time, so only the `is_anonymous` checks keep the row out.
		await db.query(
			"insert into auth.users (id, is_anonymous, email_confirmed_at, created_at) values ($1, true, now(), now() - interval '1 hour')",
			[ANONYMOUS],
		);
		await signUp(db, OWNER);

		expect(await accessByAccount(db)).toEqual({ [OWNER]: "owner approved" });

		// The backfill also skips it, when the table is empty.
		await db.exec("delete from public.app_access");
		await db.exec(BASE_SQL);

		expect(await accessByAccount(db)).toEqual({ [OWNER]: "owner approved" });
	});

	it("gives the owner role to the first account with a confirmed email, not to the first sign-up", async () => {
		// The first person types a wrong address. That account stays unconfirmed for now.
		await signUpUnconfirmed(db, PENDING);
		await signUpUnconfirmed(db, OWNER);
		expect(await accessByAccount(db)).toEqual({});

		await confirmEmail(db, OWNER);
		expect(await accessByAccount(db)).toEqual({ [OWNER]: "owner approved" });

		await confirmEmail(db, PENDING);
		expect(await accessByAccount(db)).toEqual({
			[OWNER]: "owner approved",
			[PENDING]: "member pending",
		});
	});

	it("gives the row at once to an account that one insert writes with a confirmation time", async () => {
		// A seed or an import writes the account with one insert. No update follows.
		await db.query(
			"insert into auth.users (id, email, email_confirmed_at) values ($1, 'seed@app.test', now())",
			[OWNER],
		);

		expect(await accessByAccount(db)).toEqual({ [OWNER]: "owner approved" });
	});

	it("keeps the row and does not fail when Supabase Auth sets the confirmation time again", async () => {
		await signUp(db, OWNER);
		await signUp(db, MEMBER);

		// The admin API with `email_confirm: true` updates the column of an account that has a row.
		await confirmEmail(db, MEMBER);

		expect(await accessByAccount(db)).toEqual({
			[OWNER]: "owner approved",
			[MEMBER]: "member pending",
		});
	});

	it("does not give the owner role to a sign-up after the owner account is deleted", async () => {
		await signUp(db, OWNER);
		await signUp(db, MEMBER);

		await db.query("delete from auth.users where id = $1", [OWNER]);
		await signUp(db, PENDING);

		expect(await accessByAccount(db)).toEqual({
			[MEMBER]: "member pending",
			[PENDING]: "member pending",
		});
	});

	it("approves a later sign-up at once in a public app, with its own id as the data owner", async () => {
		// The line that the agent puts in the first migration of an app for the public.
		await db.exec(
			"insert into private.app_config (audience) values ('public') on conflict do nothing;",
		);

		await signUp(db, OWNER);
		await signUp(db, MEMBER);

		expect(await accessByAccount(db)).toEqual({
			[OWNER]: "owner approved",
			[MEMBER]: "member approved",
		});
		expect(await dataOwnerId(db, MEMBER)).toBe(MEMBER);
	});

	it.each([
		{ caller: "the owner", userId: OWNER, expected: OWNER },
		{ caller: "an approved member", userId: MEMBER, expected: OWNER },
		{ caller: "a pending account", userId: PENDING, expected: null },
		{ caller: "a refused account", userId: REFUSED, expected: null },
	])("private.data_owner_id() of a team app gives $caller $expected", async ({
		userId,
		expected,
	}) => {
		await signUpTeam(db);

		expect(await dataOwnerId(db, userId)).toBe(expected);
	});

	it("lets the owner approve a pending account and refuse an approved account", async () => {
		await signUpTeam(db);

		const approved = await asAccount(db, OWNER, SET_STATUS_SQL, [
			PENDING,
			"approved",
		]);
		const refused = await asAccount(db, OWNER, SET_STATUS_SQL, [
			MEMBER,
			"refused",
		]);

		expect(approved).toEqual([{ user_id: PENDING }]);
		expect(refused).toEqual([{ user_id: MEMBER }]);
		expect(await accessByAccount(db)).toMatchObject({
			[PENDING]: "member approved",
			[MEMBER]: "member refused",
		});
	});

	it.each([
		{ actor: "an approved member", userId: MEMBER },
		{ actor: "a pending account", userId: PENDING },
		{ actor: "a refused account", userId: REFUSED },
	])("does not let $actor read another row, approve an account, take the owner role, or insert or delete a row", async ({
		userId,
	}) => {
		await signUpTeam(db);
		const before = await accessByAccount(db);

		// The select policy shows an account only its own row. The email list is for the owner.
		expect(
			await asAccount(db, userId, "select user_id from public.app_access"),
		).toEqual([{ user_id: userId }]);
		// No update policy matches an account that is not the owner: the update changes 0 rows.
		expect(
			await asAccount(db, userId, SET_STATUS_SQL, [userId, "approved"]),
		).toEqual([]);
		expect(
			await asAccount(db, userId, SET_STATUS_SQL, [WAITING, "approved"]),
		).toEqual([]);
		await expect(
			asAccount(
				db,
				userId,
				"update public.app_access set role = 'owner' where user_id = $1",
				[userId],
			),
		).rejects.toMatchObject(PERMISSION_DENIED);
		await expect(
			asAccount(
				db,
				userId,
				"insert into public.app_access (user_id, email, status) values ($1, 'new@app.test', 'approved')",
				[NO_ACCOUNT],
			),
		).rejects.toMatchObject(PERMISSION_DENIED);
		await expect(
			asAccount(
				db,
				userId,
				"delete from public.app_access where user_id = $1",
				[OWNER],
			),
		).rejects.toMatchObject(PERMISSION_DENIED);
		expect(await accessByAccount(db)).toEqual(before);
	});

	it("does not let the owner change the own row", async () => {
		await signUp(db, OWNER);

		const changed = await asAccount(db, OWNER, SET_STATUS_SQL, [
			OWNER,
			"refused",
		]);

		expect(changed).toEqual([]);
		expect(await accessByAccount(db)).toEqual({ [OWNER]: "owner approved" });
	});

	it("has a mobile copy that equals the web file byte for byte", () => {
		const web = readFileSync(WEB_BASE_SQL_FILE);
		const mobile = readFileSync(MOBILE_BASE_SQL_FILE);

		expect(mobile.equals(web)).toBe(true);
	});
});
