/**
 * This file runs the desktop migration gate (docs/v2/desktop-apps.md) in sql.js, SQLite in WebAssembly.
 * The user SQL never reaches a file or the network: each of the three runs uses an in-memory database.
 * Run 1 is the upgrade path on hostile test rows. It also probes each ADD COLUMN on a frozen table.
 * Run 2 is one path for each new replacement, with a schema compare. Run 3 is a new install.
 * The three runs share one deadline (DRY_RUN_DEADLINE_MS) and one heap limit. Each database has a size limit.
 * The host tool `add_local_migration` and the `desktop-build` task call `checkDesktopMigrations`.
 */
import { createRequire } from "node:module";
import { isNativeError } from "node:util/types";
import { runInNewContext } from "node:vm";

import {
	DESKTOP_MIGRATIONS_DIR,
	type DesktopGateFinding,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import initSqlJs, {
	type Database,
	type SqlJsStatic,
	type SqlValue,
	type Statement,
} from "sql.js";
import {
	classifyDesktopMigrationStatement,
	type DesktopMigrationFile,
	type DesktopSchema,
	desktopGateFinding,
	desktopMigrationFirstWord,
	findDesktopMigrationRefusal,
	findRemovedDesktopSchema,
	lowerCaseAscii,
	type PlannedDesktopMigration,
	planDesktopMigrations,
	type ReleasedDesktopMigration,
} from "../../domain/desktop-migrations";

let sqlJsModule: Promise<SqlJsStatic> | undefined;

// The static import stays: the Trigger build installs an external package only when esbuild resolves its import.
// Null after a timeout (dropSqlJs). The next load then evaluates a new copy of the package.
let initSqlJsCopy: typeof initSqlJs | null = initSqlJs;

// One WebAssembly module per process. A failed load or a failed require is not kept, so the
// next call tries again.
function loadSqlJs(): Promise<SqlJsStatic> {
	initSqlJsCopy ??= requireFreshSqlJs();
	sqlJsModule ??= initSqlJsCopy().catch((error: unknown) => {
		sqlJsModule = undefined;
		throw error;
	});
	return sqlJsModule;
}

// A timeout stops sql.js at any point. Its module can then hold a broken heap and a moved stack pointer.
// LIMIT: after a timeout, two dead modules can stay in memory: the first one (static import) and the last dropped copy (require.cache, until the next load). Each holds its 64 MiB heap, a database file, and a journal. More timeouts do not add memory. Upgrade: run the dry run in a worker thread.
function dropSqlJs(): void {
	sqlJsModule = undefined;
	initSqlJsCopy = null;
}

// initSqlJs keeps its module in a closure, so only a new evaluation of the package gives a new module.
// Each call makes its own require function. Node lists each loaded module in the children of the
// require parent, so one shared parent keeps every dropped module in memory.
function requireFreshSqlJs(): typeof initSqlJs {
	const requireFresh = createRequire(import.meta.url);
	delete requireFresh.cache[requireFresh.resolve("sql.js")];
	// SAFETY: this is the package of the static import above, so it exports the same initSqlJs function.
	return requireFresh("sql.js") as typeof initSqlJs;
}

// 30 s for the three runs together. A large legal folder (4 MiB of one-row INSERT statements
// into a table with 5 indexes) takes about 4 s cold on an Apple M1 Max. The 1 vCPU Trigger
// machines are slower. Two gate calls of one tool call stay far below the 5 min heartbeat timeout.
const DRY_RUN_DEADLINE_MS = 30_000;

// 64 MiB. The largest legal folder holds 4 MiB of SQL. A larger heap is a query that
// grows without end, and SQLite then stops it with "out of memory".
const DRY_RUN_HEAP_LIMIT_BYTES = 64 * 1024 * 1024;

// 8192 pages of 4096 bytes (the sql.js page size), so 32 MiB. The database file is JavaScript
// memory, outside the heap limit. The legal 4 MiB folders that we measured make files of 8 MiB or less.
const DRY_RUN_MAX_PAGE_COUNT = 8192;

// 8 rows. Each text column cycles through its own literals, so an enum CHECK without a
// default passes. More rows give more pairs of values.
const TEST_ROW_LITERAL_ROWS = 8;

// Frozen files ran in installed apps under older rules, so only their schema statements run.
const FROZEN_EXECUTED_WORDS = new Set(["create", "alter", "drop"]);

/**
 * How `runMigration` treats one file (docs/v2/desktop-apps.md section 6):
 * - `frozen`: a file of an earlier build. Only CREATE, ALTER, and DROP run.
 * - `new`, `replacement`: the allow list, the test rows, and the checks apply.
 *   `releasedSchema`: for `new`, the schema after the frozen files. For `replacement`, the schema
 *   before the target. Only `new` probes ADD COLUMN.
 * - `fresh`: a new install. Every statement runs, and checks are evaluated.
 */
type RunMode =
	| { kind: "frozen" }
	| { kind: "new" | "replacement"; releasedSchema: DesktopSchema }
	| { kind: "fresh" };

/** One row of `sqlite_schema`. `sql` is null for the automatic index of a UNIQUE rule. */
type SchemaRow = {
	type: string;
	name: string;
	tableName: string;
	sql: string | null;
};

/** A new replacement file and the version of the frozen file that it replaces. */
type NewReplacement = {
	file: PlannedDesktopMigration;
	targetVersion: number;
};

/** The schema rows of an install right after the target ran, from run 1. */
type TargetSchema = {
	/** File name of the target, for example `0002_copy_emails.sql`. */
	fileName: string;
	rows: SchemaRow[];
};

/**
 * Checks the migration files of a desktop project against the registry of built files.
 * No findings means a build may ship them. Answers the findings of the first run that has some.
 * Runs that take more than `deadlineMs` answer one `migration_dry_run_failed` finding.
 * Throws only when sql.js does not load, or on a broken internal rule. The build task then
 * reports `gate_unavailable`, and the host tool answers `failed`.
 */
export async function checkDesktopMigrations(
	files: DesktopMigrationFile[],
	released: ReleasedDesktopMigration[],
	/** Deadline of the three runs. Only the spec passes a shorter one, so its case stays fast. */
	deadlineMs = DRY_RUN_DEADLINE_MS,
): Promise<DesktopGateFinding[]> {
	const plan = planDesktopMigrations(files, released);
	if (plan.findings.length > 0) {
		return plan.findings;
	}
	const loading = loadSqlJs();
	const sqlJs = await loading;
	// A timeout of another call can drop the module while this call waits for it. The stopped run
	// keeps its databases open in that module, so this call starts again on the new module.
	if (loading !== sqlJsModule) {
		return checkDesktopMigrations(files, released, deadlineMs);
	}
	let findings: DesktopGateFinding[] = [];
	// sql.js has no progress handler and no interrupt. The vm watchdog stops the call, also inside WebAssembly.
	// The script only calls the function of its context, so the timeout covers the three runs.
	try {
		runInNewContext(
			"runDryRuns()",
			{
				runDryRuns: () => {
					findings = runDryRuns(sqlJs, plan.migrations);
				},
			},
			{ timeout: deadlineMs },
		);
	} catch (error: unknown) {
		if (!isDeadlineError(error)) {
			throw error;
		}
		dropSqlJs();
		// The finding shows the deadline in seconds, as the agent rules in templates/desktop-app/CLAUDE.md do.
		return [
			desktopGateFinding(
				"migration_dry_run_failed",
				DESKTOP_MIGRATIONS_DIR,
				`The dry run stopped after ${deadlineMs / 1000} s. A statement runs too long, for example a join of many tables with no join condition. Join each table on a key column.`,
			),
		];
	}
	return findings;
}

// Node throws this code when the vm timeout stops a script. Node makes the error in the realm of the
// vm context, so `instanceof Error` is false. isNativeError works across realms.
function isDeadlineError(error: unknown): boolean {
	return (
		isNativeError(error) &&
		"code" in error &&
		error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT"
	);
}

// The synchronous part of the gate: runs 1, 2, and 3 (see the file header).
function runDryRuns(
	sqlJs: SqlJsStatic,
	migrations: PlannedDesktopMigration[],
): DesktopGateFinding[] {
	const newReplacements: NewReplacement[] = migrations.flatMap((file) =>
		!file.isReleased && file.replaces !== null
			? [{ file, targetVersion: file.replaces }]
			: [],
	);
	const upgrade = runUpgradePath(sqlJs, migrations, newReplacements);
	if (upgrade.findings.length > 0) {
		return upgrade.findings;
	}
	for (const replacement of newReplacements) {
		const target = upgrade.targetSchemas.get(replacement.targetVersion);
		// The plan checks that each target is a frozen plain file, and run 1 saves each one.
		if (target === undefined) {
			throw new Error(
				`Run 1 did not save the schema of target ${replacement.targetVersion}.`,
			);
		}
		const findings = runReplacementPath(sqlJs, migrations, replacement, target);
		if (findings.length > 0) {
			return findings;
		}
	}
	return runNewInstall(sqlJs, migrations);
}

// Run 1: an install that ran every frozen plain file, with saved rows, gets the new plain files.
// It also saves the schema rows after each target of a new replacement, for run 2.
function runUpgradePath(
	sqlJs: SqlJsStatic,
	migrations: PlannedDesktopMigration[],
	newReplacements: NewReplacement[],
): {
	findings: DesktopGateFinding[];
	/** By target version. */
	targetSchemas: Map<number, TargetSchema>;
} {
	const targetSchemas = new Map<number, TargetSchema>();
	const targets = new Set(
		newReplacements.map((replacement) => replacement.targetVersion),
	);
	const db = openDryRunDatabase(sqlJs);
	try {
		for (const migration of migrations) {
			if (!migration.isReleased || migration.replaces !== null) {
				continue;
			}
			const findings = runMigration(sqlJs, db, migration, { kind: "frozen" });
			if (findings.length > 0) {
				return { findings, targetSchemas };
			}
			if (targets.has(migration.version)) {
				targetSchemas.set(migration.version, {
					fileName: migration.fileName,
					rows: readSchemaRows(db),
				});
			}
		}
		const built = readSchema(db);
		if (built.findings.length > 0) {
			return { findings: built.findings, targetSchemas };
		}
		addTestRows(db);
		// The first file with a finding stops the run: later files often
		// depend on the statements that it skipped.
		for (const migration of migrations) {
			if (migration.isReleased || migration.replaces !== null) {
				continue;
			}
			const findings = runMigration(sqlJs, db, migration, {
				kind: "new",
				releasedSchema: built.schema,
			});
			if (findings.length > 0) {
				return { findings, targetSchemas };
			}
		}
		const current = readSchema(db);
		return {
			findings: [
				...current.findings,
				...findRemovedDesktopSchema(built.schema, current.schema),
			],
			targetSchemas,
		};
	} finally {
		db.close();
	}
}

// Run 2: an install that did not run the target gets the replacement at the place of the target.
// The replacement must leave the same schema rows as the target, so later files work on both installs.
// The frozen files above the target do not run: on the same schema, their DDL gives the same result.
function runReplacementPath(
	sqlJs: SqlJsStatic,
	migrations: PlannedDesktopMigration[],
	replacement: NewReplacement,
	target: TargetSchema,
): DesktopGateFinding[] {
	const db = openDryRunDatabase(sqlJs);
	try {
		for (const migration of migrations) {
			if (
				!migration.isReleased ||
				migration.replaces !== null ||
				migration.version >= replacement.targetVersion
			) {
				continue;
			}
			const findings = runMigration(sqlJs, db, migration, { kind: "frozen" });
			if (findings.length > 0) {
				return findings;
			}
		}
		const atTarget = readSchema(db);
		if (atTarget.findings.length > 0) {
			return atTarget.findings;
		}
		addTestRows(db);
		const findings = runMigration(sqlJs, db, replacement.file, {
			kind: "replacement",
			releasedSchema: atTarget.schema,
		});
		if (findings.length > 0) {
			return findings;
		}
		const difference = findSchemaDifference(target, readSchemaRows(db));
		return difference === null
			? []
			: [
					desktopGateFinding(
						"migration_replaces_schema_differs",
						`${DESKTOP_MIGRATIONS_DIR}/${replacement.file.fileName}`,
						difference,
					),
				];
	} finally {
		db.close();
	}
}

// Run 3: a new install with no rows. Each plain file runs as its newest alternative, as in the shell.
function runNewInstall(
	sqlJs: SqlJsStatic,
	migrations: PlannedDesktopMigration[],
): DesktopGateFinding[] {
	// Version order, so a later replacement of the same target overwrites an older one.
	const newestAlternative = new Map<number, PlannedDesktopMigration>();
	for (const migration of migrations) {
		if (migration.replaces !== null) {
			newestAlternative.set(migration.replaces, migration);
		}
	}
	const db = openDryRunDatabase(sqlJs);
	try {
		for (const migration of migrations) {
			if (migration.replaces !== null) {
				continue;
			}
			const findings = runMigration(
				sqlJs,
				db,
				newestAlternative.get(migration.version) ?? migration,
				{ kind: "fresh" },
			);
			if (findings.length > 0) {
				return findings;
			}
		}
		return [];
	} finally {
		db.close();
	}
}

// The installed app opens its database with the same foreign key and trusted schema settings
// (templates/desktop-shell). So the dry run fails where the app fails. The heap limit is global
// to the sql.js module. The module stays usable after an out-of-memory error (probe P08c).
// A slow statement stops at DRY_RUN_DEADLINE_MS (see checkDesktopMigrations).
// The other settings change no result. sql.js keeps temp files in JavaScript memory, so temp_store
// moves sorts and temp tables into the heap limit. max_page_count limits the database file. One connection
// uses each database, so the exclusive lock is safe. It keeps the page cache between statements,
// and the large legal folder then runs about 2 times faster.
function openDryRunDatabase(sqlJs: SqlJsStatic): Database {
	const db = new sqlJs.Database();
	db.run(
		`PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF; PRAGMA hard_heap_limit = ${DRY_RUN_HEAP_LIMIT_BYTES}; PRAGMA temp_store = MEMORY; PRAGMA max_page_count = ${DRY_RUN_MAX_PAGE_COUNT}; PRAGMA locking_mode = EXCLUSIVE;`,
	);
	return db;
}

// Runs one file in `mode` (see RunMode). A statement error ends the file with a finding.
function runMigration(
	sqlJs: SqlJsStatic,
	db: Database,
	migration: PlannedDesktopMigration,
	mode: RunMode,
): DesktopGateFinding[] {
	const path = `${DESKTOP_MIGRATIONS_DIR}/${migration.fileName}`;
	const findings: DesktopGateFinding[] = [];
	const prefix =
		mode.kind === "fresh"
			? "On a new install: "
			: mode.kind === "frozen"
				? ""
				: "On the test rows: ";
	// A fix always names the first file, never a replacement of it.
	const suffix =
		mode.kind === "fresh" && migration.isReleased
			? ` New installs fail on this file. Call add_local_migration with replaces: ${migration.replaces ?? migration.version}. Copy its CREATE, ALTER, and DROP statements and fix the rest.`
			: "";
	let statementCount = 0;
	// After a refusal, this database differs from a real install. A later result is then noise.
	let isStopped = false;
	try {
		for (const statement of db.iterateStatements(migration.sql)) {
			const number = statementCount + 1;
			const text = statement.getSQL();
			if (mode.kind === "frozen") {
				if (FROZEN_EXECUTED_WORDS.has(desktopMigrationFirstWord(text))) {
					statement.run();
				}
			} else if (mode.kind === "fresh") {
				// The new rules do not apply to an older file, but its checks do: the shell runs them.
				if (desktopMigrationFirstWord(text) === "select") {
					const reason = evaluateCheck(statement);
					if (reason !== null) {
						findings.push(
							checkFinding(path, prefix, number, reason, text, suffix),
						);
					}
				} else {
					statement.run();
				}
			} else {
				const kind = classifyDesktopMigrationStatement(text);
				let refusal = findDesktopMigrationRefusal(kind, mode.releasedSchema);
				// A replacement copies the ADD COLUMN text of its target, which passed the probe in its own build.
				if (
					refusal === null &&
					!isStopped &&
					kind.kind === "add_column" &&
					mode.kind === "new" &&
					mode.releasedSchema.has(kind.table)
				) {
					refusal = probeAddColumn(sqlJs, db, kind.table, text);
				}
				if (refusal === null && !isStopped) {
					if (kind.kind === "check") {
						const reason = evaluateCheck(statement);
						if (reason !== null) {
							findings.push(
								checkFinding(path, prefix, number, reason, text, ""),
							);
						}
					} else if (kind.kind === "insert" || kind.kind === "update") {
						refusal = findSubProgramRefusal(db, text);
						if (refusal === null) {
							statement.run();
						}
					} else {
						statement.run();
					}
				}
				if (refusal !== null) {
					findings.push(
						desktopGateFinding(
							"migration_statement_refused",
							path,
							`Statement ${number}: ${refusal}`,
						),
					);
					isStopped = true;
				}
			}
			statementCount = number;
		}
	} catch (error: unknown) {
		// sql.js throws SQLite's error text when a statement does not prepare or run.
		// After a refusal, a prepare error only shows a statement that did not run.
		if (!isStopped) {
			findings.push(
				desktopGateFinding(
					"migration_dry_run_failed",
					path,
					`${prefix}Statement ${statementCount + 1}: ${getErrorMessage(error)}${suffix}`,
				),
			);
		}
		return findings;
	}
	if (statementCount === 0) {
		return [
			desktopGateFinding(
				"migration_empty",
				path,
				"The file holds no SQL statement.",
			),
		];
	}
	// "CREATE TABLE temp.x" passes the token rules. The temp schema shows it.
	const temporaryObjects = selectRows(
		db,
		"SELECT name FROM temp.sqlite_schema",
	).flat();
	if (temporaryObjects.length > 0) {
		findings.push(
			desktopGateFinding(
				"migration_statement_refused",
				path,
				`The file creates the temporary object ${temporaryObjects.join(", ")}. It disappears when the app closes.`,
			),
		);
	}
	return findings;
}

// The Rust shell cuts the check text at 200 characters too (db.rs run_file).
function checkFinding(
	path: string,
	prefix: string,
	number: number,
	reason: string,
	text: string,
	suffix: string,
): DesktopGateFinding {
	return desktopGateFinding(
		"migration_check_failed",
		path,
		`${prefix}Statement ${number} is a check that ${reason}: ${firstCharacters(text.trim(), 200)}${suffix}`,
	);
}

// OR IGNORE does not stop a trigger. An AFTER UPDATE trigger of an earlier build can rewrite
// every saved row (R05c), and a trigger body runs under the outer OR IGNORE (R05a).
// SQLite compiles each trigger and each foreign key action that a write can fire into a sub-program
// (opcode Program). It compiles one also when a WHEN clause or empty test rows stop it in the dry run.
// So this rule does not depend on the test rows.
function findSubProgramRefusal(db: Database, text: string): string | null {
	const firesSubProgram = selectRows(db, `EXPLAIN ${text}`).some(
		([, opcode]) => opcode === "Program",
	);
	return firesSubProgram
		? "This statement can fire a trigger or a foreign key action (ON UPDATE CASCADE, SET NULL, SET DEFAULT, or RESTRICT). A migration must not change rows through them. Drop each trigger of this table before the statement, and create it again after it with the same text. Do not update a key column that such a REFERENCES clause names."
		: null;
}

// Answers why a check fails, or null when it answers one row with the integer 1.
// The order of the reasons is the order of the Rust shell (db.rs run_file).
function evaluateCheck(statement: Statement): string | null {
	const columnCount = statement.getColumnNames().length;
	if (columnCount !== 1) {
		return `answered ${columnCount} columns, not 1`;
	}
	if (!statement.step()) {
		return "answered no row";
	}
	const value = readFirstValue(statement);
	if (statement.step()) {
		return "answered more than one row";
	}
	return value === 1n
		? null
		: `answered ${showValue(value)}, not the integer 1`;
}

// Reads column 0 of the current row. An INTEGER gives a bigint, a REAL gives a number (probe P04).
function readFirstValue(statement: Statement): SqlValue | bigint {
	// SAFETY: sql.js 1.15.2 Statement.get(params, config) reads config.useBigInt; @types/sql.js 1.4.11 omits the argument.
	const get = statement.get as (
		params: null,
		config: { useBigInt: true },
	) => (SqlValue | bigint)[];
	return get.call(statement, null, { useBigInt: true })[0] ?? null;
}

function showValue(value: SqlValue | bigint): string {
	if (value === null) {
		return "NULL";
	}
	if (typeof value === "bigint") {
		return String(value);
	}
	if (typeof value === "number") {
		return `${value} (REAL)`;
	}
	// 50 characters, as in the Rust shell. A long text only adds noise to the finding.
	if (typeof value === "string") {
		return `'${firstCharacters(value, 50)}'`;
	}
	return "a BLOB";
}

// Saved rows take the DEFAULT of the new column, and SQLite checks some ADD COLUMN rules
// only on a table with rows. A one-row table with the same name and no old constraints
// shows the result of every install with rows. A CHECK or a generated value that reads
// another column fails here with "no such column".
function probeAddColumn(
	sqlJs: SqlJsStatic,
	db: Database,
	table: string,
	statementSql: string,
): string | null {
	const isStrict =
		selectRows(
			db,
			"SELECT strict FROM pragma_table_list WHERE schema = 'main' AND name = ? COLLATE NOCASE",
			[table],
		)[0]?.[0] === "1";
	const probe = openDryRunDatabase(sqlJs);
	try {
		// `table` keeps its non-ASCII letters (lowerCaseAscii). SQLite folds only ASCII, so the statement finds this table.
		probe.run(
			`CREATE TABLE ${quoteName(table)} (wandit_probe ANY)${isStrict ? " STRICT" : ""}`,
		);
		probe.run(`INSERT INTO ${quoteName(table)} DEFAULT VALUES`);
		probe.run(statementSql);
		return null;
	} catch (error: unknown) {
		return `On a table with saved rows, this ADD COLUMN fails: ${getErrorMessage(error)}. Give a NOT NULL column a literal DEFAULT, and let its CHECK read only the new column.`;
	} finally {
		probe.close();
	}
}

// Reads the tables and views of the main schema. A view that names a
// missing table fails here: SQLite checks a view only when it reads it.
function readSchema(db: Database): {
	schema: DesktopSchema;
	findings: DesktopGateFinding[];
} {
	const schema: DesktopSchema = new Map();
	const findings: DesktopGateFinding[] = [];
	const names = selectRows(
		db,
		"SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite!_%' ESCAPE '!'",
	).flat();
	for (const name of names) {
		try {
			const columns = selectRows(db, "SELECT name FROM pragma_table_info(?)", [
				name,
			]).flat();
			// SQLite folds only ASCII case. So "Étapes" and "étapes" are two tables and get two keys.
			schema.set(lowerCaseAscii(name), new Set(columns.map(lowerCaseAscii)));
		} catch (error: unknown) {
			findings.push(
				desktopGateFinding(
					"migration_dry_run_failed",
					DESKTOP_MIGRATIONS_DIR,
					`The view ${name} fails: ${getErrorMessage(error)}`,
				),
			);
		}
	}
	return { findings, schema };
}

// The rows of `read_schema` in backup.rs of the Rust shell. check_import compares them exactly,
// so the gate compares them with no normalization too (probe P06).
function readSchemaRows(db: Database): SchemaRow[] {
	return selectRows(
		db,
		"SELECT type, name, tbl_name, sql IS NULL, coalesce(sql, '') FROM sqlite_schema ORDER BY type, name",
	).map(([type = "", name = "", tableName = "", isNull = "", sql = ""]) => ({
		name,
		sql: isNull === "1" ? null : sql,
		tableName,
		type,
	}));
}

// Answers the finding text for the first schema row that differs, or null when both lists are equal.
// Rows match on all four fields.
function findSchemaDifference(
	target: TargetSchema,
	replacementRows: SchemaRow[],
): string | null {
	const targetFileName = target.fileName;
	const keyOf = (row: SchemaRow) =>
		JSON.stringify([row.type, row.name, row.tableName, row.sql]);
	const replacementKeys = new Set(replacementRows.map(keyOf));
	const missing = target.rows.find((row) => !replacementKeys.has(keyOf(row)));
	if (missing !== undefined) {
		// The compare is exact, so the agent must see the text to copy (probe R03).
		const expected = missing.sql ?? "(an automatic index of a UNIQUE rule)";
		return `After this file, the ${missing.type} ${missing.name} is missing or differs. Copy each CREATE, ALTER, and DROP statement of ${targetFileName} byte for byte. It makes this text: ${expected}`;
	}
	const targetKeys = new Set(target.rows.map(keyOf));
	const extra = replacementRows.find((row) => !targetKeys.has(keyOf(row)));
	if (extra !== undefined) {
		return `This file makes the ${extra.type} ${extra.name}, and ${targetFileName} does not. Copy each CREATE, ALTER, and DROP statement of ${targetFileName} byte for byte.`;
	}
	return null;
}

/** What a test row stores in a column. A STRICT table uses its exact type, else the affinity. */
type ValueKind = "integer" | "real" | "text" | "blob";

/** One column of a table of an earlier build, as the test rows read it. */
type TestColumn = {
	/** The column name as SQLite stores it. */
	name: string;
	kind: ValueKind;
	/** False when the column is NOT NULL. */
	isNullable: boolean;
	/** True for a PRIMARY KEY column. */
	isKey: boolean;
	/** True when the column has a DEFAULT. The presence rows leave it out. */
	hasDefault: boolean;
	/** Single-quoted SQL literals of the column definition, else of the table constraints. */
	candidates: string[];
};

const NORMAL_VALUES: Record<ValueKind, string> = {
	blob: "x'61'",
	integer: "1",
	real: "1.5",
	text: "'a'",
};

const NEGATIVE_VALUES: Record<ValueKind, string> = {
	blob: "x'2d31'",
	integer: "-1",
	real: "-1.5",
	text: "'-1'",
};

// Puts up to 15 hostile rows in each table of an earlier build, because installed apps
// have rows there. Every insert is OR IGNORE, so a table rule never stops the dry run.
// Rows 1 to 6 fill every column. Row 1 holds normal values. Row 2 is a copy of row 1, except the keys.
// Row 3 holds NULL in the nullable columns. Row 4 holds empty values. Row 5 holds negative values.
// Row 6 holds the malformed JSON '{' in the text columns.
// Rows 7 to 15 fill only the columns without a default. So a CHECK on a defaulted column sees a value that the app saves.
// Rows 8 to 15 cycle through the literals of each text column. So an enum CHECK without a default passes.
// The function drops the triggers before the inserts and creates them again after the inserts.
// Foreign keys are off, because imported files can hold rows with a missing parent.
// LIMIT: a table stays empty when its CHECK needs a value that no literal gives. Examples: CHECK (length(code) = 3), a CHECK that ties two columns, a table CHECK that refuses NULL. The rows hold one malformed JSON text, not every value that breaks an index expression (abs() of the smallest integer). Upgrade: solve each CHECK for a value.
function addTestRows(db: Database): void {
	// SQLite fires the triggers of one event in an order that follows their creation order.
	// The same order keeps the behavior of a real install.
	const triggers = selectRows(
		db,
		"SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY rowid",
	);
	for (const [name = ""] of triggers) {
		db.run(`DROP TRIGGER ${quoteName(name)}`);
	}
	db.run("PRAGMA foreign_keys = OFF");
	const tables = selectRows(
		db,
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite!_%' ESCAPE '!'",
	).flat();
	for (const table of tables) {
		insertTestRows(db, table);
	}
	db.run("PRAGMA foreign_keys = ON");
	for (const [, statement = ""] of triggers) {
		db.run(statement);
	}
}

function insertTestRows(db: Database, table: string): void {
	const isStrict =
		selectRows(
			db,
			"SELECT strict FROM pragma_table_list WHERE schema = 'main' AND name = ?",
			[table],
		)[0]?.[0] === "1";
	const tableSql =
		selectRows(
			db,
			"SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
			[table],
		)[0]?.[0] ?? "";
	const literals = literalsByColumn(tableSql);
	// `hidden = 0` leaves out generated columns. `dflt_value IS NULL` keeps a NULL default apart from no default.
	const columns: TestColumn[] = selectRows(
		db,
		'SELECT name, type, "notnull", pk, dflt_value IS NULL FROM pragma_table_xinfo(?) WHERE hidden = 0',
		[table],
	).map(([name = "", type = "", notNull = "", pk = "", hasNoDefault = ""]) => {
		const kind = valueKindOf(type, isStrict);
		const own = literals.byColumn.get(name.toLowerCase()) ?? [];
		return {
			candidates: own.length > 0 ? own : literals.tableLiterals,
			hasDefault: hasNoDefault !== "1",
			isKey: pk !== "0",
			isNullable: notNull === "0",
			kind,
			name,
		};
	});
	// Rows 1 to 6 (see addTestRows).
	for (let row = 1; row <= 6; row += 1) {
		insertTestRow(
			db,
			table,
			columns.map((column) => [
				column.name,
				keyedRowValue(row, column, isStrict),
			]),
		);
	}
	const withoutDefault = columns.filter((column) => !column.hasDefault);
	// Row 7: the row 1 values in the columns without a default.
	insertTestRow(
		db,
		table,
		withoutDefault.map((column) => [
			column.name,
			column.isKey ? keyValue(column.kind, 7) : NORMAL_VALUES[column.kind],
		]),
	);
	const hasLiteralColumn = withoutDefault.some(
		(column) =>
			column.kind === "text" && !column.isKey && column.candidates.length > 0,
	);
	if (!hasLiteralColumn) {
		return;
	}
	for (let cycle = 1; cycle <= TEST_ROW_LITERAL_ROWS; cycle += 1) {
		// Rows 8 to 15 follow row 7.
		const row = 7 + cycle;
		insertTestRow(
			db,
			table,
			withoutDefault.map((column) => [
				column.name,
				literalRowValue(row, cycle, column),
			]),
		);
	}
}

// One INSERT OR IGNORE of [column name, SQL literal] pairs. No pair gives DEFAULT VALUES.
function insertTestRow(
	db: Database,
	table: string,
	values: [string, string][],
): void {
	const statement =
		values.length === 0
			? `INSERT OR IGNORE INTO ${quoteName(table)} DEFAULT VALUES`
			: `INSERT OR IGNORE INTO ${quoteName(table)} (${values.map(([name]) => quoteName(name)).join(", ")}) VALUES (${values.map(([, value]) => value).join(", ")})`;
	try {
		db.run(statement);
	} catch {
		// OR IGNORE does not skip a STRICT type error or a generated column error.
		// A real install cannot hold such a row either.
	}
}

// The value of rows 1 to 6. The first rule that fits wins.
function keyedRowValue(
	row: number,
	column: TestColumn,
	isStrict: boolean,
): string {
	// An INTEGER PRIMARY KEY then gets a new rowid.
	if (row === 3 && column.isNullable) {
		return "NULL";
	}
	if (column.isKey) {
		return keyValue(column.kind, row);
	}
	if (row === 4) {
		if (column.kind === "text") {
			return "''";
		}
		if (column.kind === "blob") {
			return "x''";
		}
		// An empty form field saves '' also in a number column, but a STRICT table refuses it.
		if (!isStrict) {
			return "''";
		}
		return column.kind === "integer" ? "0" : "0.0";
	}
	if (row === 5) {
		return NEGATIVE_VALUES[column.kind];
	}
	if (row === 6 && column.kind === "text") {
		return "'{'";
	}
	return NORMAL_VALUES[column.kind];
}

// The value of rows 8 to 15. `cycle` is 1 to 8 and picks the literal of a text column.
function literalRowValue(
	row: number,
	cycle: number,
	column: TestColumn,
): string {
	if (column.isKey) {
		return keyValue(column.kind, row);
	}
	if (column.kind !== "text" || column.candidates.length === 0) {
		return NORMAL_VALUES[column.kind];
	}
	return column.candidates[(cycle - 1) % column.candidates.length] ?? "'a'";
}

// Apps often key rows with crypto.randomUUID() and CHECK (length(id) = 36). A short key such
// as 'k1' breaks that CHECK, and the table stays empty. The last group of a UUID has 12 digits.
function keyValue(kind: ValueKind, row: number): string {
	const uuid = `'00000000-0000-4000-8000-${String(row).padStart(12, "0")}'`;
	if (kind === "integer" || kind === "real") {
		return String(row);
	}
	return kind === "blob" ? `CAST(${uuid} AS BLOB)` : uuid;
}

// A STRICT table stores its exact type. Other tables follow the SQLite affinity rules, in order
// (sqlite.org/datatype3.html, 3.1). A BLOB or empty type stores text that the app saves as text.
function valueKindOf(declaredType: string, isStrict: boolean): ValueKind {
	const type = declaredType.toUpperCase();
	if (isStrict) {
		if (type === "INT" || type === "INTEGER") {
			return "integer";
		}
		if (type === "REAL") {
			return "real";
		}
		return type === "BLOB" ? "blob" : "text";
	}
	if (type.includes("INT")) {
		return "integer";
	}
	if (
		type.includes("CHAR") ||
		type.includes("CLOB") ||
		type.includes("TEXT") ||
		type === "" ||
		type.includes("BLOB")
	) {
		return "text";
	}
	if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) {
		return "real";
	}
	return "integer";
}

// Quoted texts, comments, and the three symbols that split a column list. Quotes and comments
// never split a part (prototype probes-review/r08-column-literals.cjs).
const TABLE_TEXT_TOKEN_PATTERN =
	/'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|[(),]/g;

// The first token of a part: a quoted or bare column name, or a table constraint word.
const PART_NAME_PATTERN =
	/^(?:"((?:[^"]|"")*)"|`((?:[^`]|``)*)`|\[([^\]]*)\]|([A-Za-z_\u0080-￿][\w$\u0080-￿]*))/;

// Spaces and comments before the first token of a part.
const LEADING_SPACE_AND_COMMENTS = /^(?:\s+|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))*/;

const TABLE_CONSTRAINT_WORDS = new Set([
	"constraint",
	"check",
	"primary",
	"unique",
	"foreign",
]);

// Reads the single-quoted literals of each column definition, by lowercase column name, and
// the literals of the table constraints. A column without its own literal uses the second list.
function literalsByColumn(tableSql: string): {
	byColumn: Map<string, string[]>;
	tableLiterals: string[];
} {
	const byColumn = new Map<string, string[]>();
	const tableLiterals: string[] = [];
	for (const part of splitColumnList(tableSql)) {
		const body = part.text.replace(LEADING_SPACE_AND_COMMENTS, "");
		const first = PART_NAME_PATTERN.exec(body);
		const bareWord = first?.[4]?.toLowerCase();
		if (bareWord !== undefined && TABLE_CONSTRAINT_WORDS.has(bareWord)) {
			tableLiterals.push(...part.literals);
			continue;
		}
		const quoted =
			first?.[1]?.replaceAll('""', '"') ??
			first?.[2]?.replaceAll("``", "`") ??
			first?.[3];
		byColumn.set((quoted ?? bareWord ?? "").toLowerCase(), part.literals);
	}
	return { byColumn, tableLiterals };
}

// Splits the column list of a CREATE TABLE text at the commas of parenthesis depth 1.
// Answers each part with the single-quoted literals inside it, also at a deeper depth.
function splitColumnList(
	tableSql: string,
): { text: string; literals: string[] }[] {
	const parts: { text: string; literals: string[] }[] = [];
	let depth = 0;
	let start = -1;
	let literals: string[] = [];
	for (const match of tableSql.matchAll(TABLE_TEXT_TOKEN_PATTERN)) {
		const token = match[0];
		if (token === "(") {
			depth += 1;
			if (depth === 1) {
				start = match.index + 1;
			}
		} else if (token === ")") {
			if (depth === 1) {
				parts.push({ literals, text: tableSql.slice(start, match.index) });
				literals = [];
			}
			depth -= 1;
		} else if (token === "," && depth === 1) {
			parts.push({ literals, text: tableSql.slice(start, match.index) });
			literals = [];
			start = match.index + 1;
		} else if (token.startsWith("'") && depth >= 1) {
			literals.push(token);
		}
	}
	return parts;
}

// Cuts on code points, so a cut never leaves half of a surrogate pair in a finding.
function firstCharacters(text: string, count: number): string {
	return Array.from(text).slice(0, count).join("");
}

function quoteName(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

// Answers every row of a query, each value as text.
function selectRows(
	db: Database,
	sql: string,
	params: string[] = [],
): string[][] {
	const statement = db.prepare(sql, params);
	const rows: string[][] = [];
	try {
		while (statement.step()) {
			rows.push(statement.get().map(String));
		}
	} finally {
		statement.free();
	}
	return rows;
}
