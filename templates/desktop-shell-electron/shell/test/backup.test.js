const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { AppDatabase, selfTest } = require("../src/db/app-database.js");
const {
	checkImport,
	copyClosedDatabase,
	copyDatabase,
	lastBackupAt,
	writeBackup,
} = require("../src/db/backup.js");
const {
	openDatabase,
	openReadOnly,
	runMigrations,
} = require("../src/db/database.js");
const { dataPaths } = require("../src/paths.js");
const { appOptions, migration, testDir } = require("../testing/support.js");

const NOTES =
	"CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);";
const TAGS = "CREATE TABLE tags (name TEXT UNIQUE);";

// An exported file of an app that ran `migrations`, as File > Export data writes it.
async function exportedFile(dir, migrations) {
	const db = openDatabase(path.join(dir, "app.db"));
	await runMigrations(db, migrations, "1.0.1", async () => {});
	db.exec("INSERT INTO notes (body) VALUES ('saved')");
	const file = path.join(dir, "export.db");
	await copyDatabase(db, file);
	db.close();
	return file;
}

test("the import check accepts an export of the same app, also of an older build", async (context) => {
	const migrations = [
		migration(1, "init", NOTES),
		migration(2, "add_tags", TAGS),
	];
	const sameBuild = await exportedFile(testDir(context), migrations);
	await checkImport(sameBuild, migrations);
	// The runner migrates the older export after the swap.
	const olderBuild = await exportedFile(
		testDir(context),
		migrations.slice(0, 1),
	);
	await checkImport(olderBuild, migrations);
});

test("the import check runs the replacement for a backup that ran the replaced file", async (context) => {
	const dir = testDir(context);
	const db = openDatabase(path.join(dir, "app.db"));
	context.after(() => db.close());
	const init = migration(1, "init", NOTES);
	await runMigrations(db, [init], "1.0.1", async () => {});
	db.exec("INSERT INTO notes (body) VALUES ('saved')");
	// File 2 works here because note 1 exists. It fails on a new install.
	const seedPins = migration(
		2,
		"seed_pins",
		"CREATE TABLE pins (note_id INTEGER NOT NULL REFERENCES notes (id));\nINSERT OR IGNORE INTO pins VALUES (1);",
	);
	await runMigrations(db, [init, seedPins], "1.0.2", async () => {});
	const file = path.join(dir, "export.db");
	await copyDatabase(db, file);

	const seedPinsFix = migration(
		3,
		"seed_pins_fix",
		"-- wandit:replaces 0002\nCREATE TABLE pins (note_id INTEGER NOT NULL REFERENCES notes (id));\nINSERT OR IGNORE INTO pins SELECT id FROM notes;",
	);
	await checkImport(file, [init, seedPins, seedPinsFix]);
});

test("the import check refuses a file that is not an export of this app", async (context) => {
	const migrations = [migration(1, "init", NOTES)];

	const withTrigger = await exportedFile(testDir(context), migrations);
	const hostile = new DatabaseSync(withTrigger);
	hostile.exec(
		"CREATE TRIGGER wipe AFTER INSERT ON notes BEGIN DELETE FROM notes; END;",
	);
	hostile.close();
	await assert.rejects(checkImport(withTrigger, migrations), {
		message:
			"The tables, views, indexes, or triggers of the file differ from this app.",
	});

	const otherText = [
		migration(
			1,
			"init",
			"CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL, done INTEGER);",
		),
	];
	const otherApp = await exportedFile(testDir(context), migrations);
	await assert.rejects(checkImport(otherApp, otherText), {
		message: "Migration 1 of the file does not match this app.",
	});

	// A ledger that is a view could answer rows that match every packed file.
	const viewLedger = path.join(testDir(context), "view.db");
	const view = new DatabaseSync(viewLedger);
	view.exec(
		`CREATE VIEW wandit_migrations AS SELECT 1 AS version, '${migrations[0].sha256}' AS sha256`,
	);
	view.close();
	await assert.rejects(checkImport(viewLedger, migrations), {
		message: "The file holds no data of a desktop app.",
	});

	const notSqlite = path.join(testDir(context), "text.db");
	fs.writeFileSync(notSqlite, "x".repeat(4096));
	await assert.rejects(checkImport(notSqlite, migrations), {
		message: "The file is not an SQLite database.",
	});
});

test("the import swap replaces the data and keeps a backup", async (context) => {
	const options = appOptions(context, { "0001_init.sql": NOTES });
	const database = new AppDatabase(options);
	assert.deepEqual(await database.open(), { status: "ready" });
	context.after(() => {
		if (database.state.status === "ready") {
			database.state.connection.db.close();
		}
	});
	database.state.connection.execute("INSERT INTO notes (body) VALUES (?)", [
		"old",
	]);

	// The file of another install of the same app, with another row.
	const other = appOptions(context, { "0001_init.sql": NOTES });
	const otherDatabase = new AppDatabase(other);
	await otherDatabase.open();
	otherDatabase.state.connection.execute(
		"INSERT INTO notes (body) VALUES (?)",
		["new"],
	);
	const exported = path.join(path.dirname(other.migrationsDir), "export.db");
	await otherDatabase.handle({ type: "export_data", file: exported });
	otherDatabase.state.connection.db.close();

	const staged = await database.handle({
		type: "import_stage",
		file: exported,
	});
	await database.handle({ type: "import_replace", staged });

	assert.equal(database.state.status, "ready");
	assert.equal(fs.existsSync(staged), false);
	const read = () =>
		database.state.connection.select("SELECT body FROM notes", []).rows;
	assert.deepEqual(read(), [["new"]]);
	const backups = fs.readdirSync(options.paths.backupsDir);
	assert.equal(backups.length, 1);
	assert.match(backups[0], /^before-import-/);
	const backup = openReadOnly(path.join(options.paths.backupsDir, backups[0]));
	context.after(() => backup.close());
	assert.equal(backup.prepare("SELECT body FROM notes").get().body, "old");
});

test("a closed copy keeps the rows that are still in the WAL file", async (context) => {
	const dir = testDir(context);
	const dbFile = path.join(dir, "app.db");
	const db = openDatabase(dbFile);
	context.after(() => db.close());
	// No checkpoint: the writes stay in the WAL file, as after a crash of the app.
	db.exec("PRAGMA wal_autocheckpoint = 0");
	await runMigrations(
		db,
		[migration(1, "init", NOTES)],
		"1.0.1",
		async () => {},
	);
	db.exec("INSERT INTO notes (body) VALUES ('saved')");
	const backups = path.join(dir, "backups");
	copyClosedDatabase(dbFile, backups, {
		type: "before_update",
		version: "1.0.1",
	});

	const name = fs.readdirSync(backups).find((file) => file.endsWith(".db"));
	assert.match(name, /^before-update-1\.0\.1-/);
	const copy = openDatabase(path.join(backups, name));
	context.after(() => copy.close());
	assert.equal(copy.prepare("SELECT body FROM notes").get().body, "saved");
});

test("a closed copy stops when the check of the database file fails", (context) => {
	const dir = testDir(context);
	const notAFolder = path.join(dir, "data");
	fs.writeFileSync(notAFolder, "");
	// The parent is a file, so the check fails with ENOTDIR. It is not a missing file.
	assert.throws(
		() =>
			copyClosedDatabase(
				path.join(notAFolder, "app.db"),
				path.join(dir, "backups"),
				{ type: "before_import" },
			),
		/^Error: The database file is not readable: /,
	);
	// A missing file is not an error: a new install has no data to keep.
	copyClosedDatabase(path.join(dir, "app.db"), path.join(dir, "backups"), {
		type: "before_import",
	});
});

test("retention keeps 10 automatic backups and every manual backup", async (context) => {
	const dir = testDir(context);
	const stamp = (minute) =>
		`20261104T12${String(minute).padStart(2, "0")}00000Z`;
	for (let minute = 0; minute < 12; minute++) {
		fs.writeFileSync(path.join(dir, `before-1.0.1-${stamp(minute)}.db`), "");
	}
	fs.writeFileSync(path.join(dir, `manual-${stamp(0)}.db`), "");
	// A file that the shell did not write.
	fs.writeFileSync(path.join(dir, "before-notes.db"), "");
	const db = openDatabase(":memory:");
	context.after(() => db.close());
	const newest = await writeBackup(db, dir, { type: "before_import" });

	const expected = [
		// The 2 oldest of the 12 are gone, and one more for the backup of this test.
		...[3, 4, 5, 6, 7, 8, 9, 10, 11].map(
			(minute) => `before-1.0.1-${stamp(minute)}.db`,
		),
		path.basename(newest),
		"before-notes.db",
		`manual-${stamp(0)}.db`,
	].sort();
	assert.deepEqual(fs.readdirSync(dir).sort(), expected);
	const newestStamp = /-(\d{8}T\d{9}Z)\.db$/.exec(newest)[1];
	assert.equal(lastBackupAt(dir).replace(/[-:.]/g, ""), newestStamp);
});

// A fixed build must reach an app whose file does not open. A copy through a connection
// fails on that file, so the bytes are the backup.
test("the update backup copies the bytes of a file that does not open", async (context) => {
	const options = appOptions(context, { "0001_init.sql": NOTES });
	fs.mkdirSync(options.paths.dataDir, { recursive: true });
	const damaged = Buffer.alloc(4096, "x");
	fs.writeFileSync(options.paths.dbFile, damaged);
	const database = new AppDatabase(options);
	assert.equal((await database.open()).status, "failed");

	await database.handle({ type: "backup_before_update" });
	const [name] = fs.readdirSync(options.paths.backupsDir);
	assert.match(name, /^before-update-1\.0\.1-/);
	assert.deepEqual(
		fs.readFileSync(path.join(options.paths.backupsDir, name)),
		damaged,
	);
	// In this state each command of the page answers migration_failed.
	await assert.rejects(database.handle({ type: "app_info" }), {
		code: "migration_failed",
	});
});

// The runner must run before the statement rules: the rules refuse the ledger writes.
test("the self-test passes good files on a new database and names a bad file", async (context) => {
	const good = appOptions(context, {
		"0001_init.sql": NOTES,
		"0002_check.sql": "SELECT (SELECT count(*) FROM notes) = 0;",
	});
	assert.equal(await selfTest(good.paths, good.migrationsDir), 2);

	const bad = appOptions(context, {
		"0001_init.sql": NOTES,
		"0002_check.sql": "SELECT count(*) FROM notes;",
	});
	await assert.rejects(
		selfTest(dataPaths(testDir(context)), bad.migrationsDir),
		{
			message:
				"Migration 0002_check.sql failed: Statement 1 is a check that answered 0, not the integer 1: SELECT count(*) FROM notes;",
		},
	);
});
