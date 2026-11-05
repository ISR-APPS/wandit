/**
 * The only data API of the app: SQL on the local SQLite database (docs/v2/desktop-apps.md, section 4).
 * The api/ files of the features call select, execute, and batch. No other file reads or writes data.
 * In the desktop app it calls the db_* commands of the Tauri shell with invoke.
 * In the browser preview (`vite dev`) it loads preview-db.ts, a sql.js copy of the database.
 */
import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { z } from "zod";

/** One column value. The database has no BLOB support. */
export type SqlValue = string | number | null;

/** One `?` parameter. The database stores true as 1 and false as 0. */
export type SqlParam = SqlValue | boolean;

/** One statement of a batch. `params` fill the `?` marks in order. */
export type DbStatement = { sql: string; params?: SqlParam[] };

/** The answer of db_select: the column names, then one value array per row, in the column order. */
export type SelectAnswer = { columns: string[]; rows: SqlValue[][] };

/** The answer of one write. `lastInsertRowId` is the rowid of the last INSERT on the connection. */
export type WriteResult = { changes: number; lastInsertRowId: number };

const DB_ERROR_CODES = [
	// The database did not open or migrate at start. The app shows its error screen.
	"migration_failed",
	// The statement kind is not allowed for this call, for example CREATE or PRAGMA.
	"statement_refused",
	// SQLite refused the statement. The message is the SQLite text.
	"sql_error",
	// A select answered more than 10,000 rows.
	"too_many_rows",
	// A BLOB column, or a number that is not finite.
	"unsupported_value",
	// A limit is broken: the SQL size, the parameter count, one statement per call, or the batch size.
	"invalid_input",
] as const;

/** Why a database call failed. The desktop shell and the preview answer the same codes. */
export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

/** A failed database call. Read `code` to choose the error state; `message` is for logs. */
export class DbError extends Error {
	readonly code: DbErrorCode;

	constructor(code: DbErrorCode, message: string) {
		super(message);
		this.name = "DbError";
		this.code = code;
	}
}

const sqlValueSchema = z.union([z.string(), z.number(), z.null()]);

const selectAnswerSchema = z.object({
	columns: z.array(z.string()),
	rows: z.array(z.array(sqlValueSchema)),
}) satisfies z.ZodType<SelectAnswer>;

const writeResultSchema = z.object({
	changes: z.number(),
	lastInsertRowId: z.number(),
}) satisfies z.ZodType<WriteResult>;

const batchAnswerSchema = z.object({ results: z.array(writeResultSchema) });

/** The rejection of a shell command. */
const dbFailureSchema = z.object({
	code: z.enum(DB_ERROR_CODES),
	message: z.string(),
});

/** The data commands of the shell. Its capability file grants these three and app_info, nothing else. */
type DbCommand = "db_select" | "db_execute" | "db_batch";

// The Tauri shell injects this global into its webview. The browser preview has none.
const isDesktopShell = "__TAURI_INTERNALS__" in window;

let previewDb: Promise<typeof import("./preview-db")> | undefined;

/** The preview driver, loaded on the first call. A failed load is not kept, so the next call tries again. */
function loadPreviewDb(): Promise<typeof import("./preview-db")> {
	// `vite build` sets DEV to false and drops this import, so sql.js and its wasm file
	// never enter the desktop installer.
	previewDb ??= import.meta.env.DEV
		? import("./preview-db").catch((error: unknown) => {
				previewDb = undefined;
				throw new DbError(
					"migration_failed",
					`The preview database did not load: ${String(error)}`,
				);
			})
		: Promise.reject(
				new DbError(
					"migration_failed",
					"This build has a database only inside the desktop app.",
				),
			);
	return previewDb;
}

/**
 * Runs one SELECT and answers one object per row, keyed by column name.
 * Give each column its own name with AS: two columns with one name keep the last value.
 */
export async function select<Row extends Record<string, SqlValue>>(
	sql: string,
	params: SqlParam[] = [],
): Promise<Row[]> {
	checkParams(params, "The statement");
	const { columns, rows } = isDesktopShell
		? await invokeCommand("db_select", { sql, params }, selectAnswerSchema)
		: await (await loadPreviewDb()).dbSelect({ sql, params });
	return rows.map((values) => {
		// fromEntries defines own keys, so a column named __proto__ cannot change the prototype.
		const row = Object.fromEntries(
			columns.map((column, index) => [column, values[index] ?? null]),
		);
		// SAFETY: the caller names the columns of its own SQL in Row. No runtime check can see that type.
		return row as Row;
	});
}

/** Runs one INSERT, UPDATE, or DELETE (a SELECT also runs). Answers the changed row count. */
export async function execute(
	sql: string,
	params: SqlParam[] = [],
): Promise<WriteResult> {
	checkParams(params, "The statement");
	if (isDesktopShell) {
		return invokeCommand("db_execute", { sql, params }, writeResultSchema);
	}
	return (await loadPreviewDb()).dbExecute({ sql, params });
}

/**
 * Runs up to 500 write statements in one transaction: all of them, or none.
 * Answers one result per statement, in order.
 */
export async function batch(statements: DbStatement[]): Promise<WriteResult[]> {
	const filled = statements.map(({ sql, params = [] }, index) => {
		checkParams(params, `Statement ${index + 1}`);
		return { sql, params };
	});
	if (isDesktopShell) {
		const answer = await invokeCommand(
			"db_batch",
			{ statements: filled },
			batchAnswerSchema,
		);
		return answer.results;
	}
	return (await loadPreviewDb()).dbBatch(filled);
}

// invoke sends JSON, and JSON writes NaN and Infinity as null. So the check runs here, before the call.
function checkParams(params: SqlParam[], owner: string) {
	params.forEach((param, index) => {
		if (typeof param === "number" && !Number.isFinite(param)) {
			throw new DbError(
				"unsupported_value",
				`${owner}: parameter ${index + 1} is ${param}. A number must be finite.`,
			);
		}
	});
}

/** Calls one shell command and checks the shape of its answer. */
async function invokeCommand<Schema extends z.ZodType>(
	command: DbCommand,
	args: InvokeArgs,
	answerSchema: Schema,
): Promise<z.output<Schema>> {
	let answer: unknown;
	try {
		answer = await invoke(command, args);
	} catch (error: unknown) {
		throw toCommandError(command, error);
	}
	const parsed = answerSchema.safeParse(answer);
	if (!parsed.success) {
		throw new Error(
			`The desktop shell answered ${command} with a wrong shape: ${z.prettifyError(parsed.error)}`,
		);
	}
	return parsed.data;
}

/**
 * The Rust commands reject with { code, message }, which becomes a DbError.
 * Tauri itself rejects with a text, for example when a capability refuses the command.
 */
function toCommandError(command: DbCommand, error: unknown): Error {
	const failure = dbFailureSchema.safeParse(error);
	if (failure.success) {
		return new DbError(failure.data.code, failure.data.message);
	}
	return new Error(`The desktop command ${command} failed: ${String(error)}`, {
		cause: error,
	});
}
