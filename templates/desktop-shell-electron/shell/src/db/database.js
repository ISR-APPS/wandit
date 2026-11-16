/**
 * Local SQLite database of a desktop app (docs/v2/desktop-apps.md, sections 4 and 5).
 * It opens the file with the safety settings, runs the migration runner, and holds the
 * statement rules and the bodies of the 4 commands of the page.
 * app-database.js and backup.js call it. It calls node:sqlite, which has no network.
 * It is a port of db.rs of the Tauri shell. A comment marks each place where node:sqlite
 * lacks an API of rusqlite.
 */

const fs = require("node:fs");
const { DatabaseSync, constants } = require("node:sqlite");
const { DbError, toDbError } = require("./db-error.js");
const { fileName, readReplacementTargets } = require("./migration-files.js");
const { splitStatements } = require("./sql-scan.js");

/** @typedef {import("./migration-files.js").Migration} Migration */
/** @typedef {import("./sql-scan.js").ScannedStatement} ScannedStatement */
/** @typedef {string | number | boolean | null} SqlParam One param of the page: true is 1, false is 0. */
/** @typedef {string | number | null} SqlValue One value of a result row. A number is always finite. */
/** @typedef {{ changes: number, lastInsertRowId: number }} ExecuteAnswer */

/** Largest `sql` text of one statement, in UTF-8 bytes. */
const MAX_SQL_BYTES = 100_000;
/** Most params of one statement. */
const MAX_PARAMS = 999;
/** Most statements of one `db_batch` call. */
const MAX_BATCH_STATEMENTS = 500;
/** Most rows of one `db_select` answer. A larger result needs LIMIT and OFFSET in the app. */
const MAX_SELECT_ROWS = 10_000;
/** Section 5 sets 5 s. A backup copy reads the file while a command waits. */
const BUSY_TIMEOUT_MS = 5000;
/** The longest part of a check text in an error, in characters. */
const MAX_CHECK_TEXT_CHARS = 200;
/** The longest part of a TEXT answer of a check in an error, in characters. */
const MAX_SHOWN_TEXT_CHARS = 50;

/**
 * The ledger of the migration runner (section 5). Never change this text.
 * The import check compares the `sqlite_schema` text of an exported file with a fresh database.
 * `CREATE_LEDGER_SQL` in db.rs of the Tauri shell and `LEDGER_SQL` in `src/lib/preview-db.ts`
 * of the template hold the same bytes, so one export opens in both shells.
 */
const CREATE_LEDGER_SQL = `CREATE TABLE IF NOT EXISTS wandit_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'replaced', 'skipped')),
  recorded_at TEXT NOT NULL,
  app_version TEXT NOT NULL
)`;

// Authorizer actions of a statement that only reads. PRAGMA and transaction statements count
// as reads, as `sqlite3_stmt_readonly` of SQLite counts them.
const READ_ACTIONS = new Set([
	constants.SQLITE_SELECT,
	constants.SQLITE_READ,
	constants.SQLITE_FUNCTION,
	constants.SQLITE_RECURSIVE,
	constants.SQLITE_PRAGMA,
	constants.SQLITE_TRANSACTION,
	constants.SQLITE_SAVEPOINT,
]);

// Opens a connection with the settings that every connection of the shell has.
// DEFENSIVE blocks writes to the schema tables. The ATTACH limit of 0 blocks every other file,
// also the target of VACUUM INTO. Extension load stays off.
function openWithSafetySettings(file, readOnly) {
	const db = new DatabaseSync(file, {
		readOnly,
		enableForeignKeyConstraints: true,
		allowExtension: false,
		timeout: BUSY_TIMEOUT_MS,
		limits: { attach: 0 },
	});
	try {
		db.enableDefensive(true);
		db.exec("PRAGMA trusted_schema = OFF");
	} catch (error) {
		db.close();
		throw error;
	}
	return db;
}

/**
 * Opens (or creates) the app database file with the settings of section 5.
 * Throws the SQLite error when the file does not open.
 * @param {string} file Absolute path of the database file, or `:memory:`.
 * @returns {DatabaseSync}
 */
function openDatabase(file) {
	const db = openWithSafetySettings(file, false);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		db.exec("PRAGMA synchronous = NORMAL");
	} catch (error) {
		db.close();
		throw error;
	}
	return db;
}

/**
 * Opens a file read-only with the same safety settings. The import check and the backup
 * before an update use it.
 * @param {string} file Absolute path of an SQLite file.
 * @returns {DatabaseSync}
 */
function openReadOnly(file) {
	return openWithSafetySettings(file, true);
}

/**
 * Path of a file that SQLite keeps next to the database, for example `app.db-wal`.
 * @param {string} dbFile
 * @param {string} suffix `-wal` or `-shm`.
 */
function sidecarPath(dbFile, suffix) {
	return `${dbFile}${suffix}`;
}

/**
 * Reads the ledger rows, sorted by version. `version` and `sha256` come from the file as
 * they are, so a file from another person can hold a value of another type.
 * @param {DatabaseSync} db
 * @returns {{ version: number, sha256: string }[]}
 */
function readLedger(db) {
	return db
		.prepare("SELECT version, sha256 FROM wandit_migrations ORDER BY version")
		.all()
		.map((row) => ({ version: row.version, sha256: row.sha256 }));
}

// Ends the open transaction without its changes and answers `message`. When ROLLBACK
// also fails, the answer holds both errors.
function rollbackWith(db, message, rollback) {
	// SQLite ends the transaction by itself after some errors, for example SQLITE_FULL.
	if (!db.isTransaction) {
		return message;
	}
	try {
		rollback();
		return message;
	} catch (error) {
		return `${message} The rollback also failed: ${error.message}`;
	}
}

// Prepares `sql`, which the scan cut as one statement. node:sqlite drops the text after the
// first statement without an error, so this refuses a text that SQLite cut at another place.
function prepareWhole(db, sql) {
	const statement = db.prepare(sql);
	if (splitStatements(sql.slice(statement.sourceSQL.length)).length > 0) {
		throw new Error("SQLite read only a part of the statement.");
	}
	return statement;
}

// Answers why a check failed, or null when it answered one row with the integer 1.
// The gate and the preview test the answer in the same order, with the same reasons.
function checkFailure(statement) {
	const columns = statement.columns().length;
	if (columns !== 1) {
		return `answered ${columns} columns, not 1`;
	}
	// Big integers keep INTEGER apart from REAL: 1 is `1n`, and 1.0 is the number 1.
	statement.setReadBigInts(true);
	statement.setReturnArrays(true);
	const rows = [];
	for (const row of statement.iterate()) {
		rows.push(row);
		// Row 2 proves "more than one row". The loop end resets the statement.
		if (rows.length === 2) {
			break;
		}
	}
	if (rows.length === 0) {
		return "answered no row";
	}
	if (rows.length > 1) {
		return "answered more than one row";
	}
	const [value] = rows[0];
	if (value === 1n) {
		return null;
	}
	let shown = "a BLOB";
	if (value === null) {
		shown = "NULL";
	} else if (typeof value === "bigint") {
		shown = String(value);
	} else if (typeof value === "number") {
		shown = `${value} (REAL)`;
	} else if (typeof value === "string") {
		shown = `'${Array.from(value).slice(0, MAX_SHOWN_TEXT_CHARS).join("")}'`;
	}
	return `answered ${shown}, not the integer 1`;
}

// Runs the statements of one file in order. A statement that writes nothing and answers
// columns is a check. It must answer one row with the integer 1. Throws an Error with the reason.
function runFile(db, sql) {
	// node:sqlite ends the SQL text at a NUL character and drops the rest without an error.
	if (sql.includes("\0")) {
		throw new Error("The SQL text holds a NUL character.");
	}
	let wrote = false;
	// node:sqlite has no `sqlite3_stmt_readonly`. SQLite calls the authorizer for each action
	// while it prepares a statement, so the actions show if the statement writes.
	// Security: ATTACH and DETACH stay refused here too, with the ATTACH limit of the connection.
	db.setAuthorizer((action) => {
		if (
			action === constants.SQLITE_ATTACH ||
			action === constants.SQLITE_DETACH
		) {
			return constants.SQLITE_DENY;
		}
		if (!READ_ACTIONS.has(action)) {
			wrote = true;
		}
		return constants.SQLITE_OK;
	});
	try {
		splitStatements(sql).forEach((scanned, index) => {
			const number = index + 1;
			let reason = null;
			let statement;
			try {
				wrote = false;
				statement = prepareWhole(db, scanned.sql);
				if (!wrote && statement.columns().length > 0) {
					reason = checkFailure(statement);
				} else {
					// SQLite makes every change of a write in its first step, also with RETURNING.
					statement.run();
				}
			} catch (error) {
				throw new Error(`Statement ${number}: ${error.message}`, {
					cause: error,
				});
			}
			if (reason !== null) {
				const text = Array.from(statement.expandedSQL.trim())
					.slice(0, MAX_CHECK_TEXT_CHARS)
					.join("");
				throw new Error(
					`Statement ${number} is a check that ${reason}: ${text}`,
				);
			}
		});
	} finally {
		db.setAuthorizer(null);
	}
}

// Writes the ledger row of one file and adds its version to `recorded`.
// `status` is `applied`, `replaced`, or `skipped` (see the section 5 of the doc).
function recordMigration(db, recorded, migration, status, appVersion) {
	try {
		db.prepare(
			"INSERT INTO wandit_migrations (version, name, sha256, status, recorded_at, app_version) " +
				"VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?5)",
		).run({
			// node:sqlite binds a JavaScript number as REAL. A BigInt is an INTEGER.
			"?1": BigInt(migration.version),
			"?2": migration.name,
			"?3": migration.sha256,
			"?4": status,
			"?5": appVersion,
		});
	} catch (error) {
		throw new Error(
			`Migration ${fileName(migration)} failed: The ledger row could not be written: ${error.message}`,
			{ cause: error },
		);
	}
	recorded.add(migration.version);
}

// Step 9: walks the files in version order inside the transaction of step 8. A target runs
// its newest replacement in its place. Every packed version gets exactly one ledger row.
// `targets` holds the target version of each file of `migrations`, from step 6.
function applyPending(db, migrations, targets, pendingVersions, appVersion) {
	const run = (migration) => {
		try {
			runFile(db, migration.sql);
		} catch (error) {
			throw new Error(
				`Migration ${fileName(migration)} failed: ${error.message}`,
				{ cause: error },
			);
		}
	};
	const recorded = new Set();
	migrations.forEach((migration, index) => {
		if (
			!pendingVersions.has(migration.version) ||
			recorded.has(migration.version)
		) {
			return;
		}
		// Its target is in the ledger from an earlier start, so the target ran already.
		if (targets[index] !== null) {
			recordMigration(db, recorded, migration, "skipped", appVersion);
			return;
		}
		const alternatives = migrations.filter(
			(_, alternativeIndex) => targets[alternativeIndex] === migration.version,
		);
		const newest = alternatives.at(-1);
		if (newest === undefined) {
			run(migration);
			recordMigration(db, recorded, migration, "applied", appVersion);
			return;
		}
		run(newest);
		recordMigration(db, recorded, migration, "replaced", appVersion);
		for (const alternative of alternatives) {
			const status = alternative === newest ? "applied" : "skipped";
			recordMigration(db, recorded, alternative, status, appVersion);
		}
	});
}

/**
 * The migration runner of section 5, steps 1 to 10. Call it before `new AppConnection`,
 * whose statement rules refuse the ledger writes. All pending files run in one transaction.
 * Throws an Error with the reason when the app must stay in the `migration_failed` state.
 * The database is then as before the call.
 * @param {DatabaseSync} db An open connection with the safety settings.
 * @param {Migration[]} migrations Sorted by version.
 * @param {string} appVersion Semver of the app, written into each new ledger row.
 * @param {() => Promise<void>} writeBackup Writes the backup of step 7. The runner calls it
 *   only when the ledger has rows and a file is pending. A rejection stops the migration.
 */
async function runMigrations(db, migrations, appVersion, writeBackup) {
	let applied;
	try {
		db.exec(CREATE_LEDGER_SQL);
	} catch (error) {
		throw new Error(`The ledger could not be created: ${error.message}`, {
			cause: error,
		});
	}
	try {
		applied = readLedger(db);
	} catch (error) {
		throw new Error(`The ledger could not be read: ${error.message}`, {
			cause: error,
		});
	}

	// Step 3: installed apps ran this exact text. Another text means a wrong build.
	for (const { version, sha256 } of applied) {
		if (
			migrations.some(
				(migration) =>
					migration.version === version && migration.sha256 !== sha256,
			)
		) {
			throw new Error(
				`Migration ${version} of this build differs from the one that the database ran.`,
			);
		}
	}

	const pending = migrations.filter(
		(migration) => !applied.some((row) => row.version === migration.version),
	);
	// Step 4: a pending file below the database version is missing from an older build.
	// Ledger rows above every packed version stay allowed: that is a rollback.
	const highest = applied.at(-1)?.version;
	const late = pending.find(
		(migration) => highest !== undefined && migration.version < highest,
	);
	if (late !== undefined) {
		throw new Error(
			`Migration ${late.version} is below version ${highest} of the database.`,
		);
	}
	// Step 5: nothing to run, so the database does not change.
	if (pending.length === 0) {
		return;
	}
	// Step 6, after step 5: a bad group must not lock out an install that has nothing to run.
	const targets = readReplacementTargets(migrations);
	// Step 7: never migrate saved data without a backup. An empty ledger has no saved data.
	if (applied.length > 0) {
		try {
			await writeBackup();
		} catch (error) {
			throw new Error(
				`The backup before the migration failed: ${error.message}`,
				{ cause: error },
			);
		}
	}
	// Steps 8 to 10: one transaction for all pending files. A failure leaves the database
	// exactly as before the update.
	try {
		db.exec("BEGIN IMMEDIATE");
	} catch (error) {
		throw new Error(
			`The migration transaction did not start: ${error.message}`,
			{ cause: error },
		);
	}
	try {
		const pendingVersions = new Set(pending.map((file) => file.version));
		applyPending(db, migrations, targets, pendingVersions, appVersion);
		try {
			db.exec("COMMIT");
		} catch (error) {
			throw new Error(`The migrations did not commit: ${error.message}`, {
				cause: error,
			});
		}
	} catch (error) {
		// A deferred foreign key fails at COMMIT, and SQLite then keeps the transaction open.
		throw new Error(
			rollbackWith(db, error.message, () => db.exec("ROLLBACK")),
			{ cause: error },
		);
	}
}

// The ledger and the internal tables of SQLite. The page may read them, never write them.
function isShellTable(tableName) {
	const name = String(tableName).toLowerCase();
	return name === "wandit_migrations" || name.startsWith("sqlite_");
}

// Converts one param of the page to a value that node:sqlite binds (section 4).
// input.js already refused every other type and each number that is not finite.
function toBoundValue(param) {
	if (typeof param === "boolean") {
		return param ? 1n : 0n;
	}
	// An integer inside the safe range of JavaScript stays exact as INTEGER. node:sqlite binds
	// a JavaScript number as REAL, so the integer goes as a BigInt. Every other number is REAL.
	if (typeof param === "number" && Number.isSafeInteger(param)) {
		return BigInt(param);
	}
	return param;
}

// Makes the arguments of a node:sqlite call from the params of the page. Param N of the page
// is SQLite parameter N. node:sqlite binds a parameter with a name (`:id`, `@id`, `$id`) only
// from an object, and binds the other arguments to the `?` and `?NNN` parameters in index order.
function bindArguments(parameterNames, params) {
	const named = {};
	const positional = [];
	parameterNames.forEach((name, index) => {
		const value = toBoundValue(params[index]);
		if (name === null) {
			positional.push(value);
		} else {
			named[name] = value;
		}
	});
	return positional.length === parameterNames.length
		? positional
		: [named, ...positional];
}

// Converts one result value to the type of the page (section 4).
function toSqlValue(value) {
	if (value === null || typeof value === "string") {
		return value;
	}
	// An integer above 2^53 loses precision here, as section 4 says.
	if (typeof value === "bigint") {
		return Number(value);
	}
	if (typeof value === "number") {
		// JSON has no Infinity and no NaN.
		if (!Number.isFinite(value)) {
			throw new DbError("unsupported_value", "A REAL value is not finite.");
		}
		return value;
	}
	throw new DbError(
		"unsupported_value",
		"BLOB values are not supported. Store a file as base64 text.",
	);
}

/**
 * The app connection after the runner: it holds the statement rules of section 4 and the
 * bodies of the 4 commands. Each method throws a DbError. app-database.js owns one object
 * per open database file.
 */
class AppConnection {
	/** @param {DatabaseSync} db A migrated connection. The constructor installs the statement rules on it. */
	constructor(db) {
		this.db = db;
		// True while the shell itself runs BEGIN, COMMIT, or ROLLBACK for `db_batch`.
		this.allowsTransaction = false;
		// True when the statement of the last prepare writes a row.
		this.sawWrite = false;
		db.setAuthorizer((action, tableName) => this.authorize(action, tableName));
		this.lastInsertRowId = db.prepare("SELECT last_insert_rowid() AS id");
	}

	// The statement rules of section 4. SQLite asks for each action while it prepares a
	// statement, also for the actions inside triggers and views.
	authorize(action, tableName) {
		let isAllowed = false;
		switch (action) {
			case constants.SQLITE_SELECT:
			case constants.SQLITE_READ:
			case constants.SQLITE_FUNCTION:
			case constants.SQLITE_RECURSIVE:
				isAllowed = true;
				break;
			case constants.SQLITE_INSERT:
			case constants.SQLITE_UPDATE:
			case constants.SQLITE_DELETE:
				this.sawWrite = true;
				isAllowed = !isShellTable(tableName);
				break;
			case constants.SQLITE_TRANSACTION:
				isAllowed = this.allowsTransaction;
				break;
			// Refused: ATTACH, DETACH, PRAGMA, every CREATE, DROP, and ALTER, REINDEX, and ANALYZE.
			// Also refused: virtual tables, SAVEPOINT, RELEASE, and each action that a newer SQLite adds.
		}
		return isAllowed ? constants.SQLITE_OK : constants.SQLITE_DENY;
	}

	// Runs a BEGIN, COMMIT, or ROLLBACK of the shell itself past the statement rules.
	runShellStatement(sql) {
		this.allowsTransaction = true;
		try {
			this.db.exec(sql);
		} finally {
			this.allowsTransaction = false;
		}
	}

	// Prepares exactly one statement and makes its bind arguments, after the limits of section 4.
	// `writes` is the answer of `sqlite3_stmt_readonly`, which node:sqlite does not have: the
	// statement rules let only INSERT, UPDATE, and DELETE write, and SQLite asks for each one.
	prepareOne(sql, params) {
		if (Buffer.byteLength(sql) > MAX_SQL_BYTES) {
			throw new DbError(
				"invalid_input",
				`The SQL text is larger than ${MAX_SQL_BYTES} bytes.`,
			);
		}
		if (params.length > MAX_PARAMS) {
			throw new DbError(
				"invalid_input",
				`A statement takes at most ${MAX_PARAMS} params.`,
			);
		}
		// node:sqlite ends the SQL text at a NUL character and drops the rest without an error.
		if (sql.includes("\0")) {
			throw new DbError("invalid_input", "The SQL text holds a NUL character.");
		}
		const [first, second] = splitStatements(sql);
		if (first === undefined) {
			throw new DbError("invalid_input", "The SQL text holds no statement.");
		}
		this.sawWrite = false;
		let statement;
		try {
			statement = this.db.prepare(first.sql);
		} catch (error) {
			throw toDbError(error);
		}
		const writes = this.sawWrite;
		// Text after the first statement, other than spaces and comments, is a second
		// statement, also when it does not prepare.
		const rest = first.sql.slice(statement.sourceSQL.length);
		if (second !== undefined || splitStatements(rest).length > 0) {
			throw new DbError(
				"invalid_input",
				"Send one statement per call. db_batch runs several statements.",
			);
		}
		if (first.parameterNames.length !== params.length) {
			throw new DbError(
				"invalid_input",
				`The statement has ${first.parameterNames.length} params, but the call gives ${params.length}.`,
			);
		}
		return {
			statement,
			writes,
			bound: bindArguments(first.parameterNames, params),
		};
	}

	/**
	 * Body of `db_select`: one statement that does not write, at most 10,000 rows.
	 * @param {string} sql
	 * @param {SqlParam[]} params
	 * @returns {{ columns: string[], rows: SqlValue[][] }}
	 */
	select(sql, params) {
		const { statement, writes, bound } = this.prepareOne(sql, params);
		if (writes) {
			throw new DbError(
				"statement_refused",
				"db_select runs only a statement that does not write. Use db_execute.",
			);
		}
		try {
			const columns = statement.columns().map((column) => column.name);
			// Without big integers, node:sqlite throws for an INTEGER above 2^53.
			statement.setReadBigInts(true);
			statement.setReturnArrays(true);
			const rows = [];
			for (const row of statement.iterate(...bound)) {
				if (rows.length === MAX_SELECT_ROWS) {
					throw new DbError(
						"too_many_rows",
						`The query answers more than ${MAX_SELECT_ROWS} rows. Add LIMIT and OFFSET.`,
					);
				}
				rows.push(row.map(toSqlValue));
			}
			return { columns, rows };
		} catch (error) {
			throw toDbError(error);
		}
	}

	/**
	 * Body of `db_execute`, and of each statement of `db_batch`: INSERT, UPDATE, DELETE, or SELECT.
	 * @param {string} sql
	 * @param {SqlParam[]} params
	 * @returns {ExecuteAnswer} `changes` is 0 for a statement that only reads.
	 */
	execute(sql, params) {
		const { statement, writes, bound } = this.prepareOne(sql, params);
		try {
			if (writes) {
				// SQLite makes every change in the first step, so a write with RETURNING runs fully.
				const { changes, lastInsertRowid } = statement.run(...bound);
				return {
					changes: Number(changes),
					lastInsertRowId: Number(lastInsertRowid),
				};
			}
			// Step a read to the end, so an error of a later row still fails the call.
			statement.setReadBigInts(true);
			const rows = statement.iterate(...bound);
			while (!rows.next().done) {
				// The rows of a read are not part of the answer.
			}
			// `sqlite3_changes` keeps the count of the last write, so a read reports 0 here.
			return {
				changes: 0,
				lastInsertRowId: Number(this.lastInsertRowId.get().id),
			};
		} catch (error) {
			throw toDbError(error);
		}
	}

	/**
	 * Body of `db_batch`: at most 500 statements in one transaction, all or none.
	 * @param {{ sql: string, params: SqlParam[] }[]} statements
	 * @returns {{ results: ExecuteAnswer[] }}
	 */
	batch(statements) {
		if (statements.length > MAX_BATCH_STATEMENTS) {
			throw new DbError(
				"invalid_input",
				`A batch holds at most ${MAX_BATCH_STATEMENTS} statements.`,
			);
		}
		const rollback = () => this.runShellStatement("ROLLBACK");
		try {
			this.runShellStatement("BEGIN IMMEDIATE");
		} catch (error) {
			throw toDbError(error);
		}
		const results = [];
		for (const [index, { sql, params }] of statements.entries()) {
			try {
				results.push(this.execute(sql, params));
			} catch (error) {
				const failure = toDbError(error);
				const message = `Statement ${index + 1}: ${failure.message}`;
				throw new DbError(
					failure.code,
					rollbackWith(this.db, message, rollback),
				);
			}
		}
		// A deferred foreign key fails only at COMMIT.
		try {
			this.runShellStatement("COMMIT");
		} catch (error) {
			const failure = toDbError(error);
			throw new DbError(
				failure.code,
				rollbackWith(this.db, failure.message, rollback),
			);
		}
		return { results };
	}

	/**
	 * Body of `app_info`.
	 * @param {string} dbFile Absolute path of the database file, for the size.
	 * @param {string} version Semver of the installed app, from wandit.desktop.json.
	 * @param {string | null} lastBackupAt UTC time of the newest backup, ISO 8601, from backup.js.
	 */
	appInfo(dbFile, version, lastBackupAt) {
		let schemaVersion;
		try {
			schemaVersion = this.db
				.prepare(
					"SELECT COALESCE(MAX(version), 0) AS version FROM wandit_migrations",
				)
				.get().version;
		} catch (error) {
			throw toDbError(error);
		}
		return {
			version,
			schemaVersion,
			databaseBytes: databaseBytes(dbFile),
			lastBackupAt,
		};
	}
}

// Size of a file in bytes. 0 when the file is missing and `isOptional` is true.
function fileBytes(file, isOptional) {
	try {
		return fs.statSync(file).size;
	} catch (error) {
		if (isOptional && error.code === "ENOENT") {
			return 0;
		}
		throw new DbError(
			"sql_error",
			`The database size is not readable: ${error.message}`,
		);
	}
}

// The WAL file holds the newest writes until a checkpoint, so it counts too.
function databaseBytes(dbFile) {
	return (
		fileBytes(dbFile, false) + fileBytes(sidecarPath(dbFile, "-wal"), true)
	);
}

module.exports = {
	AppConnection,
	MAX_BATCH_STATEMENTS,
	MAX_PARAMS,
	MAX_SELECT_ROWS,
	MAX_SQL_BYTES,
	openDatabase,
	openReadOnly,
	readLedger,
	runMigrations,
	sidecarPath,
};
