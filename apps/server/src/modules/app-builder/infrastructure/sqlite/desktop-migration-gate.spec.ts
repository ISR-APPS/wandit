import { describe, expect, it } from "vitest";

import {
	type DesktopMigrationFile,
	sha256OfMigration,
} from "../../domain/desktop-migrations";
import { checkDesktopMigrations } from "./desktop-migration-gate";

// The trigger refuses every insert. The test rows still reach the
// table only when the gate drops the triggers first.
const init = `CREATE TABLE stock (id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK (name <> 'x'), qty INTEGER NOT NULL);
CREATE TRIGGER stock_guard AFTER INSERT ON stock BEGIN SELECT RAISE(ABORT, 'no inserts'); END;`;
const builtFiles = [{ fileName: "0001_init.sql", sql: init }];
const released = [
	{ name: "init", sha256: sha256OfMigration(init), version: 1 },
];

function checkWithNewMigration(sql: string) {
	return checkDesktopMigrations(
		[...builtFiles, { fileName: "0002_next.sql", sql }],
		released,
	);
}

/** Runs the gate with every file of `frozen` in the registry, then the files of `added`. */
function checkFolder(
	frozen: DesktopMigrationFile[],
	added: DesktopMigrationFile[],
) {
	return checkDesktopMigrations(
		[...frozen, ...added],
		frozen.map((file) => ({
			name: file.fileName.slice(5, -4),
			sha256: sha256OfMigration(file.sql),
			version: Number(file.fileName.slice(0, 4)),
		})),
	);
}

describe("checkDesktopMigrations", () => {
	it("accepts additive migrations on a database with saved rows", async () => {
		await expect(
			checkWithNewMigration(`
				ALTER TABLE stock ADD COLUMN label TEXT NOT NULL DEFAULT '';
				UPDATE OR IGNORE stock SET label = name;
				CREATE TABLE orders (id INTEGER PRIMARY KEY, stock_id INTEGER NOT NULL REFERENCES stock (id));
				CREATE INDEX orders_stock ON orders (stock_id);
				CREATE UNIQUE INDEX orders_one_per_stock ON orders (stock_id);
				INSERT OR IGNORE INTO orders (stock_id) SELECT id FROM stock;
				SELECT (SELECT count(*) FROM orders) = (SELECT count(*) FROM stock);
				DROP TRIGGER stock_guard;
			`),
		).resolves.toEqual([]);
	});

	it.each([
		[
			"ALTER TABLE stock ADD COLUMN sku TEXT NOT NULL",
			"migration_statement_refused",
			"Cannot add a NOT NULL column with default value NULL",
		],
		[
			"CREATE TABLE a (x);\nINSERT OR IGNORE INTO nope VALUES (1);",
			"migration_dry_run_failed",
			"Statement 2: no such table: nope",
		],
		[
			"UPDATE OR IGNORE stock SET qty = 0;",
			"migration_statement_refused",
			"Statement 1: UPDATE changes saved values in stock (qty).",
		],
		[
			"CREATE UNIQUE INDEX stock_name ON stock (name);",
			"migration_statement_refused",
			"Statement 1: CREATE UNIQUE INDEX on stock can fail on saved rows",
		],
		[
			"CREATE TABLE temp.scratch (x);",
			"migration_statement_refused",
			"temporary object scratch",
		],
		[
			"CREATE VIEW broken AS SELECT * FROM nope;",
			"migration_dry_run_failed",
			"The view broken fails",
		],
		["-- nothing yet", "migration_empty", "no SQL statement"],
		[
			"ALTER TABLE stock ADD COLUMN cap INTEGER NOT NULL DEFAULT 1 CHECK (cap >= qty);",
			"migration_statement_refused",
			"no such column: qty",
		],
		[
			"CREATE TABLE names (stock_id INTEGER NOT NULL, name TEXT NOT NULL UNIQUE);\nINSERT OR IGNORE INTO names SELECT id, name FROM stock;\nSELECT (SELECT count(*) FROM names) = (SELECT count(*) FROM stock);",
			"migration_check_failed",
			"On the test rows: Statement 3 is a check that answered 0, not the integer 1",
		],
		[
			"CREATE TABLE labels (stock_id INTEGER, source TEXT);\nINSERT OR IGNORE INTO labels SELECT id, json_extract(name, '$.source') FROM stock;",
			"migration_dry_run_failed",
			"On the test rows: Statement 2: malformed JSON",
		],
		[
			"CREATE TABLE orders (id INTEGER PRIMARY KEY, stock_id INTEGER NOT NULL REFERENCES stock (id));\nINSERT OR IGNORE INTO orders (stock_id) VALUES (1);",
			"migration_dry_run_failed",
			"On a new install: Statement 2: FOREIGN KEY constraint failed",
		],
		[
			"SELECT EXISTS (SELECT 1 FROM stock);",
			"migration_check_failed",
			"On a new install: Statement 1 is a check that answered 0",
		],
		[
			"CREATE TABLE audit (n INTEGER);\nCREATE TABLE copies (n INTEGER);\nCREATE TRIGGER copies_audit AFTER INSERT ON copies BEGIN INSERT INTO audit VALUES (new.n); END;\nINSERT OR IGNORE INTO copies SELECT qty FROM stock;",
			"migration_statement_refused",
			"Statement 4: This statement can fire a trigger",
		],
		[
			"CREATE TABLE wipe_now (x INTEGER);\nCREATE TRIGGER wipe_trg AFTER INSERT ON wipe_now WHEN new.x = 424242 BEGIN DELETE FROM stock; END;\nINSERT OR IGNORE INTO wipe_now SELECT qty FROM stock;",
			"migration_statement_refused",
			"Statement 3: This statement can fire a trigger",
		],
		// 7^5 rows of 4000 bytes: 67 MB, more than the 32 MiB file limit.
		[
			"CREATE TABLE big (x);\nINSERT OR IGNORE INTO big SELECT zeroblob(4000) FROM stock a, stock b, stock c, stock d, stock e;",
			"migration_dry_run_failed",
			"On the test rows: Statement 2: database or disk is full",
		],
		// 7^5 distinct rows of 8000 bytes: 134 MB of temp data, more than the 64 MiB heap limit.
		[
			"SELECT count(*) > 0 FROM (SELECT DISTINCT randomblob(8000) FROM stock a, stock b, stock c, stock d, stock e);",
			"migration_dry_run_failed",
			"On the test rows: Statement 1: out of memory",
		],
	])("reports %j", async (sql, rule, message) => {
		const findings = await checkWithNewMigration(sql);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.rule).toBe(rule);
		expect(findings[0]?.message).toContain(message);
	});

	it("stops a slow statement at the deadline, and the next call still runs", async () => {
		// 7 test rows in stock, so 7^12 rows: minutes without the deadline.
		const copies = Array.from({ length: 12 }, (_, index) => `stock s${index}`);

		const slow = await checkDesktopMigrations(
			[
				...builtFiles,
				{
					fileName: "0002_next.sql",
					sql: `SELECT count(*) > 0 FROM ${copies.join(", ")};`,
				},
			],
			released,
			500,
		);
		const next = await checkWithNewMigration(
			"CREATE TABLE notes (id INTEGER PRIMARY KEY);",
		);

		expect(slow).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("The dry run stopped after 0.5 s"),
				rule: "migration_dry_run_failed",
			}),
		]);
		expect(next).toEqual([]);
	});

	it("does not run a call on a module that a timeout of another call dropped", async () => {
		const copies = Array.from({ length: 12 }, (_, index) => `stock s${index}`);
		// The stopped run keeps about 40 MB of temp rows in its module, because the timeout skips finally.
		const stoppedSql = `CREATE TABLE temp.h (x);\nINSERT OR IGNORE INTO temp.h SELECT randomblob(2000) FROM stock a, stock b, stock c, stock d, stock e;\nSELECT count(*) > 0 FROM ${copies.join(", ")};`;
		// On the test rows, this check needs about 17 MB of heap. So it fails on the heap that the stopped run leaves.
		const legalSql =
			"SELECT (SELECT count(*) FROM (SELECT DISTINCT randomblob(10000) FROM stock a, stock b, stock c, stock d)) >= 0;";

		const [stopped, legal] = await Promise.all([
			checkDesktopMigrations(
				[...builtFiles, { fileName: "0002_next.sql", sql: stoppedSql }],
				released,
				1000,
			),
			checkWithNewMigration(legalSql),
		]);

		expect(stopped).toEqual([
			expect.objectContaining({ rule: "migration_dry_run_failed" }),
		]);
		expect(legal).toEqual([]);
	});

	it("reports only the first refusal of a file and no later check", async () => {
		const findings = await checkWithNewMigration(
			"CREATE TABLE copies (n INTEGER);\nINSERT INTO copies SELECT qty FROM stock;\nSELECT (SELECT count(*) FROM copies) = (SELECT count(*) FROM stock);",
		);

		expect(findings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("Statement 2: Use INSERT OR IGNORE"),
				rule: "migration_statement_refused",
			}),
		]);
	});

	it.each([
		[
			"UUID key",
			"CREATE TABLE invoices (id TEXT PRIMARY KEY CHECK (length(id) = 36), customer TEXT NOT NULL);",
			"CREATE TABLE invoice_customers (customer TEXT NOT NULL UNIQUE);\nINSERT OR IGNORE INTO invoice_customers SELECT customer FROM invoices;\nSELECT (SELECT count(*) FROM invoice_customers) = (SELECT count(*) FROM invoices);",
		],
		[
			"two enums",
			"CREATE TABLE pairs (kind TEXT NOT NULL CHECK (kind IN ('in', 'out')), state TEXT NOT NULL CHECK (state IN ('open', 'done')));",
			"CREATE TABLE kinds (kind TEXT NOT NULL UNIQUE);\nINSERT OR IGNORE INTO kinds SELECT kind FROM pairs;\nSELECT (SELECT count(*) FROM kinds) = (SELECT count(*) FROM pairs);",
		],
	])("fills a frozen table whose CHECK refuses short keys or one shared literal: %s", async (_name, frozenSql, copySql) => {
		const findings = await checkFolder(
			[{ fileName: "0001_init.sql", sql: frozenSql }],
			[{ fileName: "0002_copy.sql", sql: copySql }],
		);

		expect(findings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("On the test rows: Statement 3"),
				rule: "migration_check_failed",
			}),
		]);
	});

	it("refuses an ADD COLUMN that fails on saved rows when the test rows cannot fill the table", async () => {
		const findings = await checkFolder(
			[
				{
					fileName: "0001_init.sql",
					sql: "CREATE TABLE codes (code TEXT NOT NULL CHECK (length(code) = 3));",
				},
			],
			[
				{
					fileName: "0002_next.sql",
					sql: "ALTER TABLE codes ADD COLUMN n INTEGER NOT NULL;",
				},
			],
		);

		expect(findings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("Cannot add a NOT NULL column"),
				rule: "migration_statement_refused",
			}),
		]);
	});

	it("probes an ADD COLUMN on a frozen table whose name has a non-ASCII capital", async () => {
		const findings = await checkFolder(
			[
				{
					fileName: "0001_init.sql",
					sql: "CREATE TABLE Étapes (id INTEGER PRIMARY KEY, title TEXT NOT NULL) STRICT;",
				},
			],
			[
				{
					fileName: "0002_next.sql",
					sql: "ALTER TABLE Étapes ADD COLUMN note TEXT;",
				},
			],
		);

		expect(findings).toEqual([]);
	});

	it("refuses an UPDATE of a saved column when two frozen tables differ only in a non-ASCII capital", async () => {
		const findings = await checkFolder(
			[
				{
					fileName: "0001_init.sql",
					sql: "CREATE TABLE Étapes (a TEXT);\nCREATE TABLE étapes (c TEXT);",
				},
			],
			[
				{
					fileName: "0002_next.sql",
					sql: "UPDATE OR IGNORE Étapes SET a = 'x';",
				},
			],
		);

		expect(findings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining(
					"UPDATE changes saved values in Étapes (a)",
				),
				rule: "migration_statement_refused",
			}),
		]);
	});

	it("runs the replacement in place of a frozen file that fails on a new install", async () => {
		const createOrders =
			"CREATE TABLE orders (id INTEGER PRIMARY KEY, stock_id INTEGER NOT NULL REFERENCES stock (id));";
		const frozen = [
			...builtFiles,
			{
				fileName: "0002_seed.sql",
				sql: `${createOrders}\nINSERT OR IGNORE INTO orders (stock_id) VALUES (1);`,
			},
		];

		const withoutFix = await checkFolder(frozen, []);
		const withFix = await checkFolder(frozen, [
			{
				fileName: "0003_seed_fix.sql",
				sql: `-- wandit:replaces 0002\n${createOrders}\nINSERT OR IGNORE INTO orders (stock_id) SELECT id FROM stock;`,
			},
		]);

		expect(withoutFix).toEqual([
			expect.objectContaining({
				message: expect.stringMatching(/On a new install.*replaces: 2/),
				path: "migrations/0002_seed.sql",
			}),
		]);
		expect(withFix).toEqual([]);
	});
});

describe("replacement migrations", () => {
	const copyEmailsDdl =
		"CREATE TABLE emails (customer_id INTEGER NOT NULL, email TEXT NOT NULL);";
	const copyEmailsInsert =
		"INSERT OR IGNORE INTO emails SELECT id, email FROM customers;";
	const copyEmails = `${copyEmailsDdl}\n${copyEmailsInsert}\nSELECT (SELECT count(*) FROM emails) = (SELECT count(*) FROM customers);`;
	const frozen = [
		{
			fileName: "0001_init.sql",
			sql: "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT);",
		},
		{ fileName: "0002_copy_emails.sql", sql: copyEmails },
		{
			fileName: "0003_add_verified.sql",
			sql: "ALTER TABLE emails ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;",
		},
	];

	it.each([
		[
			`-- wandit:replaces 0002\n${copyEmailsDdl}\n${copyEmailsInsert}\nSELECT (SELECT count(*) FROM emails) = (SELECT count(*) FROM customers WHERE email IS NOT NULL AND id IS NOT NULL);`,
			[],
		],
		[
			`-- wandit:replaces 0002\nCREATE TABLE emails (customer_id INTEGER, email TEXT);\n${copyEmailsInsert}`,
			["migration_replaces_schema_differs"],
		],
		[`-- wandit:replaces 0002\n${copyEmails}`, ["migration_check_failed"]],
	])("checks the new file %j", async (sql, rules) => {
		const findings = await checkFolder(frozen, [
			{ fileName: "0004_copy_emails_fix.sql", sql },
		]);

		expect(findings.map((finding) => finding.rule)).toEqual(rules);
	});
});
