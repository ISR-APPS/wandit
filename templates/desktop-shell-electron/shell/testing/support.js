/**
 * Helpers of the tests: a migration from an SQL text, and a new temp folder.
 * Every `*.test.js` file of this folder uses it.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { migrationFromBytes } = require("../src/db/migration-files.js");
const { dataPaths } = require("../src/paths.js");

/**
 * A migration with the SHA-256 that the shell reads for a file with the text `sql`.
 * @param {number} version
 * @param {string} name
 * @param {string} sql
 */
function migration(version, name, sql) {
	return migrationFromBytes(version, name, Buffer.from(sql, "utf8"));
}

/**
 * A new empty folder under the system temp folder. The test deletes it at its end.
 * @param {import("node:test").TestContext} test The folder goes away after this test.
 * @returns {string}
 */
function testDir(test) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wandit-shell-test-"));
	test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

/**
 * Writes `files` into a new `migrations` folder and answers the open options of an app
 * that uses a new data folder.
 * @param {import("node:test").TestContext} test
 * @param {Record<string, string>} files File name to SQL text.
 */
function appOptions(test, files) {
	const dir = testDir(test);
	const migrationsDir = path.join(dir, "migrations");
	fs.mkdirSync(migrationsDir);
	for (const [name, sql] of Object.entries(files)) {
		fs.writeFileSync(path.join(migrationsDir, name), sql);
	}
	return { paths: dataPaths(dir), migrationsDir, appVersion: "1.0.1" };
}

module.exports = { appOptions, migration, testDir };
