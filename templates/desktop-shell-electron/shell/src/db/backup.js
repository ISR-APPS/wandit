/**
 * Backups, export, and the import checks of the app database (docs/v2/desktop-apps.md, section 5).
 * app-database.js calls these for the File menu, the updater, and the migration runner.
 * A copy uses the SQLite online backup API of node:sqlite, so it is consistent while the app runs.
 * It is a port of backup.rs of the Tauri shell.
 */

const fs = require("node:fs");
const path = require("node:path");
const { backup } = require("node:sqlite");
const {
	openDatabase,
	openReadOnly,
	readLedger,
	runMigrations,
	sidecarPath,
} = require("./database.js");
const { replacedVersion } = require("./migration-files.js");

/** @typedef {import("node:sqlite").DatabaseSync} DatabaseSync */
/** @typedef {import("./migration-files.js").Migration} Migration */
/**
 * Why the shell writes a backup. The kind decides the file name.
 * `version` is the app version that migrates, or the installed version before an update.
 * @typedef {{ type: "before_migration", version: string }
 *   | { type: "before_update", version: string }
 *   | { type: "before_import" }
 *   | { type: "manual" }} BackupKind
 */

/** The shell keeps this many automatic backups. It never deletes a manual backup. */
const KEEP_AUTOMATIC_BACKUPS = 10;
/** Name prefix of every automatic backup. Retention deletes only files with this prefix. */
const AUTOMATIC_PREFIX = "before-";
const MANUAL_PREFIX = "manual-";
/** The first 16 bytes of every SQLite database file. */
const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "latin1");
/** The UTC time at the end of a backup file name, for example `-20261104T153012345Z.db`. */
const BACKUP_STAMP_PATTERN = /-(\d{8}T\d{9}Z)\.db$/;
// Pages of one backup step. The largest value copies the whole file in one step, so the copy
// reads one snapshot. node:sqlite refuses -1, which SQLite uses for "all pages".
const ALL_PAGES_PER_STEP = 2_147_483_647;

/**
 * @param {BackupKind} kind
 * @param {string} stamp A value of `utcStamp`.
 */
function backupFileName(kind, stamp) {
	switch (kind.type) {
		case "before_migration":
			return `${AUTOMATIC_PREFIX}${kind.version}-${stamp}.db`;
		case "before_update":
			return `${AUTOMATIC_PREFIX}update-${kind.version}-${stamp}.db`;
		case "before_import":
			return `${AUTOMATIC_PREFIX}import-${stamp}.db`;
		case "manual":
			return `${MANUAL_PREFIX}${stamp}.db`;
	}
}

/**
 * UTC time for a file name, for example `20261104T153012345Z`. It has milliseconds and no `:`,
 * because Windows refuses `:` in a name. The fixed width makes text order equal to time order.
 */
function utcStamp() {
	return new Date().toISOString().replace(/[-:.]/g, "");
}

// Reads the UTC time at the end of a backup file name. Answers null for a file that the
// shell did not write, so retention never deletes it.
function backupStamp(name) {
	return BACKUP_STAMP_PATTERN.exec(name)?.[1] ?? null;
}

// Deletes a file. A missing file is not an error.
function removeFileIfExists(file) {
	try {
		fs.rmSync(file, { force: true });
	} catch (error) {
		throw new Error(`${file} could not be deleted: ${error.message}`, {
			cause: error,
		});
	}
}

/**
 * Copies the main database of `db` into a new file with the online backup API.
 * Rejects with the reason. A partial copy does not stay.
 * @param {DatabaseSync} db
 * @param {string} destination Absolute path of a file that does not exist.
 */
async function copyDatabase(db, destination) {
	try {
		await backup(db, destination, { rate: ALL_PAGES_PER_STEP });
	} catch (error) {
		let message = `The copy failed: ${error.message}`;
		// A partial copy is not a backup.
		try {
			removeFileIfExists(destination);
		} catch (removeError) {
			message = `${message} ${removeError.message}`;
		}
		throw new Error(message, { cause: error });
	}
}

// Retention of section 5: keeps the 10 newest automatic backups. Manual backups and
// files that the shell did not write stay.
function pruneAutomaticBackups(backupsDir) {
	const automatic = fs
		.readdirSync(backupsDir)
		.filter((name) => name.startsWith(AUTOMATIC_PREFIX))
		.map((name) => ({ name, stamp: backupStamp(name) }))
		.filter((file) => file.stamp !== null)
		// Newest first. The stamps have a fixed width, so text order is time order.
		.sort((left, right) => (left.stamp < right.stamp ? 1 : -1));
	for (const { name } of automatic.slice(KEEP_AUTOMATIC_BACKUPS)) {
		const file = path.join(backupsDir, name);
		removeFileIfExists(file);
		removeFileIfExists(sidecarPath(file, "-wal"));
	}
}

// A failed cleanup keeps extra files. It never fails the backup that just succeeded.
function pruneAfterBackup(backupsDir) {
	try {
		pruneAutomaticBackups(backupsDir);
	} catch (error) {
		console.error(`Backup cleanup: ${error.message}`);
	}
}

// Makes the backups folder and answers the path of a new backup file of `kind`.
function newBackupPath(backupsDir, kind) {
	try {
		fs.mkdirSync(backupsDir, { recursive: true });
	} catch (error) {
		throw new Error(
			`The backup folder could not be created: ${error.message}`,
			{ cause: error },
		);
	}
	return path.join(backupsDir, backupFileName(kind, utcStamp()));
}

/**
 * Writes a full copy of the open database to the backups folder and answers its path.
 * After an automatic backup, it deletes the automatic backups beyond the 10 newest.
 * @param {DatabaseSync} db
 * @param {string} backupsDir
 * @param {BackupKind} kind
 * @returns {Promise<string>}
 */
async function writeBackup(db, backupsDir, kind) {
	const file = newBackupPath(backupsDir, kind);
	await copyDatabase(db, file);
	if (kind.type !== "manual") {
		pruneAfterBackup(backupsDir);
	}
	return file;
}

// True when `file` is there. `fs.existsSync` answers false for every error, for example no
// permission. Then an import or an update continues with no backup. So each other error throws.
function fileExists(file, label) {
	try {
		fs.statSync(file);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") {
			return false;
		}
		throw new Error(`The ${label} is not readable: ${error.message}`, {
			cause: error,
		});
	}
}

/**
 * The automatic backup before an import or an update in the `migration_failed` state.
 * No connection is open in that state. A plain copy of the file and of its WAL file is then complete.
 * Throws an Error when a file is not readable or a copy fails. The caller then stops its work.
 * @param {string} dbFile
 * @param {string} backupsDir
 * @param {BackupKind} kind
 */
function copyClosedDatabase(dbFile, backupsDir, kind) {
	// No file yet: nothing to keep.
	if (!fileExists(dbFile, "database file")) {
		return;
	}
	const target = newBackupPath(backupsDir, kind);
	try {
		fs.copyFileSync(dbFile, target);
	} catch (error) {
		throw new Error(`The copy failed: ${error.message}`, { cause: error });
	}
	const wal = sidecarPath(dbFile, "-wal");
	if (fileExists(wal, "WAL file")) {
		try {
			fs.copyFileSync(wal, sidecarPath(target, "-wal"));
		} catch (error) {
			throw new Error(`The copy of the WAL file failed: ${error.message}`, {
				cause: error,
			});
		}
	}
	pruneAfterBackup(backupsDir);
}

/**
 * UTC time of the newest backup, ISO 8601, for `app_info.lastBackupAt`. Null when the
 * folder has no backup yet. Throws an Error when the folder is not readable.
 * @param {string} backupsDir
 * @returns {string | null}
 */
function lastBackupAt(backupsDir) {
	let names;
	try {
		names = fs.readdirSync(backupsDir);
	} catch (error) {
		if (error.code === "ENOENT") {
			return null;
		}
		throw new Error(`The backup folder is not readable: ${error.message}`, {
			cause: error,
		});
	}
	const stamps = names
		.filter(
			(name) =>
				name.startsWith(AUTOMATIC_PREFIX) || name.startsWith(MANUAL_PREFIX),
		)
		.map(backupStamp)
		.filter((stamp) => stamp !== null)
		.sort();
	const newest = stamps.at(-1);
	if (newest === undefined) {
		return null;
	}
	// The pattern of `backupStamp` checked the 19 characters, so these ranges are valid.
	return `${newest.slice(0, 4)}-${newest.slice(4, 6)}-${newest.slice(6, 8)}T${newest.slice(9, 11)}:${newest.slice(11, 13)}:${newest.slice(13, 15)}.${newest.slice(15, 18)}Z`;
}

// The rows of `sqlite_schema` as one text per row. `rootpage` differs between files, so it
// is left out. `sql` is null for the automatic index of a UNIQUE constraint.
function readSchema(db) {
	return db
		.prepare(
			"SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
		)
		.all()
		.map((row) => JSON.stringify([row.type, row.name, row.tbl_name, row.sql]));
}

/**
 * The import checks of section 5. Rejects with the reason of a refusal.
 * Security: the file is untrusted, so the check opens it read-only with the safety settings.
 * It reads the ledger only after the schema shows that the ledger is a table, not a view.
 * The fresh run resolves each target to its newest replacement, as a new install does.
 * @param {string} file Absolute path of the copy that the import staged.
 * @param {Migration[]} migrations The packed files, sorted by version.
 */
async function checkImport(file, migrations) {
	const notSqlite = "The file is not an SQLite database.";
	const header = Buffer.alloc(SQLITE_HEADER.length);
	let readBytes = 0;
	try {
		const descriptor = fs.openSync(file, "r");
		try {
			readBytes = fs.readSync(descriptor, header, 0, header.length, 0);
		} finally {
			fs.closeSync(descriptor);
		}
	} catch (error) {
		throw new Error(notSqlite, { cause: error });
	}
	if (readBytes !== header.length || !header.equals(SQLITE_HEADER)) {
		throw new Error(notSqlite);
	}

	// Wraps one read of the untrusted file, so an SQLite error names the file as the cause.
	const read = (query) => {
		try {
			return query();
		} catch (error) {
			throw new Error(`The file could not be read: ${error.message}`, {
				cause: error,
			});
		}
	};
	const db = read(() => openReadOnly(file));
	let fresh;
	try {
		const integrity = read(() =>
			db
				.prepare("PRAGMA integrity_check")
				.all()
				.map((row) => row.integrity_check),
		);
		if (integrity.length !== 1 || integrity[0] !== "ok") {
			throw new Error(`The file is damaged: ${integrity[0] ?? "no answer"}`);
		}
		const ledgerKind = read(
			() =>
				db
					.prepare(
						"SELECT type FROM sqlite_schema WHERE name = 'wandit_migrations'",
					)
					.get()?.type,
		);
		if (ledgerKind !== "table") {
			throw new Error("The file holds no data of a desktop app.");
		}
		const applied = read(() => readLedger(db));
		for (const { version, sha256 } of applied) {
			const matches = migrations.some(
				(migration) =>
					migration.version === version && migration.sha256 === sha256,
			);
			if (!matches) {
				throw new Error(
					`Migration ${version} of the file does not match this app.`,
				);
			}
		}
		// Every ledger row matches a packed file, so equal counts mean equal version sets.
		const highest = applied.at(-1)?.version ?? 0;
		const expectedCount = migrations.filter(
			(migration) => migration.version <= highest,
		).length;
		if (expectedCount !== applied.length) {
			throw new Error("The file misses a migration of this app.");
		}

		// Same `sqlite_schema` rows as a fresh database at the same version: no extra
		// table, column, index, view, or trigger.
		// A new install runs a replacement in place of its target, also above `highest`.
		// The gate proves that both make the same schema.
		const freshMigrations = migrations.filter(
			(migration) =>
				(replacedVersion(migration) ?? migration.version) <= highest,
		);
		fresh = read(() => openDatabase(":memory:"));
		// The ledger of `fresh` is empty, so the runner never asks for a backup.
		await runMigrations(fresh, freshMigrations, "import-check", async () => {});
		const fileSchema = read(() => readSchema(db));
		const freshSchema = read(() => readSchema(fresh));
		const isSameSchema =
			fileSchema.length === freshSchema.length &&
			fileSchema.every((row, index) => row === freshSchema[index]);
		if (!isSameSchema) {
			throw new Error(
				"The tables, views, indexes, or triggers of the file differ from this app.",
			);
		}
	} finally {
		db.close();
		fresh?.close();
	}
}

/**
 * Copies the chosen file into the data folder and checks the copy. The checked bytes are
 * then the imported bytes, also when the original file changes after the check.
 * Answers the path of the staged copy. Rejects with the reason, and then no copy stays.
 * @param {string} source Absolute path from the Open dialog of the main process.
 * @param {string} dataDir The data folder, so the later swap is a rename on one disk.
 * @param {Migration[]} migrations The packed files, sorted by version.
 * @returns {Promise<string>}
 */
async function stageImport(source, dataDir, migrations) {
	const staged = path.join(dataDir, `import-${utcStamp()}.tmp`);
	// A read-only open of a WAL-mode file can leave these two files next to the copy.
	const sidecars = [sidecarPath(staged, "-wal"), sidecarPath(staged, "-shm")];
	try {
		try {
			fs.copyFileSync(source, staged);
		} catch (error) {
			throw new Error(`The file could not be read: ${error.message}`, {
				cause: error,
			});
		}
		await checkImport(staged, migrations);
		sidecars.forEach(removeFileIfExists);
		return staged;
	} catch (error) {
		let message = error.message;
		for (const file of [staged, ...sidecars]) {
			try {
				removeFileIfExists(file);
			} catch (removeError) {
				message = `${message} ${removeError.message}`;
			}
		}
		throw new Error(message, { cause: error });
	}
}

module.exports = {
	checkImport,
	copyClosedDatabase,
	copyDatabase,
	lastBackupAt,
	removeFileIfExists,
	stageImport,
	writeBackup,
};
