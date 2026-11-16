/**
 * The state of the app database and every job on it (docs/v2/desktop-apps.md, section 5).
 * worker.js owns one `AppDatabase` in the database process and gives it each request of
 * client.js. main.js calls `selfTest` for the CI. It calls database.js and backup.js.
 */

const fs = require("node:fs");
const {
	copyClosedDatabase,
	copyDatabase,
	lastBackupAt,
	removeFileIfExists,
	stageImport,
	writeBackup,
} = require("./backup.js");
const {
	AppConnection,
	openDatabase,
	openReadOnly,
	runMigrations,
	sidecarPath,
} = require("./database.js");
const { DbError } = require("./db-error.js");
const { readMigrationFiles } = require("./migration-files.js");

/** @typedef {import("./migration-files.js").Migration} Migration */
/**
 * @typedef {object} OpenOptions
 * @property {{ dataDir: string, dbFile: string, backupsDir: string }} paths The data files, from paths.js.
 * @property {string} migrationsDir Absolute path of the packed `migrations/` folder.
 * @property {string} appVersion Semver of the installed app, from wandit.desktop.json.
 */
/**
 * State of the app database. `failed`: the file did not open or migrate, and no connection
 * to it is open. The commands then answer `migration_failed` with `reason`.
 * @typedef {{ status: "ready", connection: AppConnection } | { status: "failed", reason: string }} DatabaseState
 */
/**
 * One request of client.js. `type` names the job. The other keys are its arguments.
 * @typedef {{ type: "db_select" | "db_execute", sql: string, params: import("./database.js").SqlParam[] }
 *   | { type: "db_batch", statements: { sql: string, params: import("./database.js").SqlParam[] }[] }
 *   | { type: "app_info" | "backup_now" | "backup_before_update" }
 *   | { type: "export_data" | "import_stage", file: string }
 *   | { type: "import_discard" | "import_replace", staged: string }} DatabaseRequest
 */

/** `app_version` of the self-test ledger rows. The temp database is deleted at the end. */
const SELF_TEST_APP_VERSION = "self-test";

// The start path of the database: opens the file, runs the runner (section 5, steps 1 to 10),
// and then installs the statement rules. Rejects with the reason, and then no connection stays open.
async function openMigratedConnection(paths, migrations, appVersion) {
	try {
		fs.mkdirSync(paths.dataDir, { recursive: true });
	} catch (error) {
		throw new Error(`The data folder could not be created: ${error.message}`, {
			cause: error,
		});
	}
	let db;
	try {
		db = openDatabase(paths.dbFile);
	} catch (error) {
		throw new Error(`The database did not open: ${error.message}`, {
			cause: error,
		});
	}
	try {
		await runMigrations(db, migrations, appVersion, async () => {
			await writeBackup(db, paths.backupsDir, {
				type: "before_migration",
				version: appVersion,
			});
		});
		return new AppConnection(db);
	} catch (error) {
		db.close();
		throw error;
	}
}

/**
 * The CI self-test (section 9). Runs the start path of the app on a new database in
 * `paths`: the runner, then the statement rules. A new database has every file pending, so
 * the runner also checks each replacement group. Answers the count of migrations.
 * Rejects with the reason. The connection closes before the caller deletes the folder.
 * @param {OpenOptions["paths"]} paths Paths inside a new temp folder.
 * @param {string} migrationsDir
 * @returns {Promise<number>}
 */
async function selfTest(paths, migrationsDir) {
	const migrations = readMigrationFiles(migrationsDir);
	const connection = await openMigratedConnection(
		paths,
		migrations,
		SELF_TEST_APP_VERSION,
	);
	connection.db.close();
	return migrations.length;
}

/** The app database of one process. client.js sends it one request at a time. */
class AppDatabase {
	/** @param {OpenOptions} options */
	constructor({ paths, migrationsDir, appVersion }) {
		this.paths = paths;
		this.migrationsDir = migrationsDir;
		this.appVersion = appVersion;
		/** @type {DatabaseState} */
		this.state = { status: "failed", reason: "The database is not open." };
	}

	/**
	 * Opens and migrates the database file. It never rejects: a failure gives the `failed`
	 * state, so the app still starts and the update check still runs.
	 * @returns {Promise<{ status: "ready" } | { status: "failed", reason: string }>}
	 */
	async open() {
		try {
			const migrations = readMigrationFiles(this.migrationsDir);
			const connection = await openMigratedConnection(
				this.paths,
				migrations,
				this.appVersion,
			);
			this.state = { status: "ready", connection };
			return { status: "ready" };
		} catch (error) {
			this.state = { status: "failed", reason: error.message };
			return this.state;
		}
	}

	// Runs a command body of the page with the open connection, or throws `migration_failed`.
	runCommand(body) {
		if (this.state.status === "failed") {
			throw new DbError("migration_failed", this.state.reason);
		}
		return body(this.state.connection);
	}

	// Runs a menu action with the open connection. Throws the reason when the database did not open.
	withConnection(action) {
		if (this.state.status === "failed") {
			throw new Error(`The data is not available. ${this.state.reason}`);
		}
		return action(this.state.connection);
	}

	/**
	 * Runs one request and answers its value. Throws a DbError for a command of the page,
	 * and an Error with a text for the user for a menu or updater job.
	 * @param {DatabaseRequest} request
	 */
	async handle(request) {
		const { paths } = this;
		switch (request.type) {
			case "db_select":
				return this.runCommand((connection) =>
					connection.select(request.sql, request.params),
				);
			case "db_execute":
				return this.runCommand((connection) =>
					connection.execute(request.sql, request.params),
				);
			case "db_batch":
				return this.runCommand((connection) =>
					connection.batch(request.statements),
				);
			case "app_info":
				return this.runCommand((connection) => {
					let lastBackup;
					try {
						lastBackup = lastBackupAt(paths.backupsDir);
					} catch (error) {
						throw new DbError("sql_error", error.message);
					}
					return connection.appInfo(paths.dbFile, this.appVersion, lastBackup);
				});
			// File > Back up now. Answers the path of the new file.
			case "backup_now":
				return this.withConnection((connection) =>
					writeBackup(connection.db, paths.backupsDir, { type: "manual" }),
				);
			// File > Export data...: `file` comes from the Save dialog of the main process.
			case "export_data":
				return this.withConnection(async (connection) => {
					// The Save dialog already asked to replace an old file.
					// The backup API cannot write over a file that is not an SQLite database.
					removeFileIfExists(request.file);
					await copyDatabase(connection.db, request.file);
					return request.file;
				});
			// File > Import data..., step 1: `file` comes from the Open dialog. Answers the staged copy.
			case "import_stage":
				return stageImport(
					request.file,
					paths.dataDir,
					readMigrationFiles(this.migrationsDir),
				);
			// The user canceled the import. A left-over copy only takes disk space.
			case "import_discard":
				return removeFileIfExists(request.staged);
			case "import_replace":
				return this.importStagedFile(request.staged);
			case "backup_before_update":
				return this.backupBeforeUpdate();
			default:
				throw new Error("The database process does not know this request.");
		}
	}

	// File > Import data..., step 2. After a swap the staged file is gone. After a failure it
	// is still there, so this deletes it.
	async importStagedFile(staged) {
		let failure = null;
		try {
			await this.replaceDatabase(staged);
		} catch (error) {
			failure = error;
		}
		try {
			removeFileIfExists(staged);
		} catch (error) {
			failure ??= error;
		}
		if (failure !== null) {
			throw failure;
		}
	}

	/**
	 * Puts the staged file in place of the app database. The steps are a backup, a clean close,
	 * an atomic rename, a reopen, and the runner. client.js sends no other request during these
	 * steps, so no command runs on a half-swapped file. Rejects with a text for the user.
	 * @param {string} staged Path of a copy that `stageImport` checked.
	 */
	async replaceDatabase(staged) {
		const { paths } = this;
		const kind = { type: "before_import" };
		try {
			if (this.state.status === "ready") {
				await writeBackup(this.state.connection.db, paths.backupsDir, kind);
			} else {
				copyClosedDatabase(paths.dbFile, paths.backupsDir, kind);
			}
		} catch (error) {
			throw new Error(
				`The backup before the import failed. Your data is unchanged. ${error.message}`,
				{ cause: error },
			);
		}
		const previous = this.state;
		this.state = { status: "failed", reason: "The import is in progress." };
		if (previous.status === "ready") {
			try {
				// Closing the last connection writes the WAL into the file and deletes the WAL.
				previous.connection.db.close();
			} catch (error) {
				this.state = previous;
				throw new Error(
					`The database did not close. Your data is unchanged. ${error.message}`,
					{ cause: error },
				);
			}
		}
		let swapFailure = null;
		try {
			// A WAL file of the old database would be applied to the new file and damage it. The
			// backup before the swap holds every committed row, also the rows still in the WAL.
			removeFileIfExists(sidecarPath(paths.dbFile, "-wal"));
			removeFileIfExists(sidecarPath(paths.dbFile, "-shm"));
			try {
				fs.renameSync(staged, paths.dbFile);
			} catch (error) {
				throw new Error(
					`The file could not be moved in place. Your data is unchanged. ${error.message}`,
					{ cause: error },
				);
			}
		} catch (error) {
			swapFailure = error;
		}
		// After a failed swap this reopens the old file, which is still in place.
		await this.open();
		if (swapFailure !== null) {
			throw swapFailure;
		}
		if (this.state.status === "failed") {
			throw new Error(
				`The data of the file is in place, but it did not open. The backup before the import keeps the earlier data. ${this.state.reason}`,
			);
		}
	}

	/**
	 * Writes `before-update-<installed version>-<UTC time>.db` (section 5). A rejection stops
	 * the update. The copy first uses its own read-only connection. WAL gives that connection
	 * the last commit. When that copy fails, the copy of the app connection follows. In the
	 * `failed` state, the bytes of the closed file are the backup, so a fixed build still installs.
	 */
	async backupBeforeUpdate() {
		const { paths } = this;
		const kind = { type: "before_update", version: this.appVersion };
		try {
			let own;
			try {
				own = openReadOnly(paths.dbFile);
			} catch (error) {
				throw new Error(`The database did not open: ${error.message}`, {
					cause: error,
				});
			}
			try {
				await writeBackup(own, paths.backupsDir, kind);
			} finally {
				own.close();
			}
		} catch (ownError) {
			console.error(
				`Update backup through its own connection: ${ownError.message}`,
			);
			try {
				if (this.state.status === "ready") {
					await writeBackup(this.state.connection.db, paths.backupsDir, kind);
				} else {
					copyClosedDatabase(paths.dbFile, paths.backupsDir, kind);
				}
			} catch (error) {
				throw new Error(
					`The backup before the update failed, so the update did not start. ${error.message}`,
					{ cause: error },
				);
			}
		}
	}
}

module.exports = { AppDatabase, selfTest };
