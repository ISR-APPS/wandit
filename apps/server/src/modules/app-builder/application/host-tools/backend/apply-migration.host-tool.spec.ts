import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { FAKE_WORKSPACE_DIR } from "../../../infrastructure/sandbox/fake-sandbox.provider";
import { jsonResponse } from "../../../infrastructure/supabase/fake-supabase-fetch";
import {
	createApplyDestructiveMigrationTool,
	createApplyMigrationTool,
} from "./apply-migration.host-tool";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
	executeTool,
	sentQuery,
} from "./fake-backend-tool-deps";

const CREATE_NOTES = `create table public.notes (id uuid primary key, title text);
alter table public.notes enable row level security;
create policy "notes_select" on public.notes for select using (true);`;
const CREATE_NOTES_SHA = createHash("sha256")
	.update(CREATE_NOTES)
	.digest("hex");
const DROP_TITLE = "alter table public.notes drop column title;";
// The stamp of `FAKE_NOW` (2026-09-23 10:15:00 UTC).
const NEW_FILE = "supabase/migrations/20260923101500_create_notes.sql";

// The three answers of a fresh apply: the ledger, the lookup, the migration.
function freshApplyAnswers() {
	return [
		jsonResponse(201, "[]"),
		jsonResponse(201, "[]"),
		jsonResponse(201, "[]"),
	];
}

async function sandboxText(
	fixture: Awaited<ReturnType<typeof createBackendToolFixture>>,
	file: string,
) {
	const bytes = await fixture.sandbox.readFile(`${FAKE_WORKSPACE_DIR}/${file}`);
	return bytes === null ? null : new TextDecoder().decode(bytes);
}

describe("apply_migration", () => {
	it("records the ledger row with the migration, writes the file, and audits", async () => {
		const fixture = await createBackendToolFixture({
			answers: freshApplyAnswers(),
		});
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "create_notes",
			sql: CREATE_NOTES,
		});

		expect(output).toEqual({ file: NEW_FILE, status: "applied" });
		expect(sentQuery(fixture.requests[0]).query).toContain(
			"create table if not exists wandit.migrations",
		);
		const lookup = sentQuery(fixture.requests[1]);
		expect(lookup.read_only).toBe(true);
		expect(lookup.query).toContain(`where sha256 = '${CREATE_NOTES_SHA}'`);
		expect(sentQuery(fixture.requests[2]).query).toBe(
			`insert into wandit.migrations (name, sha256, applied_at) values ('create_notes', '${CREATE_NOTES_SHA}', '2026-09-23T10:15:00.000Z');\n${CREATE_NOTES}`,
		);
		expect(await sandboxText(fixture, NEW_FILE)).toBe(`${CREATE_NOTES}\n`);
		expect(fixture.audits).toEqual([
			{
				action: "backend.migration_applied",
				actorUserId: "user-1",
				metadata: {
					destructive: false,
					name: "create_notes",
					sha256: CREATE_NOTES_SHA,
				},
				organizationId: "org-1",
				projectId: "project-1",
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
	});

	it("skips a repeated sha, writes the stored file again, and audits nothing", async () => {
		const fixture = await createBackendToolFixture({
			answers: [
				jsonResponse(201, "[]"),
				jsonResponse(
					201,
					JSON.stringify([{ name: "create_notes", stamp: "20260922080000" }]),
				),
			],
		});
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "create_notes_again",
			sql: CREATE_NOTES,
		});

		const storedFile = "supabase/migrations/20260922080000_create_notes.sql";
		expect(output).toEqual({
			file: storedFile,
			reason: "already applied",
			status: "skipped",
		});
		expect(fixture.requests).toHaveLength(2);
		expect(await sandboxText(fixture, storedFile)).toBe(`${CREATE_NOTES}\n`);
		expect(fixture.audits).toEqual([]);
	});

	it("waits for approval on a drop column and sends no SQL", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "drop_title",
			sql: DROP_TITLE,
		});

		expect(output).toEqual({
			status: "needs_approval",
			tool: "apply_destructive_migration",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("refuses a commit inside the migration before any SQL runs", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "split_notes",
			sql: "create table a (id int); commit; create table b (id int);",
		});

		expect(output).toEqual({
			reason:
				"A migration runs in one transaction. Remove begin, commit, rollback, and savepoint.",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
		expect(fixture.audits).toEqual([]);
	});

	it("answers a paused or a missing backend at once and calls no upstream", async () => {
		for (const [backend, status] of [
			[{ ...ACTIVE_BACKEND_ROW, status: "paused" as const }, "backend_paused"],
			[null, "backend_not_ready"],
		] as const) {
			const fixture = await createBackendToolFixture({ backend });
			const tool = createApplyMigrationTool(fixture.deps, fixture.context);

			const output = await executeTool(tool, {
				name: "create_notes",
				sql: CREATE_NOTES,
			});

			expect(output).toEqual({ status });
			expect(fixture.requests).toEqual([]);
		}
	});

	it("answers failed without a client", async () => {
		const fixture = await createBackendToolFixture({ withClient: false });
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		expect(
			await executeTool(tool, { name: "create_notes", sql: CREATE_NOTES }),
		).toEqual({
			reason: "SUPABASE_PLATFORM_TOKEN is not set",
			status: "failed",
		});
	});

	it("answers the upstream message and writes no file and no audit when the migration fails", async () => {
		const message =
			'Failed to run sql query: ERROR:  42P07: relation "notes" already exists';
		const fixture = await createBackendToolFixture({
			answers: [
				jsonResponse(201, "[]"),
				jsonResponse(201, "[]"),
				jsonResponse(400, JSON.stringify({ message })),
			],
		});
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "create_notes",
			sql: CREATE_NOTES,
		});

		expect(output).toEqual({ reason: message, status: "failed" });
		expect(await sandboxText(fixture, NEW_FILE)).toBeNull();
		expect(fixture.audits).toEqual([]);
	});

	it("refuses a name outside the pattern before any SQL runs", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "x', 'y', now()); drop table notes; --",
			sql: CREATE_NOTES,
		});

		expect(output).toMatchObject({ status: "failed" });
		expect(fixture.requests).toEqual([]);
	});

	it("keeps the audit row when the file write fails after the commit", async () => {
		const fixture = await createBackendToolFixture({
			answers: freshApplyAnswers(),
		});
		fixture.sandbox.writeFiles = async () => {
			throw new Error("sandbox gone");
		};
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "create_notes",
			sql: CREATE_NOTES,
		});

		expect(output).toEqual({
			reason: "The tool failed on the server",
			status: "failed",
		});
		expect(fixture.requests).toHaveLength(3);
		expect(fixture.audits.map((row) => row.action)).toEqual([
			"backend.migration_applied",
		]);
	});

	it("refuses a ledger row whose name is not a migration name", async () => {
		const fixture = await createBackendToolFixture({
			answers: [
				jsonResponse(201, "[]"),
				jsonResponse(
					201,
					JSON.stringify([{ name: "../../.bashrc", stamp: "20260922080000" }]),
				),
			],
		});
		const tool = createApplyMigrationTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "create_notes",
			sql: CREATE_NOTES,
		});

		expect(output).toEqual({
			reason: "unexpected response body",
			status: "failed",
		});
		expect(
			fixture.provider.calls.some((call) => call.method === "writeFiles"),
		).toBe(false);
	});
});

describe("apply_destructive_migration", () => {
	it("applies the drop column the user approved and audits it as destructive", async () => {
		const fixture = await createBackendToolFixture({
			answers: freshApplyAnswers(),
		});
		const tool = createApplyDestructiveMigrationTool(
			fixture.deps,
			fixture.context,
		);

		const output = await executeTool(tool, {
			name: "drop_title",
			sql: DROP_TITLE,
		});

		expect(output).toEqual({
			file: "supabase/migrations/20260923101500_drop_title.sql",
			status: "applied",
		});
		expect(sentQuery(fixture.requests[2]).query).toContain(DROP_TITLE);
		expect(fixture.audits[0]?.metadata).toMatchObject({
			destructive: true,
			name: "drop_title",
		});
	});
});
