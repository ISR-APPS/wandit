import { DESKTOP_MIGRATION_MAX_BYTES } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	type DesktopMigrationFile,
	sha256OfMigration,
} from "../../domain/desktop-migrations";
import type { HostToolContext } from "../../domain/ports/host-tools";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../../infrastructure/sandbox/fake-sandbox.provider";
import { createAddLocalMigrationTool } from "./add-local-migration.host-tool";
import { executeTool } from "./backend/fake-backend-tool-deps";

const INIT_SQL =
	"CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);";
// 0001 is in a ready build. 0002 is not built yet.
const FOLDER: DesktopMigrationFile[] = [
	{ fileName: "0001_init.sql", sql: INIT_SQL },
	{
		fileName: "0002_add_customers.sql",
		sql: "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);",
	},
];
const FROZEN = [
	{ name: "init", sha256: sha256OfMigration(INIT_SQL), version: 1 },
];
// A non-ASCII default shows that the host writes the UTF-8 bytes of the input.
const STOCK_SQL =
	"CREATE TABLE stock (id INTEGER PRIMARY KEY, label TEXT NOT NULL DEFAULT 'pièce');";

/** The stdout of the list script: one regular file record per entry. */
function listingOf(entries: { name: string; bytes: number }[]): string {
	return entries.map(({ bytes, name }) => `f\t${bytes}\t${name}\0`).join("");
}

/** The tool on a fake desktop sandbox whose bash answers the spec scripts. */
async function setup() {
	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "desktop-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "desktop-app@1.0.0",
	});
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		framework: "desktop-app",
		holdEventId: null,
		knownThemeFile: () => null,
		mode: "build",
		onThemeFileWritten: () => {},
		organizationId: null,
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "desktop-app@1.0.0",
		turnId: "turn-1",
	};
	const tool = createAddLocalMigrationTool(
		{
			desktopMigrations: { listFrozen: async () => FROZEN },
			logger: { warn: () => {} },
		},
		context,
	);
	/** Queues the answers of the list, read, and create scripts for one call. */
	const answerCall = (files: DesktopMigrationFile[], createExitCode = 0) => {
		const listing = listingOf(
			files.map((file) => ({
				bytes: Buffer.byteLength(file.sql),
				name: file.fileName,
			})),
		);
		const contents = files
			.map((file) => `${Buffer.from(file.sql).toString("base64")}\0`)
			.join("");
		provider.respondTo("bash", { exitCode: 0, stderr: "", stdout: listing });
		provider.respondTo("bash", { exitCode: 0, stderr: "", stdout: contents });
		provider.respondTo("bash", {
			exitCode: createExitCode,
			stderr: "",
			stdout: "",
		});
	};
	/** The sandbox calls after the create of the sandbox. */
	const sandboxCalls = () =>
		provider.calls.filter((call) => call.method !== "getOrCreate");
	return { answerCall, provider, sandbox, sandboxCalls, tool };
}

describe("createAddLocalMigrationTool", () => {
	it("writes the exact SQL under the next version above the files and the frozen rows", async () => {
		const { answerCall, sandbox, sandboxCalls, tool } = await setup();
		answerCall(FOLDER);

		const output = await executeTool(tool, {
			name: "add_stock",
			sql: STOCK_SQL,
		});

		expect(output).toEqual({
			file: "migrations/0003_add_stock.sql",
			status: "added",
			version: 3,
		});
		// The create script copies its first argument to its second one.
		const [temporaryPath = "", target] =
			sandboxCalls().at(-1)?.detail?.split(" ").slice(-2) ?? [];
		expect(target).toBe("migrations/0003_add_stock.sql");
		expect(await sandbox.readFile(temporaryPath)).toEqual(
			new TextEncoder().encode(STOCK_SQL),
		);
	});

	it("writes line 1 from replaces and gates the same text", async () => {
		const { answerCall, sandbox, sandboxCalls, tool } = await setup();
		answerCall(FOLDER);

		const output = await executeTool(tool, {
			name: "init_fix",
			replaces: 1,
			sql: INIT_SQL,
		});

		expect(output).toEqual({
			file: "migrations/0003_init_fix.sql",
			status: "added",
			version: 3,
		});
		const [temporaryPath = ""] =
			sandboxCalls().at(-1)?.detail?.split(" ").slice(-2) ?? [];
		expect(await sandbox.readFile(temporaryPath)).toEqual(
			new TextEncoder().encode(`-- wandit:replaces 0001\n${INIT_SQL}`),
		);
	});

	it("refuses a change that needs a table of an earlier file that is not built yet", async () => {
		const { answerCall, sandboxCalls, tool } = await setup();
		answerCall(FOLDER);

		const output = await executeTool(tool, {
			name: "unique_names",
			sql: "CREATE UNIQUE INDEX customers_name ON customers (name);",
		});

		expect(output).toEqual({
			findings: [
				expect.objectContaining({
					message: expect.stringMatching(
						/^If a build ships the earlier migrations before this one: /,
					),
					rule: "migration_statement_refused",
				}),
			],
			status: "refused",
		});
		expect(sandboxCalls().map(({ method }) => method)).toEqual([
			"exec",
			"exec",
		]);
	});

	it("gates the text that the app embeds", async () => {
		const { answerCall, sandbox, sandboxCalls, tool } = await setup();
		answerCall(FOLDER);
		const sql = "CREATE TABLE a (x);\nSELECT hex('\ud800') = 'EFBFBD';";

		const output = await executeTool(tool, { name: "add_a", sql });

		expect(output).toEqual({
			file: "migrations/0003_add_a.sql",
			status: "added",
			version: 3,
		});
		const [temporaryPath = ""] =
			sandboxCalls().at(-1)?.detail?.split(" ").slice(-2) ?? [];
		expect(await sandbox.readFile(temporaryPath)).toEqual(
			new TextEncoder().encode(sql),
		);
	});

	it("refuses a migration with a gate finding and writes nothing", async () => {
		const { answerCall, sandboxCalls, tool } = await setup();
		answerCall(FOLDER);

		const output = await executeTool(tool, {
			name: "drop_customers",
			sql: "DROP TABLE customers;",
		});

		expect(
			output.status === "refused" && output.findings.map(({ rule }) => rule),
		).toEqual(["migration_statement_refused"]);
		// The list and read scripts ran; the temporary write and the create script did not.
		expect(sandboxCalls().map(({ method }) => method)).toEqual([
			"exec",
			"exec",
		]);
	});

	it.each([
		[
			"more than 500 entries",
			Array.from({ length: 501 }, (_, index) => ({
				bytes: 10,
				name: `${String(index + 1).padStart(4, "0")}_seed.sql`,
			})),
			"migrations",
		],
		[
			"a file above 256 KB",
			[
				{ bytes: 100, name: "0001_init.sql" },
				{ bytes: DESKTOP_MIGRATION_MAX_BYTES + 1, name: "0002_seed.sql" },
			],
			"migrations/0002_seed.sql",
		],
	])("refuses %s before any read", async (_label, entries, path) => {
		const { provider, sandboxCalls, tool } = await setup();
		provider.respondTo("bash", {
			exitCode: 0,
			stderr: "",
			stdout: listingOf(entries),
		});

		const output = await executeTool(tool, {
			name: "add_stock",
			sql: STOCK_SQL,
		});

		expect(output).toEqual({
			findings: [
				expect.objectContaining({ path, rule: "migration_too_large" }),
			],
			status: "refused",
		});
		// Only the list script ran.
		expect(sandboxCalls().map(({ method }) => method)).toEqual(["exec"]);
	});

	it("never reads an entry that is not a regular file", async () => {
		const { provider, sandboxCalls, tool } = await setup();
		// A symlink can point at a large file or a FIFO outside migrations/.
		provider.respondTo("bash", {
			exitCode: 0,
			stderr: "",
			stdout: "f\t100\t0001_init.sql\0l\t20\t0002_link.sql\0",
		});

		const output = await executeTool(tool, {
			name: "add_stock",
			sql: STOCK_SQL,
		});

		expect(output).toEqual({
			message: expect.stringContaining("not a regular file"),
			status: "failed",
		});
		// Only the list script ran.
		expect(sandboxCalls().map(({ method }) => method)).toEqual(["exec"]);
	});

	it("never overwrites a file that another writer made after the listing", async () => {
		const { answerCall, sandbox, tool } = await setup();
		const targetPath = `${FAKE_WORKSPACE_DIR}/migrations/0003_add_stock.sql`;
		await sandbox.writeFiles([{ content: "-- other", path: targetPath }]);
		// 45: the create script finds the name taken.
		answerCall(FOLDER, 45);

		const output = await executeTool(tool, {
			name: "add_stock",
			sql: STOCK_SQL,
		});

		expect(output).toEqual({
			message: expect.stringContaining("never overwrites"),
			status: "failed",
		});
		expect(await sandbox.readFile(targetPath)).toEqual(
			new TextEncoder().encode("-- other"),
		);
	});

	it("runs parallel calls one at a time, so each call gets its own version", async () => {
		const { answerCall, tool } = await setup();
		answerCall(FOLDER);
		answerCall([...FOLDER, { fileName: "0003_add_stock.sql", sql: STOCK_SQL }]);

		const outputs = await Promise.all([
			executeTool(tool, { name: "add_stock", sql: STOCK_SQL }),
			executeTool(tool, {
				name: "add_orders",
				sql: "CREATE TABLE orders (id INTEGER PRIMARY KEY);",
			}),
		]);

		expect(outputs).toEqual([
			{ file: "migrations/0003_add_stock.sql", status: "added", version: 3 },
			{ file: "migrations/0004_add_orders.sql", status: "added", version: 4 },
		]);
	});
});
