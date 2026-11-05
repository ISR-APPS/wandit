/**
 * The `add_local_migration` host tool of a desktop project (docs/v2/desktop-apps.md section 6).
 * `BuilderHostToolRegistry` builds it once per build turn of a `desktop-app` project.
 * It lists and reads `migrations/` through the sandbox exec. It reads the frozen rows with
 * `DesktopMigrationsRepository.listFrozen`. It runs `checkDesktopMigrations` up to two times,
 * the second time as if the earlier files were built. Then it writes the new file create-only.
 */
import { randomUUID } from "node:crypto";

import {
	type AddLocalMigrationToolInput,
	type AddLocalMigrationToolOutput,
	addLocalMigrationToolInputSchema,
	DESKTOP_MIGRATION_MAX_BYTES,
	DESKTOP_MIGRATIONS_DIR,
	DESKTOP_MIGRATIONS_MAX_COUNT,
	DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES,
	type DesktopGateFinding,
	parseDesktopMigrationFileName,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { type Tool, tool } from "ai";
import { z } from "zod";

import {
	type DesktopMigrationFile,
	desktopGateFinding,
	type ReleasedDesktopMigration,
	sha256OfMigration,
} from "../../domain/desktop-migrations";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type { DesktopMigrationsRepository } from "../../infrastructure/persistence/desktop-migrations.repository";
import { checkDesktopMigrations } from "../../infrastructure/sqlite/desktop-migration-gate";

/** The tool name that the registry and the CLAUDE.md of the desktop template share. */
export const ADD_LOCAL_MIGRATION_TOOL_NAME = "add_local_migration";

/** What the registry hands the add_local_migration tool factory. */
export type AddLocalMigrationHostToolDeps = {
	/** Reads the frozen files of the project: the files that a ready build held. */
	desktopMigrations: Pick<DesktopMigrationsRepository, "listFrozen">;
	/** Gets one warning per failed call. The registry passes the logger of the task. */
	logger: Pick<Console, "warn">;
};

// The file name holds the version in 4 digits.
const MAX_MIGRATION_VERSION = 9999;

// 10 s for one script. A FIFO in migrations/ blocks `head`, and the vendor kills the command at this timeout.
const COMMAND_TIMEOUT_MS = 10_000;

// The exit code of CREATE_SCRIPT when the target name exists.
const NAME_TAKEN_EXIT_CODE = 45;

// The exit code of LIST_SCRIPT when migrations/ is missing or is a symlink.
const NOT_A_FOLDER_EXIT_CODE = 46;

// Keeps an error message short in the logs: stderr and an untrusted record can be large.
const LOGGED_TEXT_MAX_CHARS = 500;

/**
 * Prints one record per entry of the folder `$1`: "<type>\t<bytes>\t<name>\0". The type is the
 * `find -printf %y` letter, for example "f" for a regular file and "l" for a symlink. `find` does not
 * follow a symlink. `head` keeps at most `$2` records, so the stdout stays small for any folder.
 * `head` can close the pipe early, and `find` then exits 141 (SIGPIPE): not a failure.
 * A failed `head` fails the script: an empty listing would hide the files and reuse version 1.
 * A folder `$1` that is missing or is a symlink gives NOT_A_FOLDER_EXIT_CODE.
 */
const LIST_SCRIPT = [
	"dir=$1; cap=$2",
	`[ -d "$dir" ] && [ ! -L "$dir" ] || exit ${NOT_A_FOLDER_EXIT_CODE}`,
	'find "$dir" -mindepth 1 -maxdepth 1 -printf \'%y\\t%s\\t%f\\0\' | head -z -n "$cap"',
	`s=("\${PIPESTATUS[@]}")`,
	`{ [ "\${s[0]}" -eq 0 ] || [ "\${s[0]}" -eq 141 ]; } && [ "\${s[1]}" -eq 0 ] || exit 1`,
].join("\n");

/**
 * Prints each file of the folder `$1`, given as "<bytes> <name>" argument pairs, as base64 and a NUL.
 * `head -c` reads one byte more than the listed size. A file that grew after the listing shows it,
 * and a file swapped for a symlink to a large file still gives a bounded read.
 */
const READ_SCRIPT = [
	"set -o pipefail",
	"dir=$1; shift",
	'while [ "$#" -gt 0 ]; do',
	'  head -c "$(( $1 + 1 ))" -- "$dir/$2" | base64 -w 0 || exit 1',
	"  printf '\\0'",
	"  shift 2",
	"done",
].join("\n");

/**
 * Copies the temporary file `$1` to the new path `$2`, then deletes `$1`. It never overwrites:
 * noclobber (`set -C`) makes the first `>` fail when `$2` exists, also when another process made it
 * after the check. Only a failed copy into the file that this script made deletes `$2`.
 */
const CREATE_SCRIPT = [
	"trap 'rm -f -- \"$1\"' EXIT",
	`if [ -e "$2" ] || [ -L "$2" ]; then exit ${NAME_TAKEN_EXIT_CODE}; fi`,
	"set -C",
	': > "$2" || exit 1',
	'cat -- "$1" >| "$2" || { rm -f -- "$2"; exit 1; }',
].join("\n");

// Keeps a byte order mark in the text, so the text hashes like the file bytes.
const UTF8 = new TextDecoder("utf-8", { ignoreBOM: true });

/** One entry of migrations/, from LIST_SCRIPT. Untrusted: the agent controls the folder. */
type MigrationEntry = {
	/** The `find %y` letter. Only "f", a regular file, is read. */
	type: string;
	/** Size in bytes at the listing. */
	bytes: number;
	/** Name inside migrations/, without a slash. */
	name: string;
};

/**
 * Builds the AI SDK tool the harness sees. A call never throws: a refused or failed call answers
 * a status, and migrations/ stays as it was.
 */
export function createAddLocalMigrationTool(
	deps: AddLocalMigrationHostToolDeps,
	context: HostToolContext,
): Tool<AddLocalMigrationToolInput, AddLocalMigrationToolOutput> {
	// The agent can send parallel tool calls, and each call would pick the same version.
	// So the calls of one turn run one at a time. The turn lock gives one turn per project.
	let lastCall: Promise<void> = Promise.resolve();
	return tool({
		description:
			"Add ONE SQLite migration to the desktop app. The host writes it as migrations/NNNN_<name>.sql " +
			"with the next free version. Use it for every schema change. Never write in migrations/ " +
			"yourself, and never change a migration after it is added. " +
			"Allowed: CREATE TABLE, CREATE INDEX, CREATE UNIQUE INDEX on a table that the same migration " +
			"creates, CREATE VIEW, CREATE TRIGGER, ALTER TABLE ... ADD COLUMN, DROP INDEX, DROP TRIGGER, " +
			"INSERT OR IGNORE, UPDATE OR IGNORE of columns that the same migration adds, and checks. " +
			"A check is a SELECT that must answer one row with the integer 1, for example SELECT (SELECT " +
			"count(*) FROM emails) = (SELECT count(*) FROM customers WHERE email IS NOT NULL). Any other " +
			"answer stops the update. " +
			"Refused: a plain INSERT or UPDATE, DROP TABLE, DROP VIEW, RENAME, DROP COLUMN, DELETE, REPLACE, " +
			"DO UPDATE, PRAGMA, ATTACH, transactions, VACUUM, WITH, sqlite_ and pragma_ names, and math " +
			"functions such as floor() and sqrt(), which the installed app does not have. " +
			"An INSERT or UPDATE must not be able to fire a trigger or a foreign key action (ON UPDATE " +
			"CASCADE, SET NULL, SET DEFAULT, RESTRICT). Create a trigger after the statements that fill its " +
			"table. Before an INSERT or UPDATE on a table with a trigger, drop the trigger, and create it " +
			"again after. The check stops after 30 s, so join each table on a key column. " +
			"The app runs all new migrations of an update in one transaction. The host first runs the SQL " +
			"on test rows (duplicates, NULLs, empty and negative values, malformed JSON, missing parents) " +
			"and on a new install. `refused` lists the findings and writes nothing. " +
			"`replaces`: use it only when a finding or the user names a failing migration of an earlier " +
			"build. Give its version. Copy its CREATE, ALTER, and DROP statements byte for byte, and fix " +
			"only its INSERT, UPDATE, and SELECT statements. Installs that ran the old file skip the new " +
			"one. Other installs run the new one in its place.",
		inputSchema: addLocalMigrationToolInputSchema,
		execute: (input): Promise<AddLocalMigrationToolOutput> => {
			const call = lastCall.then(() =>
				runAddLocalMigration(deps, context, input),
			);
			// `runAddLocalMigration` never rejects, so the queue never stops.
			lastCall = call.then(() => undefined);
			return call;
		},
	});
}

// Parses the input, then adds the migration. Every error becomes a `failed` answer and a warning.
async function runAddLocalMigration(
	deps: AddLocalMigrationHostToolDeps,
	context: HostToolContext,
	rawInput: unknown,
): Promise<AddLocalMigrationToolOutput> {
	// Security check: the harness runs `execute` with the raw model JSON and does not parse it.
	const parsed = addLocalMigrationToolInputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return {
			message: `The input is not valid. ${z.prettifyError(parsed.error)}`,
			status: "failed",
		};
	}
	try {
		return await addLocalMigration(deps, context, parsed.data);
	} catch (error) {
		// sql.js did not load, or the sandbox or the database failed.
		deps.logger.warn("host-tool.add_local_migration.failed", {
			message: getErrorMessage(error),
			projectId: context.projectId,
			turnId: context.turnId,
		});
		return {
			message: `The host could not add the migration, and ${DESKTOP_MIGRATIONS_DIR}/ did not change. Try once more.`,
			status: "failed",
		};
	}
}

// Lists, reads, checks, then writes. A refusal or a failure answers before the write.
async function addLocalMigration(
	deps: AddLocalMigrationHostToolDeps,
	context: HostToolContext,
	input: AddLocalMigrationToolInput,
): Promise<AddLocalMigrationToolOutput> {
	const { sandbox } = context;
	// One record more than the limit shows a folder that is too large.
	const listed = await runScript(sandbox, LIST_SCRIPT, [
		DESKTOP_MIGRATIONS_DIR,
		String(DESKTOP_MIGRATIONS_MAX_COUNT + 1),
	]);
	// The deny rules and the hook block git restore and every write in migrations/.
	// So the agent cannot repair the folder: it stops, and the user restores a saved version.
	if (listed.exitCode === NOT_A_FOLDER_EXIT_CODE) {
		return {
			message: `${DESKTOP_MIGRATIONS_DIR}/ is missing or is not a folder. You cannot repair it: the rules block git restore and every write in ${DESKTOP_MIGRATIONS_DIR}/. Stop, and tell the user to restore the last version of the app.`,
			status: "failed",
		};
	}
	if (listed.exitCode !== 0) {
		throw new Error(
			`The migrations listing failed (${listed.exitCode}): ${listed.stderr.slice(0, LOGGED_TEXT_MAX_CHARS)}`,
		);
	}
	const entries = parseListing(listed.stdout);

	// Security: the limits apply before any read, so a large folder never fills the task memory.
	const sizeFindings = findOversizedEntries(entries);
	if (sizeFindings.length > 0) {
		return { findings: sizeFindings, status: "refused" };
	}
	// A symlink, a folder, or a FIFO is never read: its size in the listing says nothing about its content.
	// The rules block an rm in migrations/, so the agent stops and the user restores a saved version.
	const notAFile = entries.find((entry) => entry.type !== "f");
	if (notAFile !== undefined) {
		return {
			message: `${DESKTOP_MIGRATIONS_DIR}/${notAFile.name} is not a regular file. You cannot remove it: the rules block every write in ${DESKTOP_MIGRATIONS_DIR}/. Stop, and tell the user to restore the last version of the app.`,
			status: "failed",
		};
	}

	const read = await runScript(sandbox, READ_SCRIPT, [
		DESKTOP_MIGRATIONS_DIR,
		...entries.flatMap((entry) => [String(entry.bytes), entry.name]),
	]);
	if (read.exitCode !== 0) {
		throw new Error(
			`The migrations read failed (${read.exitCode}): ${read.stderr.slice(0, LOGGED_TEXT_MAX_CHARS)}`,
		);
	}
	// The text after the last NUL is empty.
	const contents = read.stdout.split("\0").slice(0, -1);
	if (contents.length !== entries.length) {
		throw new Error(
			`The migrations read answered ${contents.length} files for ${entries.length} entries`,
		);
	}
	const files: DesktopMigrationFile[] = [];
	for (const [index, entry] of entries.entries()) {
		const bytes = Buffer.from(contents[index] ?? "", "base64");
		if (bytes.byteLength !== entry.bytes) {
			return {
				message: `${DESKTOP_MIGRATIONS_DIR}/${entry.name} changed during the read. Call the tool again.`,
				status: "failed",
			};
		}
		files.push({ fileName: entry.name, sql: UTF8.decode(bytes) });
	}

	const frozen = await deps.desktopMigrations.listFrozen(context.projectId);
	// Above every file and every frozen version: a frozen file that is missing keeps its version.
	const version =
		1 +
		Math.max(
			0,
			...files.map(
				(file) => parseDesktopMigrationFileName(file.fileName)?.version ?? 0,
			),
			...frozen.map((row) => row.version),
		);
	if (version > MAX_MIGRATION_VERSION) {
		return {
			message: `No version is left: ${DESKTOP_MIGRATIONS_DIR}/ already uses version ${MAX_MIGRATION_VERSION}.`,
			status: "failed",
		};
	}
	const fileName = `${String(version).padStart(4, "0")}_${input.name}.sql`;
	const text =
		input.replaces === undefined
			? input.sql
			: `-- wandit:replaces ${String(input.replaces).padStart(4, "0")}\n${input.sql}`;
	// A lone surrogate (\ud800) is legal in a JS string. TextEncoder writes it as U+FFFD, and sql.js
	// reads it as other bytes (R01e, R01f). The gate checks the decoded bytes, so it sees the text that the app embeds.
	const bytes = new TextEncoder().encode(text);
	const gatedSql = UTF8.decode(bytes);
	const findings = await checkDesktopMigrations(
		[...files, { fileName, sql: gatedSql }],
		frozen,
	);
	if (findings.length > 0) {
		return { findings, status: "refused" };
	}
	// A build that started before this call can still become ready and freeze the earlier files
	// without this one. This run checks this file in that case too, so no later build refuses it.
	// LIMIT: the second run assumes that a build ships all earlier unfrozen files together. A build that froze only some of them is not checked. Upgrade: one run per unfrozen earlier file.
	const frozenVersions = new Set(frozen.map((row) => row.version));
	const unbuilt: ReleasedDesktopMigration[] = [];
	for (const file of files) {
		const parsed = parseDesktopMigrationFileName(file.fileName);
		if (parsed !== null && !frozenVersions.has(parsed.version)) {
			unbuilt.push({
				name: parsed.name,
				sha256: sha256OfMigration(file.sql),
				version: parsed.version,
			});
		}
	}
	if (unbuilt.length > 0) {
		const shippedFirst = await checkDesktopMigrations(
			[...files, { fileName, sql: gatedSql }],
			[...frozen, ...unbuilt],
		);
		if (shippedFirst.length > 0) {
			return {
				findings: shippedFirst.map((finding) =>
					desktopGateFinding(
						finding.rule,
						finding.path,
						`If a build ships the earlier migrations before this one: ${finding.message}`,
					),
				),
				status: "refused",
			};
		}
	}

	const path = `${DESKTOP_MIGRATIONS_DIR}/${fileName}`;
	// Outside the workspace, so a temporary file that stays after a crash never reaches a commit.
	const temporaryPath = `/tmp/wandit-migration-${randomUUID()}.sql`;
	// The gate checked the decoded text of these bytes. The app hashes these bytes.
	await sandbox.writeFiles([{ content: bytes, path: temporaryPath }]);
	const created = await runScript(sandbox, CREATE_SCRIPT, [
		temporaryPath,
		path,
	]);
	if (created.exitCode === NAME_TAKEN_EXIT_CODE) {
		return {
			message: `${path} already exists, and the host never overwrites a migration. Call the tool again.`,
			status: "failed",
		};
	}
	if (created.exitCode !== 0) {
		throw new Error(
			`The migration write failed (${created.exitCode}): ${created.stderr.slice(0, LOGGED_TEXT_MAX_CHARS)}`,
		);
	}
	return { file: path, status: "added", version };
}

// Runs one script of this file with bash in the project root.
function runScript(
	sandbox: Pick<SandboxHandle, "exec" | "workspaceDir">,
	script: string,
	args: string[],
): Promise<SandboxExecResult> {
	return sandbox.exec("bash", ["-c", script, "bash", ...args], {
		cwd: sandbox.workspaceDir,
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
}

// Reads the NUL-ended records of LIST_SCRIPT. A name can hold a tab or a newline, so only the
// first two tabs split a record. A record in another form throws: the listing is not trusted.
function parseListing(stdout: string): MigrationEntry[] {
	return stdout
		.split("\0")
		.slice(0, -1)
		.map((record) => {
			const match = /^([a-zA-Z])\t(\d+)\t([^/]+)$/.exec(record);
			if (match === null) {
				throw new Error(
					`The migrations listing has a record the host cannot read: ${JSON.stringify(record.slice(0, LOGGED_TEXT_MAX_CHARS))}`,
				);
			}
			const [, type = "", bytes = "", name = ""] = match;
			return { bytes: Number(bytes), name, type };
		});
}

// The size limits of the gate, on the sizes of the listing. The gate checks them again on the text.
function findOversizedEntries(entries: MigrationEntry[]): DesktopGateFinding[] {
	if (entries.length > DESKTOP_MIGRATIONS_MAX_COUNT) {
		return [
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The folder holds more than ${DESKTOP_MIGRATIONS_MAX_COUNT} entries. The limit is ${DESKTOP_MIGRATIONS_MAX_COUNT} files.`,
			),
		];
	}
	const findings = entries
		.filter((entry) => entry.bytes > DESKTOP_MIGRATION_MAX_BYTES)
		.map((entry) =>
			desktopGateFinding(
				"migration_too_large",
				`${DESKTOP_MIGRATIONS_DIR}/${entry.name}`,
				`The file has ${entry.bytes} bytes. The limit is ${DESKTOP_MIGRATION_MAX_BYTES}.`,
			),
		);
	const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
	if (totalBytes > DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES) {
		findings.push(
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The files have ${totalBytes} bytes in total. The limit is ${DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES}.`,
			),
		);
	}
	return findings;
}
