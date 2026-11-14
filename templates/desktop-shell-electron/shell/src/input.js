/**
 * Checks the arguments of the 3 SQL commands that the page sends
 * (docs/v2/desktop-apps.md, section 4). commands.js calls it for each IPC call, before the
 * database process sees the values. database.js then checks the size limits.
 */

const { DbError } = require("./db/db-error.js");

/** @typedef {import("./db/database.js").SqlParam} SqlParam */

// True for a value with keys: not null, not an array.
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the arguments of `db_select` and `db_execute`, and of one statement of `db_batch`.
 * Throws a DbError: invalid_input for a wrong type, unsupported_value for a number that is
 * not finite.
 * @param {unknown} input The raw value from the page.
 * @returns {{ sql: string, params: SqlParam[] }} `params` is empty when the page sends none.
 */
function parseStatementInput(input) {
	if (!isRecord(input) || typeof input.sql !== "string") {
		throw new DbError("invalid_input", "The call needs a `sql` text.");
	}
	const params = input.params ?? [];
	if (!Array.isArray(params)) {
		throw new DbError("invalid_input", "`params` must be an array.");
	}
	for (const param of params) {
		if (typeof param === "number" && !Number.isFinite(param)) {
			throw new DbError("unsupported_value", "A param number is not finite.");
		}
		const isSqlParam =
			param === null ||
			typeof param === "boolean" ||
			typeof param === "number" ||
			typeof param === "string";
		if (!isSqlParam) {
			throw new DbError(
				"invalid_input",
				"A param must be null, a boolean, a number, or a string.",
			);
		}
	}
	return { sql: input.sql, params: [...params] };
}

/**
 * Checks the arguments of `db_batch`. Throws a DbError that names the bad statement.
 * @param {unknown} input The raw value from the page.
 * @returns {{ statements: { sql: string, params: SqlParam[] }[] }}
 */
function parseBatchInput(input) {
	if (!isRecord(input) || !Array.isArray(input.statements)) {
		throw new DbError("invalid_input", "The call needs a `statements` array.");
	}
	const statements = input.statements.map((statement, index) => {
		try {
			return parseStatementInput(statement);
		} catch (error) {
			if (error instanceof DbError) {
				throw new DbError(
					error.code,
					`Statement ${index + 1}: ${error.message}`,
				);
			}
			throw error;
		}
	});
	return { statements };
}

module.exports = { parseBatchInput, parseStatementInput };
