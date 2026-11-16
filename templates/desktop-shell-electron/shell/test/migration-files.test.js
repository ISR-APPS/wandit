const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readMigrationFiles } = require("../src/db/migration-files.js");
const { testDir } = require("../testing/support.js");

test("the migrations folder gives its files sorted by version, with the hash of the bytes", (context) => {
	// The 2 hashes come from `shasum -a 256` of the same bytes.
	const dir = testDir(context);
	fs.writeFileSync(path.join(dir, "0010_add_tags.sql"), "SELECT 1;");
	fs.writeFileSync(path.join(dir, "0002_init.sql"), "CREATE TABLE a (x);\n");
	assert.deepEqual(readMigrationFiles(dir), [
		{
			version: 2,
			name: "init",
			sql: "CREATE TABLE a (x);\n",
			sha256:
				"7d862b9d7b6880c11d236645cb0091f2fa70c6157b8e83a2a9af420a96135098",
		},
		{
			version: 10,
			name: "add_tags",
			sql: "SELECT 1;",
			sha256:
				"17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
		},
	]);
});

test("the migrations folder refuses an entry that breaks a rule", (context) => {
	const cases = [
		["0000_init.sql", "does not match NNNN_snake_name.sql"],
		["1_init.sql", "does not match NNNN_snake_name.sql"],
		["0001_Init.sql", "does not match NNNN_snake_name.sql"],
		["0001_init.sql.bak", "does not match NNNN_snake_name.sql"],
		["0001_init.sql", "0001_init.sql is not UTF-8 text"],
	];
	for (const [name, reason] of cases) {
		const dir = testDir(context);
		// The byte 0xff is never valid in UTF-8.
		fs.writeFileSync(path.join(dir, name), Buffer.from([0x53, 0xff]));
		assert.throws(
			() => readMigrationFiles(dir),
			(error) => error.message.includes(reason),
			name,
		);
	}

	// A link could name a file outside the folder.
	const linked = testDir(context);
	const outside = path.join(testDir(context), "secret.sql");
	fs.writeFileSync(outside, "SELECT 1;");
	fs.symlinkSync(outside, path.join(linked, "0001_init.sql"));
	assert.throws(() => readMigrationFiles(linked), {
		message: "0001_init.sql is not a regular file",
	});

	// The app archive of a build with no SQL file holds no folder.
	assert.deepEqual(readMigrationFiles(path.join(linked, "missing")), []);
});
