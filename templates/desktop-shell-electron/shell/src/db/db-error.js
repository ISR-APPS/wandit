/**
 * The error of a failed database command (docs/v2/desktop-apps.md, section 4).
 * Every file under src/db throws it. commands.js sends its code and message to the page.
 * It has no import, so each process and each test can load it.
 */

/**
 * A failed command of the page. `code` is one of the 6 codes of section 4:
 * migration_failed, statement_refused, sql_error, too_many_rows, unsupported_value, invalid_input.
 */
class DbError extends Error {
	/**
	 * @param {string} code One code of section 4. `src/lib/db.ts` of the template reads it.
	 * @param {string} message Text for the logs of the app.
	 */
	constructor(code, message) {
		super(message);
		this.name = "DbError";
		this.code = code;
	}
}

/**
 * Error code of SQLite when the authorizer refuses a statement (SQLITE_AUTH).
 * node:sqlite puts it in `errcode` of the thrown error.
 */
const SQLITE_AUTH = 23;

/**
 * Makes the DbError of a thrown value. A refusal of the authorizer becomes statement_refused.
 * Every other SQLite error becomes sql_error with the SQLite text.
 * @param {unknown} error The caught value.
 * @returns {DbError}
 */
function toDbError(error) {
	if (error instanceof DbError) {
		return error;
	}
	if (!(error instanceof Error)) {
		return new DbError("sql_error", String(error));
	}
	if ("errcode" in error && error.errcode === SQLITE_AUTH) {
		return new DbError(
			"statement_refused",
			`${error.message}: the app may only read and write the rows of its own tables. A schema change needs a migration.`,
		);
	}
	return new DbError("sql_error", error.message);
}

module.exports = { DbError, toDbError };
