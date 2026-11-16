const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { writeBackup } = require("../src/db/backup.js");
const {
	AppConnection,
	MAX_BATCH_STATEMENTS,
	MAX_PARAMS,
	MAX_SELECT_ROWS,
	MAX_SQL_BYTES,
	openDatabase,
	openReadOnly,
	readLedger,
	runMigrations,
} = require("../src/db/database.js");
const { migration, testDir } = require("../testing/support.js");

const NOTES =
	"CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);";
// File 2 of the replacement tests: a NOT NULL insert that fails on every install.
const BROKEN_TAGS =
	"CREATE TABLE tags (name TEXT NOT NULL); INSERT INTO tags (name) VALUES (NULL);";
// The fix of BROKEN_TAGS: the same CREATE statement without the insert.
const TAGS_FIX =
	"-- wandit:replaces 0002\nCREATE TABLE tags (name TEXT NOT NULL);";

async function noBackup() {
	throw new Error("the runner must not write a backup here");
}

function memoryDatabase(context) {
	const db = openDatabase(":memory:");
	context.after(() => db.close());
	return db;
}

function tableNames(db) {
	return db
		.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.all()
		.map((row) => row.name);
}

function ledgerVersions(db) {
	return readLedger(db).map((row) => row.version);
}

// The ledger as "version status" texts, sorted by version.
function ledgerRows(db) {
	return db
		.prepare("SELECT version, status FROM wandit_migrations ORDER BY version")
		.all()
		.map((row) => `${row.version} ${row.status}`);
}

// A migrated database with the statement rules, as the commands see it.
async function appConnection(context) {
	const db = memoryDatabase(context);
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	return new AppConnection(db);
}

function commandError(run) {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error("the command did not fail");
}

test("the runner writes a backup before it migrates saved data", async (context) => {
	const dir = testDir(context);
	const db = openDatabase(path.join(dir, "app.db"));
	context.after(() => db.close());
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	db.exec("INSERT INTO notes (body) VALUES ('saved')");

	const migrations = [
		migration(1, "init", NOTES),
		migration(
			2,
			"add_pinned",
			"ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;",
		),
	];
	const backups = path.join(dir, "backups");
	await runMigrations(db, migrations, "1.0.2", async () => {
		await writeBackup(db, backups, {
			type: "before_migration",
			version: "1.0.2",
		});
	});

	assert.deepEqual(ledgerVersions(db), [1, 2]);
	const [name] = fs.readdirSync(backups);
	assert.match(name, /^before-1\.0\.2-\d{8}T\d{9}Z\.db$/);
	// The backup holds the data before the migration.
	const copy = openReadOnly(path.join(backups, name));
	context.after(() => copy.close());
	assert.deepEqual(ledgerVersions(copy), [1]);
	assert.equal(copy.prepare("SELECT body FROM notes").get().body, "saved");
});

test("the runner refuses a changed migration", async (context) => {
	const db = memoryDatabase(context);
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	const changed = [
		migration(1, "init", "CREATE TABLE notes (id INTEGER PRIMARY KEY);"),
		migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
	];
	await assert.rejects(runMigrations(db, changed, "1.0.2", noBackup), {
		message:
			"Migration 1 of this build differs from the one that the database ran.",
	});
	assert.deepEqual(ledgerVersions(db), [1]);
});

test("the runner refuses a pending version below the database version", async (context) => {
	const db = memoryDatabase(context);
	const tags = migration(3, "add_tags", "CREATE TABLE tags (name TEXT);");
	await runMigrations(
		db,
		[migration(1, "init", NOTES), tags],
		"1.0.1",
		noBackup,
	);
	const withGap = [
		migration(1, "init", NOTES),
		migration(2, "add_files", "CREATE TABLE files (name TEXT);"),
		tags,
	];
	await assert.rejects(
		runMigrations(db, withGap, "1.0.2", async () => {}),
		{ message: "Migration 2 is below version 3 of the database." },
	);
	assert.deepEqual(tableNames(db), ["notes", "tags", "wandit_migrations"]);
});

test("the runner accepts a database ahead of the app", async (context) => {
	const db = memoryDatabase(context);
	const newer = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
	];
	await runMigrations(db, newer, "1.0.2", noBackup);
	// A rollback to the build that packs only migration 1.
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	assert.deepEqual(ledgerVersions(db), [1, 2]);
});

test("the runner rolls back every pending file when one fails", async (context) => {
	const db = memoryDatabase(context);
	const migrations = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
		migration(
			3,
			"broken",
			"CREATE TABLE files (name TEXT); SELECT nope FROM files;\nCREATE TABLE pins (x);",
		),
	];
	await assert.rejects(runMigrations(db, migrations, "1.0.1", noBackup), {
		message:
			"Migration 0003_broken.sql failed: Statement 2: no such column: nope",
	});
	// The files before the failed file are gone too.
	assert.deepEqual(ledgerVersions(db), []);
	assert.deepEqual(tableNames(db), ["wandit_migrations"]);
	assert.equal(db.isTransaction, false);
});

test("the runner runs a replacement at the place of its target", async (context) => {
	const db = memoryDatabase(context);
	const migrations = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", BROKEN_TAGS),
		migration(3, "index_tags", "CREATE INDEX tags_name ON tags (name);"),
		migration(4, "add_tags_fix", TAGS_FIX),
	];
	await runMigrations(db, migrations, "1.0.1", noBackup);
	assert.deepEqual(ledgerRows(db), [
		"1 applied",
		"2 replaced",
		"3 applied",
		"4 applied",
	]);
});

test("the runner skips a replacement when the database ran its target", async (context) => {
	const db = memoryDatabase(context);
	const tags = "CREATE TABLE tags (name TEXT NOT NULL);";
	const installed = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", tags),
	];
	await runMigrations(db, installed, "1.0.1", noBackup);
	await runMigrations(
		db,
		[...installed, migration(4, "add_tags_fix", TAGS_FIX)],
		"1.0.2",
		async () => {},
	);
	assert.deepEqual(ledgerRows(db), ["1 applied", "2 applied", "4 skipped"]);
});

test("the runner runs only the newest replacement", async (context) => {
	const db = memoryDatabase(context);
	const migrations = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", BROKEN_TAGS),
		// This older replacement holds a check that fails, so it must not run.
		migration(
			3,
			"add_tags_fix",
			"-- wandit:replaces 0002\nCREATE TABLE tags (name TEXT NOT NULL); SELECT 0;",
		),
		migration(4, "add_tags_fix_two", TAGS_FIX),
	];
	await runMigrations(db, migrations, "1.0.1", noBackup);
	assert.deepEqual(ledgerRows(db), [
		"1 applied",
		"2 replaced",
		"3 skipped",
		"4 applied",
	]);
});

test("the runner refuses a bad replacement group", async (context) => {
	const badLine =
		'has a bad "-- wandit:" line. Only line 1 may hold "-- wandit:replaces NNNN".';
	const cases = [
		[
			[migration(3, "fix", "-- wandit:replaces 0002\nSELECT 1;")],
			"Migration 3 replaces migration 2, which this build does not hold.",
		],
		[
			[
				migration(2, "fix", "-- wandit:replaces 0001\nSELECT 1;"),
				migration(3, "fix_two", "-- wandit:replaces 0002\nSELECT 1;"),
			],
			"Migration 3 replaces migration 2, which replaces another migration.",
		],
		[
			[migration(2, "fix", "-- wandit:replaces 0002\nSELECT 1;")],
			"Migration 2 replaces migration 2, which is not an earlier version.",
		],
		[
			[migration(2, "fix", "CREATE TABLE a (x);\n-- wandit:replaces 0001\n")],
			`Migration 0002_fix.sql ${badLine}`,
		],
		[
			[migration(2, "fix", "-- wandit:replaces 0000\nCREATE TABLE a (x);")],
			`Migration 0002_fix.sql ${badLine}`,
		],
		[
			[migration(2, "fix", "-- wandit:replaces 0001\r\nCREATE TABLE a (x);")],
			`Migration 0002_fix.sql ${badLine}`,
		],
	];
	for (const [files, message] of cases) {
		const db = memoryDatabase(context);
		const migrations = [migration(1, "init", NOTES), ...files];
		await assert.rejects(runMigrations(db, migrations, "1.0.1", noBackup), {
			message,
		});
		assert.deepEqual(ledgerVersions(db), [], message);
	}

	// An install with nothing pending still opens with a bad group.
	const db = memoryDatabase(context);
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	const missingTarget = migration(
		3,
		"fix",
		"-- wandit:replaces 0002\nSELECT 1;",
	);
	db.prepare(
		"INSERT INTO wandit_migrations VALUES (3, 'fix', ?, 'skipped', 'x', 'x')",
	).run(missingTarget.sha256);
	await runMigrations(
		db,
		[migration(1, "init", NOTES), missingTarget],
		"1.0.2",
		noBackup,
	);
});

test("the runner accepts only the integer 1 as a check", async (context) => {
	const cases = [
		["SELECT 1;", null],
		["SELECT 0;", "answered 0, not the integer 1"],
		["SELECT 1.0;", "answered 1 (REAL), not the integer 1"],
		["SELECT '1';", "answered '1', not the integer 1"],
		["SELECT NULL;", "answered NULL, not the integer 1"],
		["SELECT x'01';", "answered a BLOB, not the integer 1"],
		["SELECT 1, 1;", "answered 2 columns, not 1"],
		["SELECT 1 WHERE 0;", "answered no row"],
		["SELECT 1 UNION ALL SELECT 1;", "answered more than one row"],
	];
	for (const [sql, reason] of cases) {
		const db = memoryDatabase(context);
		const run = runMigrations(
			db,
			[migration(1, "check", sql)],
			"1.0.1",
			noBackup,
		);
		if (reason === null) {
			await run;
			assert.deepEqual(ledgerVersions(db), [1], sql);
		} else {
			await assert.rejects(run, {
				message: `Migration 0001_check.sql failed: Statement 1 is a check that ${reason}: ${sql}`,
			});
			assert.deepEqual(ledgerVersions(db), [], sql);
		}
	}
});

test("the runner keeps a write with RETURNING and a trigger body as one statement each", async (context) => {
	const db = memoryDatabase(context);
	const sql = [
		"CREATE TABLE log (body TEXT);",
		"CREATE TRIGGER notes_log AFTER INSERT ON notes BEGIN INSERT INTO log VALUES (new.body); SELECT 0; END;",
		// A write that answers columns is not a check.
		"INSERT INTO notes (body) VALUES ('a;b'), ('c') RETURNING id;",
		"SELECT (SELECT count(*) FROM log) = 2;",
	].join("\n");
	await runMigrations(
		db,
		[migration(1, "init", NOTES), migration(2, "log", sql)],
		"1.0.1",
		noBackup,
	);
	assert.deepEqual(ledgerVersions(db), [1, 2]);
});

test("the runner stops when the backup fails", async (context) => {
	const db = memoryDatabase(context);
	await runMigrations(db, [migration(1, "init", NOTES)], "1.0.1", noBackup);
	const migrations = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
	];
	await assert.rejects(
		runMigrations(db, migrations, "1.0.2", async () => {
			throw new Error("disk full");
		}),
		{ message: "The backup before the migration failed: disk full" },
	);
	assert.deepEqual(ledgerVersions(db), [1]);
	assert.deepEqual(tableNames(db), ["notes", "wandit_migrations"]);
});

test("a migration cannot write another file", async (context) => {
	const dir = testDir(context);
	for (const [name, sql] of [
		["attach", `ATTACH DATABASE '${path.join(dir, "attach.db")}' AS other;`],
		["vacuum", `VACUUM INTO '${path.join(dir, "vacuum.db")}';`],
	]) {
		const db = memoryDatabase(context);
		await assert.rejects(
			runMigrations(db, [migration(1, name, sql)], "1.0.1", noBackup),
			name,
		);
	}
	assert.deepEqual(fs.readdirSync(dir), []);
});

test("the ledger text equals the text of the Tauri shell", async (context) => {
	const rustFile = path.join(
		__dirname,
		"../../../desktop-shell/src-tauri/src/db.rs",
	);
	// CI holds only this shell. The repo holds both, and one export must open in both.
	if (!fs.existsSync(rustFile)) {
		context.skip("the Tauri shell is not next to this folder");
		return;
	}
	const rustText = /const CREATE_LEDGER_SQL: &str = "([^"]+)";/.exec(
		fs.readFileSync(rustFile, "utf8"),
	)[1];
	const db = memoryDatabase(context);
	await runMigrations(db, [], "1.0.1", noBackup);
	const { sql } = db
		.prepare("SELECT sql FROM sqlite_schema WHERE name = 'wandit_migrations'")
		.get();
	assert.equal(
		sql,
		rustText.replace("CREATE TABLE IF NOT EXISTS", "CREATE TABLE"),
	);
});

test("the statement rules refuse every statement off the rules", async (context) => {
	const connection = await appConnection(context);
	const refused = [
		"ATTACH DATABASE 'other.db' AS other",
		"PRAGMA foreign_keys = OFF",
		"CREATE TABLE extra (id INTEGER)",
		"CREATE TEMP TABLE scratch (id INTEGER)",
		"DROP TABLE notes",
		"ALTER TABLE notes ADD COLUMN extra TEXT",
		"INSERT INTO wandit_migrations VALUES (9, 'x', 'x', 'applied', 'x', 'x')",
		"DELETE FROM wandit_migrations",
		"UPDATE sqlite_sequence SET seq = 0",
		"BEGIN",
		"SAVEPOINT inner_step",
		"COMMIT",
		"VACUUM",
	];
	for (const sql of refused) {
		const error = commandError(() => connection.execute(sql, []));
		assert.equal(error.code, "statement_refused", `${sql}: ${error.message}`);
	}
	assert.deepEqual(ledgerVersions(connection.db), [1]);
});

test("VACUUM INTO writes no file", async (context) => {
	const connection = await appConnection(context);
	const target = path.join(testDir(context), "copy.db");
	assert.throws(() => connection.execute(`VACUUM INTO '${target}'`, []));
	assert.equal(fs.existsSync(target), false);
});

test("db_select refuses a write", async (context) => {
	const connection = await appConnection(context);
	const error = commandError(() =>
		connection.select("INSERT INTO notes (body) VALUES ('x') RETURNING id", []),
	);
	assert.equal(error.code, "statement_refused");
	assert.equal(
		error.message,
		"db_select runs only a statement that does not write. Use db_execute.",
	);
	const count = connection.select("SELECT COUNT(*) FROM notes", []).rows[0][0];
	assert.equal(count, 0);
});

test("rows of an AUTOINCREMENT table can be written", async (context) => {
	// SQLite writes `sqlite_sequence` itself. The statement rules must not refuse that write.
	const connection = await appConnection(context);
	assert.deepEqual(
		connection.execute("INSERT INTO notes (body) VALUES (?)", ["first"]),
		{ changes: 1, lastInsertRowId: 1 },
	);
	const update = connection.execute("UPDATE notes SET body = ? WHERE id = ?", [
		"edited",
		1,
	]);
	assert.equal(update.changes, 1);
	// A read answers 0 changes, also after a write.
	assert.deepEqual(connection.execute("SELECT * FROM notes", []), {
		changes: 0,
		lastInsertRowId: 1,
	});
	assert.equal(connection.execute("DELETE FROM notes", []).changes, 1);
});

test("db_batch is all or none", async (context) => {
	const connection = await appConnection(context);
	const statements = [
		{ sql: "INSERT INTO notes (body) VALUES ('a')", params: [] },
		{ sql: "INSERT INTO notes (body) VALUES (NULL)", params: [] },
	];
	const error = commandError(() => connection.batch(statements));
	assert.equal(error.code, "sql_error");
	assert.match(error.message, /^Statement 2: NOT NULL constraint failed/);
	assert.equal(
		connection.select("SELECT COUNT(*) FROM notes", []).rows[0][0],
		0,
	);
	assert.equal(connection.db.isTransaction, false);

	assert.deepEqual(connection.batch(statements.slice(0, 1)), {
		results: [{ changes: 1, lastInsertRowId: 1 }],
	});
});

test("a broken limit gives invalid_input", async (context) => {
	const connection = await appConnection(context);
	const cases = [
		[`SELECT '${"x".repeat(MAX_SQL_BYTES)}'`, []],
		["SELECT 1", new Array(MAX_PARAMS + 1).fill(1)],
		["SELECT 1; SELECT 2", []],
		// The second statement fails to prepare, but it is still a second statement.
		["SELECT 1; DROP TABLE notes", []],
		["  -- only a comment", []],
		[";;", []],
		["SELECT ?", []],
		["SELECT ?", [1, 2]],
		// ?1 used two times takes one param.
		["SELECT ?1, ?1", [1, 2]],
		["SELECT 1 \0 DROP TABLE notes", []],
	];
	for (const [sql, params] of cases) {
		const error = commandError(() => connection.execute(sql, params));
		assert.equal(
			error.code,
			"invalid_input",
			`${sql.slice(0, 40)}: ${error.message}`,
		);
	}
	const tooManyStatements = new Array(MAX_BATCH_STATEMENTS + 1).fill({
		sql: "SELECT 1",
		params: [],
	});
	assert.equal(
		commandError(() => connection.batch(tooManyStatements)).code,
		"invalid_input",
	);
	connection.execute("SELECT 1; -- a trailing comment", []);
});

test("db_select answers at most 10,000 rows", async (context) => {
	const connection = await appConnection(context);
	const rows = (count) =>
		`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ${count}) SELECT x FROM n`;
	assert.equal(
		connection.select(rows(MAX_SELECT_ROWS), []).rows.length,
		MAX_SELECT_ROWS,
	);
	const error = commandError(() =>
		connection.select(rows(MAX_SELECT_ROWS + 1), []),
	);
	assert.equal(error.code, "too_many_rows");
});

test("params map to SQLite values by their index", async (context) => {
	const connection = await appConnection(context);
	const typeOf = (param) =>
		connection.select("SELECT typeof(?), ?", [param, param]).rows[0];
	assert.deepEqual(typeOf(null), ["null", null]);
	assert.deepEqual(typeOf(true), ["integer", 1]);
	assert.deepEqual(typeOf(false), ["integer", 0]);
	assert.deepEqual(typeOf(-42), ["integer", -42]);
	assert.deepEqual(typeOf(Number.MAX_SAFE_INTEGER), [
		"integer",
		Number.MAX_SAFE_INTEGER,
	]);
	assert.deepEqual(typeOf(2 ** 53), ["real", 2 ** 53]);
	assert.deepEqual(typeOf(1.5), ["real", 1.5]);
	assert.deepEqual(typeOf("text"), ["text", "text"]);

	// Param N of the call is SQLite parameter N, for each form of a parameter.
	const forms = [
		["SELECT ?1, ?1", ["a"], ["a", "a"]],
		["SELECT ?2, ?1", ["a", "b"], ["b", "a"]],
		[
			"SELECT ?, :second, ?, :second, ?1",
			["a", "b", "c"],
			["a", "b", "c", "b", "a"],
		],
		[
			"SELECT @x, $y, ?, '?' || ':no' /* ? */ -- ?",
			["a", "b", "c"],
			["a", "b", "c", "?:no"],
		],
	];
	for (const [sql, params, row] of forms) {
		assert.deepEqual(connection.select(sql, params).rows, [row], sql);
	}
});

test("results map to the values of the page", async (context) => {
	const connection = await appConnection(context);
	assert.deepEqual(
		connection.select(
			"SELECT NULL AS a, 42 AS b, 1.5 AS c, 'text' AS d, 9007199254740993 AS e",
			[],
		),
		{
			columns: ["a", "b", "c", "d", "e"],
			rows: [[null, 42, 1.5, "text", 9007199254740992]],
		},
	);
	for (const sql of ["SELECT x'00'", "SELECT 9e999"]) {
		const error = commandError(() => connection.select(sql, []));
		assert.equal(error.code, "unsupported_value", sql);
	}
});
