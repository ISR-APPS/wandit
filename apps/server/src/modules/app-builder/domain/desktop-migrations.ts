/**
 * Pure rules of the desktop migration gate (docs/v2/desktop-apps.md).
 * `planDesktopMigrations` checks the file names, the sizes, the replacement
 * headers, and the frozen registry of built migrations. `classifyDesktopMigrationStatement`
 * sorts one SQLite statement into the allow list. The sql.js dry run in
 * `infrastructure/sqlite/desktop-migration-gate.ts` calls these rules.
 */
import { createHash } from "node:crypto";
import {
	DESKTOP_MIGRATION_MAX_BYTES,
	DESKTOP_MIGRATIONS_DIR,
	DESKTOP_MIGRATIONS_MAX_COUNT,
	DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES,
	type DesktopGateFinding,
	type DesktopGateRule,
	parseDesktopMigrationFileName,
	parseDesktopMigrationHeader,
} from "@wandit/contracts";

/**
 * Table where the installed app records each applied migration. The Rust
 * shell creates it (templates/desktop-shell). A user migration never names it.
 */
export const DESKTOP_MIGRATION_LEDGER_TABLE = "wandit_migrations";

/** One entry of the `migrations/` folder of a project. */
export type DesktopMigrationFile = {
	/** Name inside `migrations/`, for example `0002_add_customers.sql`. Untrusted: it comes from the sandbox or git. */
	fileName: string;
	/** UTF-8 text of the file. The build embeds this exact text. */
	sql: string;
};

/** One row of `desktop_migrations`: a file that a ready build held. */
export type ReleasedDesktopMigration = {
	version: number;
	/** The name part of the file name, for example "add_customers". */
	name: string;
	/** Lowercase hex SHA-256 of the UTF-8 file text. */
	sha256: string;
};

/** A migration file with a valid name. */
export type PlannedDesktopMigration = {
	version: number;
	name: string;
	fileName: string;
	sql: string;
	/** Lowercase hex SHA-256 of `sql`. The build writes it to the registry. */
	sha256: string;
	/** True when a ready build held the file. Installed apps may have run it. */
	isReleased: boolean;
	/** Target version from line 1, or null for a plain file. See parseDesktopMigrationHeader. */
	replaces: number | null;
};

/** Table or view name to its column names, in the main schema. `lowerCaseAscii` folds each name. */
export type DesktopSchema = Map<string, Set<string>>;

/** How the gate treats one statement. */
export type DesktopMigrationStatement =
	// CREATE TABLE, INDEX, VIEW, or TRIGGER; DROP INDEX or TRIGGER. The dry run executes it.
	| { kind: "schema" }
	// CREATE UNIQUE INDEX. `table` is lowercase. The dry run executes it, but
	// it is refused on a table of an earlier build.
	| { kind: "unique_index"; table: string }
	// ALTER TABLE ... ADD [COLUMN]. `table` is lowercase. The gate probes it on a table of an earlier build.
	| { kind: "add_column"; table: string }
	// INSERT OR IGNORE. The dry run executes it on the test rows and on a new install.
	| { kind: "insert" }
	// UPDATE OR IGNORE. `table` and `columns` are lowercase.
	| { kind: "update"; table: string; columns: string[] }
	// A top-level SELECT. It must answer one row with the integer 1.
	| { kind: "check" }
	// Not on the allow list. `reason` is English text for the agent.
	| { kind: "refused"; reason: string };

/** Lowercase hex SHA-256 of the UTF-8 text. The Rust shell hashes the same bytes. */
export function sha256OfMigration(sql: string): string {
	return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * Builds a gate finding. Cuts the path and the message to the contract limits, in UTF-16 units.
 * A cut never leaves half of an emoji.
 */
export function desktopGateFinding(
	rule: DesktopGateRule,
	path: string,
	message: string,
): DesktopGateFinding {
	return {
		message: cutUtf16(message, 500),
		path: cutUtf16(path, 300),
		rule,
	};
}

// A cut inside an emoji leaves a lone high surrogate. Postgres jsonb refuses it, so the cut removes it.
function cutUtf16(text: string, maxUnits: number): string {
	return text.slice(0, maxUnits).replace(/[\uD800-\uDBFF]$/, "");
}

/**
 * Lowercases only the ASCII letters, as SQLite does when it compares names.
 * `toLowerCase` also folds "É", so two different SQLite tables would get one key.
 * In this module, "lowercase" means this function.
 */
export function lowerCaseAscii(text: string): string {
	return text.replace(/[A-Z]+/g, (letters) => letters.toLowerCase());
}

function migrationPath(fileName: string): string {
	return `${DESKTOP_MIGRATIONS_DIR}/${fileName}`;
}

/**
 * Checks the names, the sizes, the replacement headers, and the registry of
 * built migrations. Answers the valid files in version order and the findings.
 * The dry run starts only when the findings are empty.
 */
export function planDesktopMigrations(
	files: DesktopMigrationFile[],
	released: ReleasedDesktopMigration[],
): { migrations: PlannedDesktopMigration[]; findings: DesktopGateFinding[] } {
	const findings: DesktopGateFinding[] = [];
	if (files.length > DESKTOP_MIGRATIONS_MAX_COUNT) {
		findings.push(
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The folder holds ${files.length} files. The limit is ${DESKTOP_MIGRATIONS_MAX_COUNT}.`,
			),
		);
	}
	const releasedVersions = new Set(released.map((row) => row.version));
	const byVersion = new Map<number, PlannedDesktopMigration>();
	let totalBytes = 0;
	// Sorted, so the same folder always gives the same findings.
	const sortedFiles = [...files].sort((a, b) =>
		a.fileName < b.fileName ? -1 : 1,
	);
	for (const file of sortedFiles) {
		const path = migrationPath(file.fileName);
		const bytes = Buffer.byteLength(file.sql, "utf8");
		totalBytes += bytes;
		const parsed = parseDesktopMigrationFileName(file.fileName);
		if (parsed === null) {
			findings.push(
				desktopGateFinding(
					"migration_name_invalid",
					path,
					"Use the name NNNN_snake_case_name.sql, with a version from 0001 to 9999.",
				),
			);
			continue;
		}
		if (bytes > DESKTOP_MIGRATION_MAX_BYTES) {
			findings.push(
				desktopGateFinding(
					"migration_too_large",
					path,
					`The file has ${bytes} bytes. The limit is ${DESKTOP_MIGRATION_MAX_BYTES}.`,
				),
			);
			continue;
		}
		const other = byVersion.get(parsed.version);
		if (other !== undefined) {
			findings.push(
				desktopGateFinding(
					"migration_duplicate_version",
					path,
					`Version ${parsed.version} is also the version of ${other.fileName}.`,
				),
			);
			continue;
		}
		const header = parseDesktopMigrationHeader(file.sql);
		if (header.kind === "invalid") {
			findings.push(
				desktopGateFinding(
					"migration_replaces_invalid",
					path,
					'Only line 1 may hold "-- wandit:replaces NNNN", with a version from 0001 to 9999. No other line may start with "-- wandit:".',
				),
			);
		}
		byVersion.set(parsed.version, {
			fileName: file.fileName,
			isReleased: releasedVersions.has(parsed.version),
			name: parsed.name,
			replaces: header.kind === "replaces" ? header.version : null,
			sha256: sha256OfMigration(file.sql),
			sql: file.sql,
			version: parsed.version,
		});
	}
	if (totalBytes > DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES) {
		findings.push(
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The files have ${totalBytes} bytes in total. The limit is ${DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES}.`,
			),
		);
	}

	// Installed apps ran the built files, so each one must stay as it was.
	let lastReleasedVersion = 0;
	for (const row of released) {
		lastReleasedVersion = Math.max(lastReleasedVersion, row.version);
		const builtName = `${String(row.version).padStart(4, "0")}_${row.name}.sql`;
		const file = byVersion.get(row.version);
		if (file === undefined) {
			findings.push(
				desktopGateFinding(
					"migration_released_missing",
					migrationPath(builtName),
					"An earlier build shipped this file. Restore it with the same text.",
				),
			);
		} else if (file.name !== row.name || file.sha256 !== row.sha256) {
			findings.push(
				desktopGateFinding(
					"migration_released_changed",
					migrationPath(file.fileName),
					`An earlier build shipped ${builtName}, and installed apps ran it. Restore its text and put the change in a new migration.`,
				),
			);
		}
	}

	const migrations = [...byVersion.values()].sort(
		(a, b) => a.version - b.version,
	);
	// A replacement runs at the place of its target, on installs that did not run the target.
	// So the target must be a plain file that installed apps may have run.
	for (const migration of migrations) {
		if (migration.replaces === null) {
			continue;
		}
		const target = byVersion.get(migration.replaces);
		if (target === undefined || !target.isReleased) {
			findings.push(
				desktopGateFinding(
					"migration_replaces_invalid",
					migrationPath(migration.fileName),
					`Version ${migration.replaces} is not a migration of an earlier build. Only a migration of an earlier build can be replaced.`,
				),
			);
		} else if (target.replaces !== null) {
			findings.push(
				desktopGateFinding(
					"migration_replaces_invalid",
					migrationPath(migration.fileName),
					`Version ${migration.replaces} replaces version ${target.replaces}. Replace version ${target.replaces} instead.`,
				),
			);
		}
	}
	// Apps run migrations in version order. A new file below a built version
	// would run in a different order on new and old installs.
	for (const migration of migrations) {
		if (!migration.isReleased && migration.version <= lastReleasedVersion) {
			findings.push(
				desktopGateFinding(
					"migration_version_order",
					migrationPath(migration.fileName),
					`Version ${migration.version} is not above version ${lastReleasedVersion} of an earlier build. Use version ${lastReleasedVersion + 1} or higher.`,
				),
			);
		}
	}
	return { findings, migrations };
}

// --- Statement allow list --------------------------------------------------

/**
 * One SQL token. "word" is a bare keyword or name, lowercase. "name" is a
 * quoted name or string without its quotes, lowercase. "other" is a number
 * or a symbol.
 */
type SqlToken = { kind: "word" | "name" | "other"; text: string };

// Whitespace, comments, quoted strings and names, bare words, numbers, and
// single characters. The last branch matches any character, so the tokens
// cover the whole text.
const SQL_TOKEN_PATTERN =
	/\s+|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|[A-Za-z_\u0080-￿][\w$\u0080-￿]*|\d[\w.]*|[\s\S]/g;

// SQLite already parsed the statement, so every quote here is closed.
// SQLite reads 'stock' as a name where it expects a name, and "x" as a
// string where it expects a value. So both quote kinds give a "name" token.
function tokenize(sql: string): SqlToken[] {
	const tokens: SqlToken[] = [];
	for (const [text] of sql.matchAll(SQL_TOKEN_PATTERN)) {
		if (/^\s/.test(text) || text.startsWith("--") || text.startsWith("/*")) {
			continue;
		}
		if (text.startsWith('"') || text.startsWith("`") || text.startsWith("'")) {
			const quote = text.charAt(0);
			tokens.push({
				kind: "name",
				text: lowerCaseAscii(
					text.slice(1, -1).replaceAll(quote + quote, quote),
				),
			});
		} else if (text.startsWith("[")) {
			tokens.push({ kind: "name", text: lowerCaseAscii(text.slice(1, -1)) });
		} else if (/^[A-Za-z_\u0080-￿]/.test(text)) {
			tokens.push({ kind: "word", text: lowerCaseAscii(text) });
		} else {
			tokens.push({ kind: "other", text });
		}
	}
	return tokens;
}

function wordAt(tokens: SqlToken[], index: number): string {
	const token = tokens[index];
	return token?.kind === "word" ? token.text : "";
}

// Reads `name` or `schema.name` at `start`. Answers the last part and the
// index after it.
function readQualifiedName(
	tokens: SqlToken[],
	start: number,
): { name: string; next: number } {
	const dot = tokens[start + 1];
	if (dot?.kind === "other" && dot.text === ".") {
		return { name: tokens[start + 2]?.text ?? "", next: start + 3 };
	}
	return { name: tokens[start]?.text ?? "", next: start + 1 };
}

const ALLOWED_STATEMENTS =
	"Allowed: CREATE TABLE, INDEX, VIEW, TRIGGER; ALTER TABLE ... ADD COLUMN; DROP INDEX, TRIGGER; INSERT OR IGNORE; UPDATE OR IGNORE of columns that this build adds; SELECT checks.";
const REPLACE_REASON =
	"REPLACE deletes saved rows on a conflict. Use INSERT OR IGNORE.";

// sql.js has these functions, and the SQLite of the Rust shell does not (probe P12).
// A migration that calls one passes the dry run and fails in the installed app.
const SQLJS_ONLY_FUNCTIONS = new Set([
	"acos",
	"acosh",
	"asin",
	"asinh",
	"atan",
	"atan2",
	"atanh",
	"atn2",
	"ceil",
	"charindex",
	"cos",
	"cosh",
	"cot",
	"coth",
	"degrees",
	"difference",
	"exp",
	"floor",
	"leftstr",
	"log",
	"log10",
	"lower_quartile",
	"median",
	"mode",
	"padc",
	"padl",
	"padr",
	"pi",
	"power",
	"proper",
	"radians",
	"replicate",
	"reverse",
	"rightstr",
	"sin",
	"sinh",
	"sqrt",
	"square",
	"stdev",
	"strfilter",
	"tan",
	"tanh",
	"upper_quartile",
	"variance",
]);

// After one of these words or a dot, a name is a table, a view, or a schema.
const WORDS_BEFORE_TABLE_NAME = new Set([
	"table",
	"exists",
	"into",
	"references",
	"view",
]);

function refused(reason: string): DesktopMigrationStatement {
	return { kind: "refused", reason };
}

// Answers the name of the first call of a function that only sql.js has, or null.
function findSqlJsOnlyFunction(tokens: SqlToken[]): string | null {
	// In CREATE INDEX, "ON name (" names the table. Elsewhere it can be a join condition that calls a function.
	const isCreateIndex =
		wordAt(tokens, 0) === "create" &&
		(wordAt(tokens, 1) === "index" ||
			(wordAt(tokens, 1) === "unique" && wordAt(tokens, 2) === "index"));
	for (const [index, token] of tokens.entries()) {
		const next = tokens[index + 1];
		const previous = tokens[index - 1];
		const isTableName =
			(previous?.kind === "word" &&
				(WORDS_BEFORE_TABLE_NAME.has(previous.text) ||
					(isCreateIndex && previous.text === "on"))) ||
			(previous?.kind === "other" && previous.text === ".");
		if (
			token.kind !== "other" &&
			SQLJS_ONLY_FUNCTIONS.has(token.text) &&
			next?.kind === "other" &&
			next.text === "(" &&
			!isTableName
		) {
			return token.text;
		}
	}
	return null;
}

/**
 * Sorts one statement that SQLite already prepared into the allow list.
 * The list keeps every saved row and every column that an older build
 * reads, so a rollback to that build still works.
 */
export function classifyDesktopMigrationStatement(
	sql: string,
): DesktopMigrationStatement {
	const tokens = tokenize(sql);
	// Quoted names and strings count, so a string value with this text is also refused.
	if (
		tokens.some(
			(token) =>
				token.kind !== "other" && token.text === DESKTOP_MIGRATION_LEDGER_TABLE,
		)
	) {
		return refused(
			`The table ${DESKTOP_MIGRATION_LEDGER_TABLE} belongs to the app. A migration cannot use it.`,
		);
	}
	// The installed app has the ledger table and another SQLite version. So a read of
	// sqlite_schema, a pragma_ table, or sqlite_version() answers other values there than in the dry run.
	// Quoted names and strings count, as in the ledger rule above.
	const internal = tokens.find(
		(token) =>
			token.kind !== "other" &&
			(token.text.startsWith("sqlite_") || token.text.startsWith("pragma_")),
	);
	if (internal !== undefined) {
		return refused(
			`${internal.text} is internal to SQLite. A migration reads and writes only the tables of the app.`,
		);
	}
	// A recursive query can loop. The installed app runs migrations with no time limit, so the dry run deadline does not protect it.
	if (tokens.some((token) => token.kind === "word" && token.text === "with")) {
		return refused(
			"WITH is not allowed in a migration. A recursive query can run without end. Write the query without WITH.",
		);
	}
	const sqlJsOnlyFunction = findSqlJsOnlyFunction(tokens);
	if (sqlJsOnlyFunction !== null) {
		return refused(
			`The installed app has no ${sqlJsOnlyFunction}() function. Compute this value in the app code.`,
		);
	}
	switch (wordAt(tokens, 0)) {
		case "create":
			return classifyCreate(tokens);
		case "alter": {
			const table = readQualifiedName(tokens, 2);
			return wordAt(tokens, table.next) === "add"
				? { kind: "add_column", table: table.name }
				: refused(
						"Only ALTER TABLE ... ADD COLUMN is allowed. Older builds must still read the table after a rollback.",
					);
		}
		case "drop":
			return classifyDrop(wordAt(tokens, 1));
		case "insert":
			return classifyInsert(tokens);
		case "replace":
			return refused(REPLACE_REASON);
		case "update":
			return classifyUpdate(tokens);
		case "select":
			return { kind: "check" };
	}
	const keyword = (tokens[0]?.text ?? "").toUpperCase();
	return refused(
		`${keyword} is not allowed in a migration. ${ALLOWED_STATEMENTS}`,
	);
}

function classifyCreate(tokens: SqlToken[]): DesktopMigrationStatement {
	const second = wordAt(tokens, 1);
	if (second === "temp" || second === "temporary") {
		return refused(
			"A temporary object disappears when the app closes. Remove TEMP.",
		);
	}
	if (second === "table") {
		// "IF NOT EXISTS" is three words before the name.
		const nameStart = wordAt(tokens, 2) === "if" ? 5 : 2;
		// CREATE TABLE ... AS SELECT runs a query, which can run without end.
		if (wordAt(tokens, readQualifiedName(tokens, nameStart).next) === "as") {
			return refused(
				"CREATE TABLE ... AS SELECT is not allowed. Create the table, then copy the rows with INSERT ... SELECT.",
			);
		}
		return { kind: "schema" };
	}
	if (second === "unique" && wordAt(tokens, 2) === "index") {
		return classifyUniqueIndex(tokens);
	}
	if (second === "index" || second === "view" || second === "trigger") {
		return { kind: "schema" };
	}
	return refused(
		`CREATE ${second.toUpperCase()} is not allowed in a migration. ${ALLOWED_STATEMENTS}`,
	);
}

// SQLite allows `schema.` only on the index name, and an unquoted index name
// is never "on". So the first word "on" is the keyword before the table.
function classifyUniqueIndex(tokens: SqlToken[]): DesktopMigrationStatement {
	const onIndex = tokens.findIndex(
		(token, index) =>
			index >= 3 && token.kind === "word" && token.text === "on",
	);
	const table = onIndex < 0 ? "" : readQualifiedName(tokens, onIndex + 1).name;
	// The refusal needs the table name, so an unread name fails closed.
	if (table === "") {
		return refused(
			"The gate cannot read the table of this CREATE UNIQUE INDEX.",
		);
	}
	return { kind: "unique_index", table };
}

function classifyDrop(objectType: string): DesktopMigrationStatement {
	// An index or a trigger holds no data, and no query names it.
	if (objectType === "index" || objectType === "trigger") {
		return { kind: "schema" };
	}
	if (objectType === "table") {
		return refused("DROP TABLE deletes saved data. Keep the table.");
	}
	if (objectType === "view") {
		return refused(
			"Older builds may read this view after a rollback. Create a view with a new name.",
		);
	}
	return refused(
		`DROP ${objectType.toUpperCase()} is not allowed in a migration. ${ALLOWED_STATEMENTS}`,
	);
}

function classifyInsert(tokens: SqlToken[]): DesktopMigrationStatement {
	if (wordAt(tokens, 1) === "or" && wordAt(tokens, 2) === "replace") {
		return refused(REPLACE_REASON);
	}
	// ON CONFLICT DO NOTHING alone does not skip a NOT NULL or CHECK error (probe P02).
	if (wordAt(tokens, 1) !== "or" || wordAt(tokens, 2) !== "ignore") {
		return refused(
			"Use INSERT OR IGNORE. A plain INSERT stops the update when one saved row breaks a UNIQUE, NOT NULL, or CHECK rule.",
		);
	}
	for (let index = 0; index < tokens.length - 1; index += 1) {
		if (
			wordAt(tokens, index) === "do" &&
			wordAt(tokens, index + 1) === "update"
		) {
			return refused(
				"ON CONFLICT DO UPDATE changes saved rows. Use ON CONFLICT DO NOTHING.",
			);
		}
	}
	return { kind: "insert" };
}

// The SET list stops at the first of these words outside parentheses.
const UPDATE_CLAUSE_ENDS = new Set([
	"from",
	"where",
	"returning",
	"order",
	"limit",
]);

function classifyUpdate(tokens: SqlToken[]): DesktopMigrationStatement {
	if (wordAt(tokens, 1) === "or" && wordAt(tokens, 2) === "replace") {
		return refused(REPLACE_REASON);
	}
	// OR IGNORE skips the row that breaks a UNIQUE, NOT NULL, or CHECK rule.
	if (wordAt(tokens, 1) !== "or" || wordAt(tokens, 2) !== "ignore") {
		return refused(
			"Use UPDATE OR IGNORE. A plain UPDATE stops the update when one saved row breaks a UNIQUE, NOT NULL, or CHECK rule.",
		);
	}
	const table = readQualifiedName(tokens, 3);
	// "AS alias", "INDEXED BY", or "NOT INDEXED" can come before SET.
	const setIndex = tokens.findIndex(
		(token, index) =>
			index >= table.next && token.kind === "word" && token.text === "set",
	);
	const columns: string[] = [];
	let depth = 0;
	// True on the left side of "=": `column` or `(column, column)`.
	let isTarget = true;
	let previousWord = "";
	for (const token of setIndex < 0 ? [] : tokens.slice(setIndex + 1)) {
		if (
			!isTarget &&
			depth === 0 &&
			token.kind === "word" &&
			UPDATE_CLAUSE_ENDS.has(token.text)
		) {
			// In "IS [NOT] DISTINCT FROM", FROM is part of a value. Fail closed: the SET columns after it stay unread.
			if (token.text === "from" && previousWord === "distinct") {
				return refused(
					"The gate cannot read the SET columns of an UPDATE with IS DISTINCT FROM. Use IS or IS NOT.",
				);
			}
			break;
		}
		previousWord = token.kind === "word" ? token.text : "";
		// A quoted "(" or ")" is a name or a value, so it does not change the depth.
		const symbol = token.kind === "other" ? token.text : "";
		if (symbol === "(") {
			depth += 1;
		} else if (symbol === ")") {
			depth -= 1;
		} else if (depth === 0 && symbol === ",") {
			isTarget = true;
		} else if (depth === 0 && symbol === "=") {
			isTarget = false;
		} else if (isTarget && token.kind !== "other") {
			columns.push(token.text);
		}
	}
	if (columns.length === 0) {
		return refused("The gate cannot read the SET columns of this UPDATE.");
	}
	return { columns, kind: "update", table: table.name };
}

/**
 * Answers why a new statement breaks the allow list, or null. An UPDATE may
 * only fill columns that this build adds: a migration never changes a value
 * that the user saved. A UNIQUE index goes only on a table that no earlier
 * build has. ADD COLUMN and checks answer null: the dry run tests them.
 */
export function findDesktopMigrationRefusal(
	statement: DesktopMigrationStatement,
	releasedSchema: DesktopSchema,
): string | null {
	if (statement.kind === "refused") {
		return statement.reason;
	}
	// Saved rows can hold duplicates. Then the index fails on that install, and a replacement
	// must copy the same CREATE statement. So no later build can fix it.
	if (statement.kind === "unique_index") {
		return releasedSchema.has(statement.table)
			? `CREATE UNIQUE INDEX on ${statement.table} can fail on saved rows that hold duplicates. Check the rule in the app, or put the column in a new table.`
			: null;
	}
	if (statement.kind !== "update") {
		return null;
	}
	const savedColumns = releasedSchema.get(statement.table);
	const changed = statement.columns.filter((column) =>
		savedColumns?.has(column),
	);
	if (changed.length === 0) {
		return null;
	}
	return `UPDATE changes saved values in ${statement.table} (${changed.join(", ")}). A migration may only fill columns that this build adds.`;
}

/**
 * The lowercase first word of a statement, or "". Comments before it do not count.
 * The dry run uses it for frozen files and new installs, where the current allow list does not apply.
 */
export function desktopMigrationFirstWord(sql: string): string {
	return wordAt(tokenize(sql), 0);
}

/**
 * Lists the tables, views, and columns of the built schema that the new
 * migrations removed. The allow list already refuses each way to remove one.
 * This second check stops a statement that the token rules read wrong.
 */
export function findRemovedDesktopSchema(
	releasedSchema: DesktopSchema,
	currentSchema: DesktopSchema,
): DesktopGateFinding[] {
	const findings: DesktopGateFinding[] = [];
	for (const [table, columns] of releasedSchema) {
		const currentColumns = currentSchema.get(table);
		if (currentColumns === undefined) {
			findings.push(
				desktopGateFinding(
					"migration_schema_removed",
					DESKTOP_MIGRATIONS_DIR,
					`The table or view ${table} of an earlier build is gone.`,
				),
			);
			continue;
		}
		for (const column of columns) {
			if (!currentColumns.has(column)) {
				findings.push(
					desktopGateFinding(
						"migration_schema_removed",
						DESKTOP_MIGRATIONS_DIR,
						`The column ${table}.${column} of an earlier build is gone.`,
					),
				);
			}
		}
	}
	return findings;
}
