/**
 * The database of the browser preview: SQLite in WebAssembly (sql.js), saved in IndexedDB.
 * db.ts loads it with a dynamic import outside the Tauri shell, in `vite dev` only.
 * It runs migrations/*.sql with the ledger rules of the shell (docs/v2/desktop-apps.md, sections 5 and 7).
 * Then it answers db_select, db_execute, and db_batch with the shapes, limits, and error codes of section 4.
 * Its statement rules only approximate the shell, which checks each statement with an SQLite authorizer.
 */
import initSqlJs, {
	type Database,
	type SqlJsStatic,
	type SqlValue as SqlJsValue,
	type Statement,
	type StatementIterator,
} from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { z } from "zod";
import {
	DbError,
	type DbStatement,
	type SelectAnswer,
	type SqlParam,
	type SqlValue,
	type WriteResult,
} from "./db";

// The limits of the shell (section 4), with the same error codes.
const MAX_SQL_BYTES = 100_000;
const MAX_PARAMS = 999;
const MAX_BATCH_STATEMENTS = 500;
const MAX_SELECT_ROWS = 10_000;

/**
 * The ledger of the shell, created on every open (section 5). The text is equal to CREATE_LEDGER_SQL
 * in src-tauri/src/db.rs of the shell. No trailing ";": prepareConnection runs it last.
 * Status `applied`: the file ran. `replaced`: its newest replacement ran in its place.
 * `skipped`: a replacement that did not run.
 */
const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS wandit_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'replaced', 'skipped')),
  recorded_at TEXT NOT NULL,
  app_version TEXT NOT NULL
)`;

/** The `app_version` of the ledger rows that the preview writes. The shell writes its own version. */
const PREVIEW_APP_VERSION = "preview";

/** Equal to DESKTOP_MIGRATION_FILE_PATTERN of packages/contracts. The template cannot import that package. */
const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z][a-z0-9_]{0,59})\.sql$/;

/** Equal to DESKTOP_MIGRATION_REPLACES_PATTERN of packages/contracts: line 1 of a replacement migration. */
const MIGRATION_REPLACES_PATTERN = /^-- wandit:replaces (\d{4})\n/;

/** The longest part of a check text in an error, in characters. The shell and the gate cut at the same length. */
const MAX_CHECK_TEXT_CHARS = 200;
/** The longest part of a TEXT answer of a check in an error, in characters. */
const MAX_SHOWN_TEXT_CHARS = 50;

/** The text of each file of migrations/, keyed by "/migrations/<file name>". Vite reads them at dev time. */
const MIGRATION_TEXTS = import.meta.glob<string>("/migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

// A new or changed migration file updates this module. A full reload opens the database again with it,
// so no page keeps a query result of the old schema.
import.meta.hot?.accept(() => {
	window.location.reload();
});

// The first keyword of each statement kind that a call accepts. The shell decides with its authorizer:
// db_select needs a read-only statement, db_execute and db_batch accept INSERT, UPDATE, DELETE, and SELECT.
// LIMIT: these text checks only approximate the shell. These are the known differences:
// "WITH ... DELETE" passes db_select here. The shell refuses it.
// A missing `?` value binds NULL here, and an extra value gives sql_error. The shell gives invalid_input for both.
// In execute and batch, a WITH or a write that names an sqlite_ table is refused here, also in a string.
// The shell refuses only a write to that table.
// Upgrade: check sqlite3_stmt_readonly, sqlite3_bind_parameter_count, and an authorizer through a custom sql.js build.
const READ_KEYWORDS = new Set(["SELECT", "WITH", "VALUES"]);
const WRITE_KEYWORDS = new Set([
	...READ_KEYWORDS,
	"INSERT",
	"REPLACE",
	"UPDATE",
	"DELETE",
]);

// The shell refuses a write to its ledger and to the sqlite_ tables. The preview checks the SQL text (see the LIMIT above).
const PROTECTED_TABLE = /\b(?:wandit_migrations|sqlite_\w+)\b/i;

/** The IndexedDB database and object store that hold the bytes of the preview database. */
const STORAGE_NAME = "wandit-preview-db";
const STORAGE_STORE = "databases";

/** What line 1 of a migration says. A copy of DesktopMigrationHeader of packages/contracts. */
type MigrationHeader =
	| { kind: "plain" }
	// `version` is the version of the file that this file replaces.
	| { kind: "replaces"; version: number }
	// A bad `-- wandit:` line. The gate refuses such a file, so a build never holds one.
	| { kind: "invalid" };

/** One file of migrations/, as the shell embeds it. `sha256` is the hex digest of its UTF-8 text. */
type MigrationFile = {
	version: number;
	name: string;
	fileName: string;
	sql: string;
	sha256: string;
	/** Line 1 of `sql`, read with the rules of parseMigrationHeader. */
	header: MigrationHeader;
};

/** The status of a ledger row (see LEDGER_SQL). */
type LedgerStatus = "applied" | "replaced" | "skipped";

/** The open database. `storage` is null when IndexedDB is blocked: the data then stays in memory only. */
type PreviewDatabase = { db: Database; storage: IDBDatabase | null };

let previewDatabase: Promise<PreviewDatabase> | undefined;

/**
 * Opens and migrates the database on the first call. A failed open stays failed until a reload,
 * like the migration_failed state of the shell: every command then answers migration_failed.
 */
function getPreviewDatabase(): Promise<PreviewDatabase> {
	previewDatabase ??= openPreviewDatabase().catch((error: unknown) => {
		throw error instanceof DbError
			? error
			: new DbError(
					"migration_failed",
					`The preview database did not open: ${errorText(error)}`,
				);
	});
	return previewDatabase;
}

/** Same arguments and answer as the db_select command of the shell. */
export async function dbSelect({
	sql,
	params = [],
}: DbStatement): Promise<SelectAnswer> {
	const { db } = await getPreviewDatabase();
	checkStatement(sql, params, READ_KEYWORDS);
	try {
		return runSelect(db, sql, params.map(toSqlJsValue));
	} catch (error: unknown) {
		throw toDbError(error);
	}
}

/** Same arguments and answer as the db_execute command of the shell. */
export async function dbExecute({
	sql,
	params = [],
}: DbStatement): Promise<WriteResult> {
	const preview = await getPreviewDatabase();
	checkStatement(sql, params, WRITE_KEYWORDS);
	const totalBefore = totalChanges(preview.db);
	let result: WriteResult;
	try {
		result = runWrite(preview.db, sql, params.map(toSqlJsValue));
	} catch (error: unknown) {
		throw toDbError(error);
	}
	// Not `changes`: a write through an INSTEAD OF trigger on a view answers 0 changes but writes rows.
	if (totalChanges(preview.db) !== totalBefore) {
		await saveDatabase(preview);
	}
	return result;
}

/** Same arguments and answer as the db_batch command of the shell: one transaction, all or none. */
export async function dbBatch(
	statements: DbStatement[],
): Promise<WriteResult[]> {
	const preview = await getPreviewDatabase();
	if (statements.length > MAX_BATCH_STATEMENTS) {
		throw new DbError(
			"invalid_input",
			`A batch holds at most ${MAX_BATCH_STATEMENTS} statements, not ${statements.length}.`,
		);
	}
	// Every statement passes the checks before the first one runs.
	for (const { sql, params = [] } of statements) {
		checkStatement(sql, params, WRITE_KEYWORDS);
	}
	const totalBefore = totalChanges(preview.db);
	let results: WriteResult[];
	try {
		preview.db.exec("BEGIN");
		try {
			results = statements.map(({ sql, params = [] }) =>
				runWrite(preview.db, sql, params.map(toSqlJsValue)),
			);
			preview.db.exec("COMMIT");
		} catch (error: unknown) {
			rollBack(preview.db);
			throw error;
		}
	} catch (error: unknown) {
		throw toDbError(error);
	}
	// The same rule as dbExecute: a trigger can write rows that `changes` does not count.
	if (totalChanges(preview.db) !== totalBefore) {
		await saveDatabase(preview);
	}
	return results;
}

/**
 * Loads sql.js, the stored bytes, and the migration files. Then it runs the pending files.
 * The stored bytes change only after every pending file ran: they are the backup of section 5, step 7.
 */
async function openPreviewDatabase(): Promise<PreviewDatabase> {
	const [sqlJs, storage, migrations] = await Promise.all([
		initSqlJs({ locateFile: () => wasmUrl }),
		openStorage(),
		readMigrationFiles(),
	]);
	const storedBytes = storage === null ? null : await readStoredBytes(storage);
	// Bytes that IndexedDB cannot read are left alone: the data then stays in memory only.
	const writableStorage = storedBytes === "unreadable" ? null : storage;
	const stored =
		storedBytes === null || storedBytes === "unreadable"
			? null
			: openStoredDatabase(sqlJs, storedBytes, migrations);
	if (stored?.kind === "ready") {
		const preview = { db: stored.db, storage: writableStorage };
		if (stored.ranPending) {
			await saveDatabase(preview);
		}
		return preview;
	}
	// The desktop app stops with migration_failed in this case and keeps the user data.
	// The preview holds test data only, so it starts again from empty.
	if (stored?.kind === "restart") {
		console.warn(
			`wandit preview: ${stored.reason} The preview database starts again from empty.`,
		);
	}
	const db = new sqlJs.Database();
	prepareConnection(db);
	try {
		runPendingMigrations(db, migrations, migrations);
	} catch (error: unknown) {
		// The preview bridge sends console.error to the builder, so the agent reads the SQLite text.
		console.error(`wandit preview: ${errorText(error)}`);
		throw error;
	}
	// This save also replaces stored bytes that caused a restart.
	const preview = { db, storage: writableStorage };
	await saveDatabase(preview);
	return preview;
}

/** The result of an open of the stored bytes: a migrated database, or the reason to start again. */
type StoredOpen =
	| {
			kind: "ready";
			db: Database;
			/** True when a pending file ran, so the stored bytes are old. */
			ranPending: boolean;
	  }
	| { kind: "restart"; reason: string };

/** Opens the stored bytes, applies the ledger rules of section 5, steps 3 and 4, and runs the pending files. */
function openStoredDatabase(
	sqlJs: SqlJsStatic,
	bytes: Uint8Array,
	migrations: MigrationFile[],
): StoredOpen {
	const db = new sqlJs.Database(bytes);
	let ledger: Map<number, string>;
	try {
		prepareConnection(db);
		ledger = readLedger(db);
	} catch (error: unknown) {
		db.close();
		return {
			kind: "restart",
			reason: `The stored preview database does not open (${errorText(error)}).`,
		};
	}
	const reason = findLedgerConflict(ledger, migrations);
	if (reason !== null) {
		db.close();
		return { kind: "restart", reason };
	}
	const pending = migrations.filter(
		(migration) => !ledger.has(migration.version),
	);
	try {
		runPendingMigrations(db, pending, migrations);
	} catch (error: unknown) {
		// The agent cannot edit or delete the failed file, and a fix migration runs only after it.
		// So a file that fails only on the test rows of the preview restarts the preview from empty.
		return {
			kind: "restart",
			reason: `${errorText(error)} (on the stored preview rows).`,
		};
	}
	return { kind: "ready", db, ranPending: pending.length > 0 };
}

/**
 * Answers why the ledger and the files disagree, or null. Ledger rows above every file are fine:
 * that is a rollback to an older build (section 5, step 4).
 */
function findLedgerConflict(
	ledger: Map<number, string>,
	migrations: MigrationFile[],
): string | null {
	const highestRun = Math.max(0, ...ledger.keys());
	for (const migration of migrations) {
		const ranSha256 = ledger.get(migration.version);
		if (ranSha256 !== undefined && ranSha256 !== migration.sha256) {
			return `migrations/${migration.fileName} changed after the preview ran it.`;
		}
		if (ranSha256 === undefined && migration.version < highestRun) {
			return `migrations/${migration.fileName} is older than version ${highestRun}, which the preview already ran.`;
		}
	}
	return null;
}

/**
 * Runs the pending files and their ledger rows in one transaction (section 5, steps 6 to 10), as the shell.
 * `migrations` is the full file list: it holds the replacements of each target.
 * Throws migration_failed with the texts of the shell, after it closes `db`.
 */
function runPendingMigrations(
	db: Database,
	pending: MigrationFile[],
	migrations: MigrationFile[],
) {
	// A stored database with nothing pending opens, also with a bad replacement group, as in the shell.
	if (pending.length === 0) {
		return;
	}
	try {
		checkReplacementGroups(migrations);
		runInOneTransaction(db, pending, migrations);
	} catch (error: unknown) {
		// No rollback: the in-memory copy is dropped, and the stored bytes are still the state before this open.
		db.close();
		throw new DbError("migration_failed", errorText(error));
	}
}

/** Step 6 of section 5: checks line 1 of every file and the target of each replacement. Throws the shell text. */
function checkReplacementGroups(migrations: MigrationFile[]) {
	const invalid = migrations.find((file) => file.header.kind === "invalid");
	if (invalid !== undefined) {
		throw new Error(
			`migrations/${invalid.fileName} has a bad "-- wandit:" line. Only line 1 may hold "-- wandit:replaces NNNN".`,
		);
	}
	for (const { version, header } of migrations) {
		if (header.kind !== "replaces") {
			continue;
		}
		const target = migrations.find((file) => file.version === header.version);
		const replaces = `Migration ${version} replaces migration ${header.version}`;
		if (target === undefined) {
			throw new Error(`${replaces}, which this build does not hold.`);
		}
		// Step 9 runs a replacement at the place of its target, so the target comes first.
		if (header.version >= version) {
			throw new Error(`${replaces}, which is not an earlier version.`);
		}
		// Step 9 looks for the replacements of a plain file only. A chain never runs.
		if (target.header.kind !== "plain") {
			throw new Error(`${replaces}, which replaces another migration.`);
		}
	}
}

/**
 * Steps 8 to 10 of section 5. `pending` is in version order. A target runs its newest replacement
 * in its place, and every file gets exactly one ledger row. Throws the shell text.
 */
function runInOneTransaction(
	db: Database,
	pending: MigrationFile[],
	migrations: MigrationFile[],
) {
	try {
		db.exec("BEGIN IMMEDIATE");
	} catch (error: unknown) {
		throw new Error(
			`The migration transaction did not start: ${errorText(error)}`,
		);
	}
	const recorded = new Set<number>();
	const record = (file: MigrationFile, status: LedgerStatus) => {
		try {
			db.run(
				"INSERT INTO wandit_migrations (version, name, sha256, status, recorded_at, app_version) VALUES (?, ?, ?, ?, ?, ?)",
				[
					file.version,
					file.name,
					file.sha256,
					status,
					new Date().toISOString(),
					PREVIEW_APP_VERSION,
				],
			);
		} catch (error: unknown) {
			throw new Error(
				`migrations/${file.fileName} failed: The ledger row could not be written: ${errorText(error)}`,
			);
		}
		recorded.add(file.version);
	};
	for (const file of pending) {
		if (recorded.has(file.version)) {
			continue;
		}
		// Its target is in the ledger from an earlier open, so the target ran already.
		if (file.header.kind === "replaces") {
			record(file, "skipped");
			continue;
		}
		const alternatives = migrations.filter(
			({ header }) =>
				header.kind === "replaces" && header.version === file.version,
		);
		const newest = alternatives.at(-1);
		if (newest === undefined) {
			runFile(db, file);
			record(file, "applied");
			continue;
		}
		runFile(db, newest);
		record(file, "replaced");
		for (const alternative of alternatives) {
			record(alternative, alternative === newest ? "applied" : "skipped");
		}
	}
	try {
		db.exec("COMMIT");
	} catch (error: unknown) {
		throw new Error(`The migrations did not commit: ${errorText(error)}`);
	}
}

/**
 * Runs the statements of one file in order. A SELECT is a check: it must answer one row
 * with the integer 1. Statements count from 1, as in the shell and the gate. Throws the shell text.
 */
function runFile(db: Database, file: MigrationFile) {
	const failed = (reason: string) =>
		new Error(`migrations/${file.fileName} failed: ${reason}`);
	// @types/sql.js omits return(), which sql.js has. The Iterator type of the same object declares it.
	const statements: Iterator<Statement> & StatementIterator =
		db.iterateStatements(file.sql);
	let number = 0;
	try {
		for (;;) {
			let next: IteratorResult<Statement>;
			try {
				next = statements.next();
			} catch (error: unknown) {
				// A statement that does not prepare comes after the last one that ran.
				throw failed(`Statement ${number + 1}: ${errorText(error)}`);
			}
			if (next.done) {
				return;
			}
			number += 1;
			const statement = next.value;
			let reason: string | null = null;
			try {
				if (firstKeyword(statement.getSQL()) === "SELECT") {
					reason = checkFailure(statement);
				} else {
					statement.run();
				}
			} catch (error: unknown) {
				throw failed(`Statement ${number}: ${errorText(error)}`);
			}
			if (reason !== null) {
				const text = Array.from(statement.getSQL().trim())
					.slice(0, MAX_CHECK_TEXT_CHARS)
					.join("");
				throw failed(`Statement ${number} is a check that ${reason}: ${text}`);
			}
		}
	} finally {
		// Frees the statement and the SQL copy in the WebAssembly memory.
		statements.return?.();
	}
}

/** Answers why a check failed, or null when it answered one row with the integer 1. Same order as the shell. */
function checkFailure(statement: Statement): string | null {
	const columns = statement.getColumnNames().length;
	if (columns !== 1) {
		return `answered ${columns} columns, not 1`;
	}
	if (!statement.step()) {
		return "answered no row";
	}
	const value = readRowWithBigInt(statement)[0] ?? null;
	if (statement.step()) {
		return "answered more than one row";
	}
	return value === 1n
		? null
		: `answered ${shownValue(value)}, not the integer 1`;
}

/** The current row with each INTEGER as a bigint, so the integer 1 and the REAL 1.0 stay apart. */
function readRowWithBigInt(statement: Statement): Array<SqlJsValue | bigint> {
	// SAFETY: sql.js 1.15.2 Statement.get(params, config) reads config.useBigInt; @types/sql.js 1.4.11 omits the argument.
	const get = statement.get as (
		this: Statement,
		params: null,
		config: { useBigInt: boolean },
	) => Array<SqlJsValue | bigint>;
	// A null params argument does not step, so this reads the row of the last step().
	return get.call(statement, null, { useBigInt: true });
}

/** A check answer as the shell shows it: NULL, an integer, `<number> (REAL)`, `'<text>'`, or `a BLOB`. */
function shownValue(value: SqlJsValue | bigint): string {
	if (value === null) {
		return "NULL";
	}
	if (typeof value === "bigint") {
		return String(value);
	}
	if (typeof value === "number") {
		return `${value} (REAL)`;
	}
	if (typeof value === "string") {
		// Array.from counts code points, as the shell counts Rust chars.
		return `'${Array.from(value).slice(0, MAX_SHOWN_TEXT_CHARS).join("")}'`;
	}
	return "a BLOB";
}

/** Applies the connection settings of the shell (section 5) and creates the ledger. */
function prepareConnection(db: Database) {
	// The shell opens its file with these two values, so a preview statement fails where the app fails.
	db.exec(
		`PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF; ${LEDGER_SQL}`,
	);
}

const ledgerRowSchema = z.tuple([z.number().int(), z.string()]);

/** The SHA-256 of each version in the ledger. The stored bytes come from IndexedDB, so each row is parsed. */
function readLedger(db: Database): Map<number, string> {
	const [result] = db.exec("SELECT version, sha256 FROM wandit_migrations");
	return new Map(
		(result?.values ?? []).map((row) => ledgerRowSchema.parse(row)),
	);
}

/** Reads, names, and hashes the migration files, in version order. A bad name stops the open. */
async function readMigrationFiles(): Promise<MigrationFile[]> {
	const files = await Promise.all(
		Object.entries(MIGRATION_TEXTS).map(async ([path, sql]) => {
			const fileName = path.slice(path.lastIndexOf("/") + 1);
			const match = MIGRATION_FILE_PATTERN.exec(fileName);
			const version = Number(match?.[1] ?? 0);
			const name = match?.[2];
			if (name === undefined || version === 0) {
				throw new DbError(
					"migration_failed",
					`migrations/${fileName} has a bad name. The pattern is 0001_snake_name.sql.`,
				);
			}
			return {
				version,
				name,
				fileName,
				sql,
				sha256: await sha256Hex(sql),
				header: parseMigrationHeader(sql),
			};
		}),
	);
	files.sort((first, second) => first.version - second.version);
	files.forEach((file, index) => {
		if (index > 0 && files[index - 1]?.version === file.version) {
			throw new DbError(
				"migration_failed",
				`Two migration files have the version ${file.version}.`,
			);
		}
	});
	return files;
}

/**
 * Reads line 1 of a migration (section 5). Only line 1 may hold a `-- wandit:` line, and only as
 * `-- wandit:replaces NNNN` with an LF. A bad line gives `invalid`, which the runner refuses.
 * Equal to parseDesktopMigrationHeader of packages/contracts. The template cannot import that package.
 */
function parseMigrationHeader(sql: string): MigrationHeader {
	const match = MIGRATION_REPLACES_PATTERN.exec(sql);
	const rest = match === null ? sql : sql.slice(match[0].length);
	if (rest.split("\n").some((line) => line.startsWith("-- wandit:"))) {
		return { kind: "invalid" };
	}
	if (match === null) {
		return { kind: "plain" };
	}
	const version = Number(match[1]);
	return version === 0 ? { kind: "invalid" } : { kind: "replaces", version };
}

/** The hex SHA-256 of the UTF-8 bytes of a text, as the shell hashes each embedded file. */
async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

/** Checks the limits of one statement and its kind by the first keyword. */
function checkStatement(
	sql: string,
	params: SqlParam[],
	allowedKeywords: ReadonlySet<string>,
) {
	if (new TextEncoder().encode(sql).length > MAX_SQL_BYTES) {
		throw new DbError(
			"invalid_input",
			`The SQL text has more than ${MAX_SQL_BYTES} bytes.`,
		);
	}
	if (params.length > MAX_PARAMS) {
		throw new DbError(
			"invalid_input",
			`A statement takes at most ${MAX_PARAMS} parameters, not ${params.length}.`,
		);
	}
	// The shell answers these two cases before its authorizer runs: SQLite prepares nothing, or fails to parse.
	if (skipBlank(sql) === sql.length) {
		throw new DbError("invalid_input", "The SQL text holds no statement.");
	}
	const keyword = firstKeyword(sql);
	if (keyword === "") {
		throw new DbError(
			"sql_error",
			"The SQL text does not start with a keyword.",
		);
	}
	if (!allowedKeywords.has(keyword)) {
		throw new DbError(
			"statement_refused",
			`${keyword} statements are not allowed in this call. A schema change needs a migration.`,
		);
	}
	const isWrite = keyword !== "SELECT" && keyword !== "VALUES";
	if (
		allowedKeywords === WRITE_KEYWORDS &&
		isWrite &&
		PROTECTED_TABLE.test(sql)
	) {
		throw new DbError(
			"statement_refused",
			"The app may not write to wandit_migrations or to an sqlite_ table.",
		);
	}
}

/** The first word of the SQL after spaces, comments, and semicolons, in upper case. "" when there is none. */
function firstKeyword(sql: string): string {
	return /^[A-Za-z]+/.exec(sql.slice(skipBlank(sql)))?.[0].toUpperCase() ?? "";
}

/**
 * The index of the first character that is not a space, a semicolon, or inside an SQL comment.
 * A loop, not a regex: a regex with nested repeats can take exponential time on a long comment.
 */
function skipBlank(sql: string): number {
	let index = 0;
	while (index < sql.length) {
		if (/[\s;]/.test(sql.charAt(index))) {
			index += 1;
		} else if (sql.startsWith("--", index)) {
			const lineEnd = sql.indexOf("\n", index);
			index = lineEnd === -1 ? sql.length : lineEnd + 1;
		} else if (sql.startsWith("/*", index)) {
			// SQLite reads an open comment to the end of the text.
			const commentEnd = sql.indexOf("*/", index + 2);
			index = commentEnd === -1 ? sql.length : commentEnd + 2;
		} else {
			return index;
		}
	}
	return index;
}

/**
 * Prepares the one statement of `sql` and gives it to `use`. Text after it other than spaces,
 * comments, and semicolons is a second statement: invalid_input.
 */
function withOneStatement<Result extends SelectAnswer | WriteResult>(
	db: Database,
	sql: string,
	use: (statement: Statement) => Result,
): Result {
	// @types/sql.js omits return(), which sql.js has. The Iterator type of the same object declares it.
	const statements: Iterator<Statement> & StatementIterator =
		db.iterateStatements(sql);
	try {
		const first = statements.next();
		if (first.done) {
			throw new DbError("invalid_input", "The SQL text holds no statement.");
		}
		const rest = statements.getRemainingSQL();
		if (skipBlank(rest) < rest.length) {
			throw new DbError(
				"invalid_input",
				"Send one statement per call. Use batch for several writes.",
			);
		}
		return use(first.value);
	} finally {
		// Frees the statement and the SQL copy in the WebAssembly memory.
		statements.return?.();
	}
}

function runSelect(
	db: Database,
	sql: string,
	params: SqlJsValue[],
): SelectAnswer {
	return withOneStatement(db, sql, (statement) => {
		statement.bind(params);
		const rows: SqlValue[][] = [];
		while (statement.step()) {
			if (rows.length === MAX_SELECT_ROWS) {
				throw new DbError(
					"too_many_rows",
					`The select answered more than ${MAX_SELECT_ROWS} rows. Add a WHERE or a LIMIT.`,
				);
			}
			rows.push(statement.get().map(toSqlValue));
		}
		return { columns: statement.getColumnNames(), rows };
	});
}

function runWrite(
	db: Database,
	sql: string,
	params: SqlJsValue[],
): WriteResult {
	const changesBefore = totalChanges(db);
	return withOneStatement(db, sql, (statement) => {
		// One step does every change, also for INSERT ... RETURNING. The rows it answers are not read.
		statement.run(params);
		// sqlite3_changes keeps the count of an older write after a SELECT. total_changes shows if this one wrote.
		const changes =
			totalChanges(db) === changesBefore ? 0 : db.getRowsModified();
		return {
			changes,
			lastInsertRowId: readNumber(db, "SELECT last_insert_rowid()"),
		};
	});
}

function readNumber(db: Database, sql: string): number {
	return z.number().parse(db.exec(sql)[0]?.values[0]?.[0]);
}

/** The rows that every write of this connection changed, triggers included. It grows only. */
function totalChanges(db: Database): number {
	return readNumber(db, "SELECT total_changes()");
}

/** Converts a parameter for sql.js. The shell also stores true as 1 and false as 0. */
function toSqlJsValue(param: SqlParam): SqlJsValue {
	if (param === true) {
		return 1;
	}
	if (param === false) {
		return 0;
	}
	return param;
}

/** Converts one sql.js column value. A BLOB or a number that is not finite has no JSON form in the shell. */
function toSqlValue(value: SqlJsValue): SqlValue {
	if (value instanceof Uint8Array) {
		throw new DbError(
			"unsupported_value",
			"A column holds a BLOB. Store text or numbers.",
		);
	}
	if (typeof value === "number" && !Number.isFinite(value)) {
		throw new DbError(
			"unsupported_value",
			`A column holds the number ${value}. Only finite numbers are supported.`,
		);
	}
	return value;
}

/** Ends the open batch transaction after a failed statement. */
function rollBack(db: Database) {
	try {
		db.exec("ROLLBACK");
	} catch (error: unknown) {
		// SQLite ends the transaction by itself after some errors, for example out of memory.
		console.warn(
			"wandit preview: the batch transaction had already ended.",
			error,
		);
	}
}

/** A DbError stays as it is. A sql.js error is the SQLite refusal of the statement. */
function toDbError(error: unknown): DbError {
	return error instanceof DbError
		? error
		: new DbError("sql_error", errorText(error));
}

/** sql.js throws an Error for an SQLite failure and a plain string for an API misuse. */
function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Opens the IndexedDB database. Null when storage is blocked, for example in a private window. */
async function openStorage(): Promise<IDBDatabase | null> {
	try {
		return await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(STORAGE_NAME, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(STORAGE_STORE);
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} catch (error: unknown) {
		console.warn(
			"wandit preview: IndexedDB is not available. The preview data stays in memory until a reload.",
			error,
		);
		return null;
	}
}

/** One stored database per preview host. Each project preview has its own host. */
function storageKey(): string {
	return `${STORAGE_NAME}:${window.location.host}`;
}

/** The stored bytes, null before the first save, or "unreadable" when IndexedDB refuses the read. */
async function readStoredBytes(
	storage: IDBDatabase,
): Promise<Uint8Array | null | "unreadable"> {
	try {
		const stored = await new Promise<unknown>((resolve, reject) => {
			const request = storage
				.transaction(STORAGE_STORE)
				.objectStore(STORAGE_STORE)
				.get(storageKey());
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		return stored instanceof Uint8Array ? stored : null;
	} catch (error: unknown) {
		console.warn(
			"wandit preview: the stored preview data does not read. The preview data stays in memory until a reload.",
			error,
		);
		return "unreadable";
	}
}

// LIMIT: each write saves the whole database file, about 1 ms per MB of preview data.
// Upgrade: save once per idle callback.
async function saveDatabase({ db, storage }: PreviewDatabase): Promise<void> {
	if (storage === null) {
		return;
	}
	const bytes = db.export();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = storage.transaction(STORAGE_STORE, "readwrite");
			transaction.objectStore(STORAGE_STORE).put(bytes, storageKey());
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} catch (error: unknown) {
		// The write is done in memory. Only the copy for the next reload is missing.
		console.warn(
			"wandit preview: the preview data was not saved. It stays in memory until a reload.",
			error,
		);
	}
}
