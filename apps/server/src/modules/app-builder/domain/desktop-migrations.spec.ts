import { describe, expect, it } from "vitest";

import {
	classifyDesktopMigrationStatement,
	type DesktopSchema,
	desktopGateFinding,
	findDesktopMigrationRefusal,
	findRemovedDesktopSchema,
	planDesktopMigrations,
	sha256OfMigration,
} from "./desktop-migrations";

describe("classifyDesktopMigrationStatement", () => {
	it.each([
		["CREATE TABLE customers (id INTEGER PRIMARY KEY)", "schema"],
		["create table if not exists main.t (x)", "schema"],
		["CREATE INDEX i ON t (x)", "schema"],
		["CREATE VIEW v AS SELECT 1", "schema"],
		["CREATE TRIGGER g AFTER INSERT ON t BEGIN DELETE FROM u; END", "schema"],
		['ALTER TABLE "My Table" ADD COLUMN note TEXT', "add_column"],
		["DROP INDEX IF EXISTS i", "schema"],
		["DROP TRIGGER g", "schema"],
		["INSERT OR IGNORE INTO t (x) VALUES ('do update')", "insert"],
		["INSERT OR IGNORE INTO t VALUES (1) ON CONFLICT DO NOTHING", "insert"],
		["CREATE TEMP TABLE t (x)", "refused"],
		["CREATE VIRTUAL TABLE t USING fts5(x)", "refused"],
		["CREATE TABLE IF NOT EXISTS t AS SELECT 1", "refused"],
		["ALTER TABLE t RENAME TO u", "refused"],
		["ALTER TABLE t DROP COLUMN x", "refused"],
		["-- a comment\nDROP TABLE t", "refused"],
		["DROP VIEW v", "refused"],
		["DELETE FROM t", "refused"],
		["PRAGMA writable_schema = ON", "refused"],
		["ATTACH 'x.db' AS x", "refused"],
		["VACUUM", "refused"],
		["BEGIN", "refused"],
		["WITH c AS (SELECT 1) UPDATE t SET x = 1", "refused"],
		["INSERT OR REPLACE INTO t VALUES (1)", "refused"],
		["REPLACE INTO t VALUES (1)", "refused"],
		["INSERT INTO t VALUES (1) ON CONFLICT (x) DO UPDATE SET y = 2", "refused"],
		["UPDATE OR REPLACE t SET x = 1", "refused"],
		['INSERT INTO "WANDIT_MIGRATIONS" VALUES (1)', "refused"],
		[
			"CREATE TRIGGER g AFTER INSERT ON t BEGIN DELETE FROM [wandit_migrations]; END",
			"refused",
		],
		[
			"CREATE TRIGGER g AFTER INSERT ON t BEGIN DELETE FROM 'wandit_migrations'; END",
			"refused",
		],
		["INSERT INTO t (x) VALUES (1)", "refused"],
		["INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING", "refused"],
		["UPDATE t SET x = 1", "refused"],
		[
			"UPDATE OR IGNORE t SET f = 1 IS NOT DISTINCT FROM 1, name = 'x'",
			"refused",
		],
		["SELECT count(*) = 1 FROM t", "check"],
		[
			"INSERT OR IGNORE INTO t SELECT * FROM (WITH c AS (SELECT 1) SELECT * FROM c)",
			"refused",
		],
		["CREATE INDEX i ON t (floor(x))", "refused"],
		["CREATE TABLE floor (x)", "schema"],
		["INSERT OR IGNORE INTO main.floor (x) VALUES (1)", "insert"],
		["CREATE INDEX i ON floor (x)", "schema"],
		["CREATE UNIQUE INDEX i ON floor (x)", "unique_index"],
		[
			"INSERT OR IGNORE INTO pairs (a, b) SELECT x.v, y.v FROM x JOIN y ON floor(x.v) = y.v",
			"refused",
		],
		["SELECT (SELECT count(*) FROM sqlite_schema) = 2", "refused"],
	])("sorts %j as %s", (sql, kind) => {
		expect(classifyDesktopMigrationStatement(sql).kind).toBe(kind);
	});

	it.each([
		[
			'UPDATE OR IGNORE t SET a = 1, (b, "C") = (SELECT 2, 3) WHERE x = (1)',
			{ columns: ["a", "b", "c"], kind: "update", table: "t" },
		],
		[
			"UPDATE OR IGNORE main.\"Stock\" AS s SET qty = (SELECT count(*) FROM u WHERE u.id = s.id), note = 'a, b = c' FROM w RETURNING *",
			{ columns: ["qty", "note"], kind: "update", table: "stock" },
		],
		[
			"UPDATE OR IGNORE t SET returning = 1",
			{ columns: ["returning"], kind: "update", table: "t" },
		],
		[
			"UPDATE OR IGNORE 'Stock' SET label = 'z', 'qty' = 6",
			{ columns: ["label", "qty"], kind: "update", table: "stock" },
		],
		[
			'UPDATE OR IGNORE stock SET label = ")", qty = 7',
			{ columns: ["label", "qty"], kind: "update", table: "stock" },
		],
		[
			'CREATE UNIQUE INDEX IF NOT EXISTS main."On" ON "Stock" (sku)',
			{ kind: "unique_index", table: "stock" },
		],
		[
			"create unique index i on [Orders] (x) where x > 0",
			{ kind: "unique_index", table: "orders" },
		],
		[
			"CREATE UNIQUE INDEX i ON 'Stock' (x)",
			{ kind: "unique_index", table: "stock" },
		],
		[
			'ALTER TABLE main."Stock" ADD note TEXT',
			{ kind: "add_column", table: "stock" },
		],
	])("reads the table and the columns of %j", (sql, statement) => {
		expect(classifyDesktopMigrationStatement(sql)).toEqual(statement);
	});
});

describe("desktopGateFinding", () => {
	it("never cuts the message between the two halves of an emoji", () => {
		const finding = desktopGateFinding(
			"migration_check_failed",
			"migrations/0002_next.sql",
			`${"a".repeat(499)}😀b`,
		);

		expect(finding.message).toBe("a".repeat(499));
	});
});

describe("findDesktopMigrationRefusal", () => {
	const releasedSchema: DesktopSchema = new Map([
		["stock", new Set(["id", "qty"])],
	]);

	it("refuses an UPDATE of a saved column and accepts one of a new column", () => {
		const changesSaved = classifyDesktopMigrationStatement(
			"UPDATE OR IGNORE Stock SET qty = 0, label = 'x'",
		);
		const fillsNew = classifyDesktopMigrationStatement(
			"UPDATE OR IGNORE stock SET label = 'x' WHERE qty > 0",
		);

		expect(findDesktopMigrationRefusal(changesSaved, releasedSchema)).toContain(
			"stock (qty)",
		);
		expect(findDesktopMigrationRefusal(fillsNew, releasedSchema)).toBeNull();
	});

	it("refuses a UNIQUE index on a built table and accepts one on a new table", () => {
		const onBuilt = classifyDesktopMigrationStatement(
			"CREATE UNIQUE INDEX stock_sku ON Stock (sku)",
		);
		const onNew = classifyDesktopMigrationStatement(
			"CREATE UNIQUE INDEX orders_ref ON orders (ref)",
		);

		expect(findDesktopMigrationRefusal(onBuilt, releasedSchema)).toContain(
			"CREATE UNIQUE INDEX on stock can fail",
		);
		expect(findDesktopMigrationRefusal(onNew, releasedSchema)).toBeNull();
	});
});

describe("findRemovedDesktopSchema", () => {
	it("lists each built table and column that is gone", () => {
		const built: DesktopSchema = new Map([
			["stock", new Set(["id", "qty"])],
			["orders", new Set(["id"])],
		]);
		const current: DesktopSchema = new Map([["stock", new Set(["id"])]]);

		expect(
			findRemovedDesktopSchema(built, current).map((f) => f.message),
		).toEqual([
			"The column stock.qty of an earlier build is gone.",
			"The table or view orders of an earlier build is gone.",
		]);
	});
});

describe("planDesktopMigrations", () => {
	const init = "CREATE TABLE stock (id INTEGER PRIMARY KEY);";
	const released = [
		{ name: "init", sha256: sha256OfMigration(init), version: 1 },
		{ name: "add_qty", sha256: sha256OfMigration("x"), version: 2 },
		{ name: "add_orders", sha256: sha256OfMigration("y"), version: 3 },
	];

	it("accepts the built files unchanged and a new file above them", () => {
		const plan = planDesktopMigrations(
			[
				{ fileName: "0004_add_notes.sql", sql: "ALTER TABLE stock ADD note;" },
				{ fileName: "0001_init.sql", sql: init },
				{ fileName: "0002_add_qty.sql", sql: "x" },
				{ fileName: "0003_add_orders.sql", sql: "y" },
			],
			released,
		);

		expect(plan.findings).toEqual([]);
		expect(plan.migrations.map((m) => [m.fileName, m.isReleased])).toEqual([
			["0001_init.sql", true],
			["0002_add_qty.sql", true],
			["0003_add_orders.sql", true],
			["0004_add_notes.sql", false],
		]);
	});

	it("finds a bad name, a duplicate, a changed or missing built file, and a low version", () => {
		const plan = planDesktopMigrations(
			[
				{ fileName: "0001_init.sql", sql: `${init}\n` },
				{ fileName: "0003_late.sql", sql: "z" },
				{ fileName: "0003_add_orders.sql", sql: "y" },
				{ fileName: "notes.md", sql: "" },
				{ fileName: "0000_zero.sql", sql: "" },
			],
			released,
		);

		expect(plan.findings.map((f) => [f.rule, f.path])).toEqual([
			["migration_name_invalid", "migrations/0000_zero.sql"],
			["migration_duplicate_version", "migrations/0003_late.sql"],
			["migration_name_invalid", "migrations/notes.md"],
			["migration_released_changed", "migrations/0001_init.sql"],
			["migration_released_missing", "migrations/0002_add_qty.sql"],
		]);
	});

	it("finds a new file that fills a gap below the last built version", () => {
		const plan = planDesktopMigrations(
			[
				{ fileName: "0001_init.sql", sql: init },
				{ fileName: "0002_late.sql", sql: "z" },
				{ fileName: "0003_add_orders.sql", sql: "y" },
			],
			released.filter((row) => row.version !== 2),
		);

		expect(plan.findings.map((f) => [f.rule, f.path])).toEqual([
			["migration_version_order", "migrations/0002_late.sql"],
		]);
	});

	const initFix = `-- wandit:replaces 0001\n${init}`;
	const replacementFolder = [
		{ fileName: "0001_init.sql", sql: init },
		{ fileName: "0002_init_fix.sql", sql: initFix },
		{ fileName: "0003_new.sql", sql: "CREATE TABLE notes (id INTEGER);" },
	];
	const replacementReleased = [
		{ name: "init", sha256: sha256OfMigration(init), version: 1 },
		{ name: "init_fix", sha256: sha256OfMigration(initFix), version: 2 },
	];

	it.each([
		["-- wandit:replaces 0001\nCREATE TABLE x (a);", [], 1],
		[
			"-- wandit:replaces 0000\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			null,
		],
		[
			"-- wandit:replace 0001\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			null,
		],
		[
			"-- wandit:replaces 0001\r\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			null,
		],
		[
			"CREATE TABLE x (a);\n-- wandit:replaces 0001\n",
			["migration_replaces_invalid"],
			null,
		],
		[
			"-- wandit:replaces 0009\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			9,
		],
		[
			"-- wandit:replaces 0003\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			3,
		],
		[
			"-- wandit:replaces 0002\nCREATE TABLE x (a);",
			["migration_replaces_invalid"],
			2,
		],
	])("checks the header and the target of %j", (sql, rules, replaces) => {
		const plan = planDesktopMigrations(
			[...replacementFolder, { fileName: "0004_next.sql", sql }],
			replacementReleased,
		);

		expect(plan.findings.map((f) => f.rule)).toEqual(rules);
		expect(plan.migrations.at(-1)?.replaces).toBe(replaces);
	});
});
