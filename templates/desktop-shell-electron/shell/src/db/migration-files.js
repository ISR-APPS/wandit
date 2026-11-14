/**
 * Reads the SQL files of the packed `migrations/` folder and their replacement headers
 * (docs/v2/desktop-apps.md, section 5). app-database.js calls it at each start of the app.
 * The Tauri shell does the same work in build.rs and in `replaced_version` of db.rs.
 */

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

/**
 * @typedef {object} Migration
 * @property {number} version The 4-digit version of the file name, as a number from 1 to 9999.
 * @property {string} name The name part of the file name, for example `add_customers`.
 * @property {string} sql The UTF-8 text of the file. Line 1 can name a file that this file replaces.
 * @property {string} sha256 Lowercase hex SHA-256 of the exact file bytes. The ledger keeps it.
 */

/**
 * File name of one migration: `NNNN_snake_name.sql`. Group 1 is the version, group 2 is the name.
 * The same rule as `DESKTOP_MIGRATION_FILE_PATTERN` of packages/contracts.
 */
const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z][a-z0-9_]{0,59})\.sql$/;

/**
 * Line 1 of a replacement file. Group 1 is the version of its target.
 * The same rule as `DESKTOP_MIGRATION_REPLACES_PATTERN` of packages/contracts.
 */
const REPLACES_PATTERN = /^-- wandit:replaces (\d{4})\n/;

/** A line that starts with this text is a header line. Only line 1 may hold one. */
const MARKER_PREFIX = "-- wandit:";

/**
 * `0007_add_customers.sql`: the file name of a migration, for the error texts.
 * @param {Migration} migration
 */
function fileName(migration) {
	return `${String(migration.version).padStart(4, "0")}_${migration.name}.sql`;
}

/**
 * Makes a migration from the bytes of its file. Throws when the bytes are not UTF-8.
 * @param {number} version
 * @param {string} name
 * @param {Uint8Array} bytes The exact file bytes. The server gate checked the same bytes.
 * @returns {Migration}
 */
function migrationFromBytes(version, name, bytes) {
	// `fatal` refuses bad UTF-8. `ignoreBOM` keeps a byte order mark, so the text equals the bytes.
	const sql = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
		bytes,
	);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	return { version, name, sql, sha256 };
}

/**
 * Reads every file of `folder`, sorted by version. A missing folder gives no file.
 * Throws an Error with the reason when an entry breaks a rule: the name pattern with a version above 0,
 * a regular file, UTF-8 text, and one file per version.
 * @param {string} folder Absolute path of the packed `migrations/` folder.
 * @returns {Migration[]}
 */
function readMigrationFiles(folder) {
	let entries;
	try {
		entries = fs.readdirSync(folder, { withFileTypes: true });
	} catch (error) {
		// The app archive holds no empty folder, so a build with no SQL file has no folder here.
		// electron-builder.config.cjs stops a build whose input has no `migrations` folder.
		if (error.code === "ENOENT") {
			return [];
		}
		throw new Error(`The migrations folder is not readable: ${error.message}`, {
			cause: error,
		});
	}
	const migrations = [];
	for (const entry of entries) {
		const match = MIGRATION_FILE_PATTERN.exec(entry.name);
		const version = match === null ? 0 : Number(match[1]);
		if (match === null || version === 0) {
			throw new Error(
				`${entry.name} does not match NNNN_snake_name.sql with a version above 0`,
			);
		}
		// Security: a directory entry does not follow a symlink, so a link to another file fails here.
		if (!entry.isFile()) {
			throw new Error(`${entry.name} is not a regular file`);
		}
		let bytes;
		try {
			bytes = fs.readFileSync(path.join(folder, entry.name));
		} catch (error) {
			throw new Error(`cannot read ${entry.name}: ${error.message}`, {
				cause: error,
			});
		}
		try {
			migrations.push(migrationFromBytes(version, match[2], bytes));
		} catch (error) {
			throw new Error(`${entry.name} is not UTF-8 text`, { cause: error });
		}
	}
	migrations.sort((left, right) => left.version - right.version);
	for (let index = 1; index < migrations.length; index++) {
		if (migrations[index - 1].version === migrations[index].version) {
			throw new Error(
				`${fileName(migrations[index - 1])} and ${fileName(migrations[index])} have the same version`,
			);
		}
	}
	return migrations;
}

/**
 * Reads line 1 of a migration. Answers the target version of a replacement, or null for a
 * plain file. Throws an Error for a bad `-- wandit:` line: a typo, a CRLF, version 0000, or a
 * marker on a later line. The same rules as `parseDesktopMigrationHeader` of packages/contracts.
 * @param {Migration} migration
 * @returns {number | null}
 */
function replacedVersion(migration) {
	const match = REPLACES_PATTERN.exec(migration.sql);
	const body =
		match === null ? migration.sql : migration.sql.slice(match[0].length);
	const target = match === null ? null : Number(match[1]);
	const hasBadMarker = body
		.split("\n")
		.some((line) => line.startsWith(MARKER_PREFIX));
	if (hasBadMarker || target === 0) {
		throw new Error(
			`Migration ${fileName(migration)} has a bad "-- wandit:" line. Only line 1 may hold "-- wandit:replaces NNNN".`,
		);
	}
	return target;
}

/**
 * Step 6 of the runner: reads line 1 of every file and checks each replacement against its
 * target. Answers the target version of each file (null for a plain file), in the order of
 * `migrations`. Throws an Error with the reason for a bad group.
 * @param {Migration[]} migrations Sorted by version.
 * @returns {(number | null)[]}
 */
function readReplacementTargets(migrations) {
	const targets = migrations.map(replacedVersion);
	migrations.forEach((migration, index) => {
		const target = targets[index];
		if (target === null) {
			return;
		}
		const { version } = migration;
		const targetIndex = migrations.findIndex((file) => file.version === target);
		if (targetIndex === -1) {
			throw new Error(
				`Migration ${version} replaces migration ${target}, which this build does not hold.`,
			);
		}
		// Step 9 runs a replacement at the place of its target, so the target comes first.
		if (target >= version) {
			throw new Error(
				`Migration ${version} replaces migration ${target}, which is not an earlier version.`,
			);
		}
		// Step 9 looks for the replacements of a plain file only. A chain never runs.
		if (targets[targetIndex] !== null) {
			throw new Error(
				`Migration ${version} replaces migration ${target}, which replaces another migration.`,
			);
		}
	});
	return targets;
}

module.exports = {
	fileName,
	migrationFromBytes,
	readMigrationFiles,
	readReplacementTargets,
	replacedVersion,
};
