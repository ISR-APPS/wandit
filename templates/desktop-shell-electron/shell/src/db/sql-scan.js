/**
 * Splits an SQL text into statements and lists the parameters of each statement.
 * database.js calls it for each command of the page and for each migration file.
 * node:sqlite prepares only the first statement of a text and has no parameter count,
 * so this file copies the token rules of SQLite (tokenize.c and sqlite3_complete).
 */

/**
 * @typedef {object} ScannedStatement
 * @property {string} sql The text of one statement, with its `;` when it has one.
 * @property {(string | null)[]} parameterNames One entry per SQLite parameter index, from index 1.
 *   Null for `?` and `?NNN`. Else the name of the parameter, for example `:id`, `@id`, or `$id`.
 */

// The token kinds of sqlite3_complete. The order is the column order of TRANSITIONS.
const SEMI = 0;
const SPACE = 1;
const OTHER = 2;
const EXPLAIN = 3;
const CREATE = 4;
const TEMP = 5;
const TRIGGER = 6;
const END = 7;

/** State of the scan at the start of a statement, and after the `;` that ends one. */
const STATEMENT_START = 1;

// The state table of sqlite3_complete (complete.c). Row: state. Column: token kind.
// States 5 to 7 are inside CREATE TRIGGER, whose body holds `;`. Only `; END ;` ends it.
// Row 0 is the INVALID state of SQLite. This scan starts at state 1, so it never reads row 0.
const TRANSITIONS = [
	[1, 0, 2, 3, 4, 2, 2, 2],
	[1, 1, 2, 3, 4, 2, 2, 2],
	[1, 2, 2, 2, 2, 2, 2, 2],
	[1, 3, 3, 2, 4, 2, 2, 2],
	[1, 4, 2, 2, 2, 4, 5, 2],
	[6, 5, 5, 5, 5, 5, 5, 5],
	[6, 6, 5, 5, 5, 5, 5, 7],
	[1, 7, 5, 5, 5, 5, 5, 5],
];

const KEYWORD_TOKENS = new Map([
	["explain", EXPLAIN],
	["create", CREATE],
	["temp", TEMP],
	["temporary", TEMP],
	["trigger", TRIGGER],
	["end", END],
]);

// The space characters of the SQLite tokenizer, plus the byte order mark that it skips.
const SPACE_CHARACTERS = " \t\n\v\f\r﻿";

function isSpace(character) {
	return SPACE_CHARACTERS.includes(character);
}

function isDigit(character) {
	return character >= "0" && character <= "9";
}

// SQLite accepts each byte above 0x7f as a letter of a name.
function isNameStart(character) {
	return (
		(character >= "a" && character <= "z") ||
		(character >= "A" && character <= "Z") ||
		character === "_" ||
		character.charCodeAt(0) >= 0x80
	);
}

function isNameCharacter(character) {
	return isNameStart(character) || isDigit(character) || character === "$";
}

// Index after the closing text `close`, searched from `from`. The end of `sql` when it is missing.
function indexAfter(sql, close, from) {
	const index = sql.indexOf(close, from);
	return index === -1 ? sql.length : index + close.length;
}

// Reads a named parameter that starts at `start` with `:`, `@`, `$`, or `#` (tokenize.c).
// Answers the index after the token, and false for `isParameter` when SQLite refuses the token.
function scanNamedParameter(sql, start) {
	let nameLength = 0;
	let index = start + 1;
	for (; index < sql.length; index++) {
		const character = sql[index];
		if (isNameCharacter(character)) {
			nameLength++;
		} else if (character === "(" && nameLength > 0) {
			// The TCL form `$name(key)`. SQLite refuses it when the `)` is missing.
			do {
				index++;
			} while (
				index < sql.length &&
				!isSpace(sql[index]) &&
				sql[index] !== ")"
			);
			if (sql[index] === ")") {
				return { end: index + 1, isParameter: true };
			}
			return { end: index, isParameter: false };
		} else if (character === ":" && sql[index + 1] === ":") {
			index++;
		} else {
			break;
		}
	}
	// `#` names a register of SQLite, not a parameter of the caller.
	return { end: index, isParameter: nameLength > 0 && sql[start] !== "#" };
}

// Gives a parameter token its index, with the rules of sqlite3ExprAssignVarNumber.
function addParameter(parameterNames, token) {
	if (token === "?") {
		parameterNames.push(null);
		return;
	}
	if (token.startsWith("?")) {
		const index = Number(token.slice(1));
		// SQLite refuses an index outside 1 to 32766, so the prepare fails before a bind.
		if (index < 1 || index > 32766) {
			return;
		}
		// A `?NNN` parameter takes no name here: node:sqlite binds it by its index.
		while (parameterNames.length < index) {
			parameterNames.push(null);
		}
		return;
	}
	if (!parameterNames.includes(token)) {
		parameterNames.push(token);
	}
}

/**
 * Splits `sql` at each `;` that ends a statement. A text with only spaces, comments, and `;`
 * gives no statement. A CREATE TRIGGER statement keeps the `;` of its body.
 * @param {string} sql
 * @returns {ScannedStatement[]}
 */
function splitStatements(sql) {
	/** @type {ScannedStatement[]} */
	const statements = [];
	let state = STATEMENT_START;
	let statementStart = 0;
	let hasToken = false;
	/** @type {(string | null)[]} */
	let parameterNames = [];
	let index = 0;
	while (index < sql.length) {
		const character = sql[index];
		let kind = OTHER;
		let end = index + 1;
		if (character === ";") {
			kind = SEMI;
		} else if (isSpace(character)) {
			kind = SPACE;
		} else if (character === "/" && sql[index + 1] === "*") {
			kind = SPACE;
			end = indexAfter(sql, "*/", index + 2);
		} else if (character === "-" && sql[index + 1] === "-") {
			kind = SPACE;
			end = indexAfter(sql, "\n", index + 2);
		} else if (character === "[") {
			end = indexAfter(sql, "]", index + 1);
		} else if (character === "'" || character === '"' || character === "`") {
			// A doubled quote inside a text reads as two texts, which gives the same end.
			end = indexAfter(sql, character, index + 1);
		} else if (character === "?") {
			while (end < sql.length && isDigit(sql[end])) {
				end++;
			}
			addParameter(parameterNames, sql.slice(index, end));
		} else if (":@$#".includes(character)) {
			const scanned = scanNamedParameter(sql, index);
			end = scanned.end;
			if (scanned.isParameter) {
				addParameter(parameterNames, sql.slice(index, end));
			}
		} else if (isNameStart(character)) {
			while (end < sql.length && isNameCharacter(sql[end])) {
				end++;
			}
			kind = KEYWORD_TOKENS.get(sql.slice(index, end).toLowerCase()) ?? OTHER;
		} else if (isDigit(character)) {
			// A number takes the name characters after it, so `1$a` holds no parameter.
			while (
				end < sql.length &&
				(isNameCharacter(sql[end]) || sql[end] === ".")
			) {
				end++;
			}
		}
		if (kind !== SEMI && kind !== SPACE) {
			hasToken = true;
		}
		state = TRANSITIONS[state][kind];
		index = end;
		if (kind === SEMI && state === STATEMENT_START) {
			if (hasToken) {
				statements.push({
					sql: sql.slice(statementStart, index),
					parameterNames,
				});
			}
			statementStart = index;
			hasToken = false;
			parameterNames = [];
		}
	}
	if (hasToken) {
		statements.push({ sql: sql.slice(statementStart), parameterNames });
	}
	return statements;
}

module.exports = { splitStatements };
