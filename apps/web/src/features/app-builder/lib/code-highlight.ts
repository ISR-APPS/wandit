/**
 * Splits one line of generated code into colored tokens for the Code view.
 * Called by components/code/code-viewer.tsx for each line it renders.
 * No React and no imports here.
 */

// LIMIT: one tokenizer for TypeScript, SQL and JSON. Upgrade: a real editor when code editing lands.

export type CodeToken = {
	kind: "keyword" | "string" | "comment" | "number" | "plain";
	/** The exact source text. The texts of one line join back to that line. */
	text: string;
};

/** Whole words that get the keyword color. TypeScript words and lowercase SQL words share one set. */
const KEYWORDS = new Set(
	`import from export default async function const let var return if else
	throw new await true false null undefined type interface create table
	primary key not text timestamp select insert into values where`.split(/\s+/),
);

const STRING_QUOTES = new Set(["'", '"', "`"]);
const WORD_PATTERN = /[A-Za-z_$][\w$]*/y;
const NUMBER_PATTERN = /\d+(?:\.\d+)?/y;

/** The match of a sticky pattern at one column, or null. */
function matchAt(pattern: RegExp, line: string, column: number): string | null {
	pattern.lastIndex = column;
	return pattern.exec(line)?.[0] ?? null;
}

/**
 * Tokens of one line, in source order. A "//" comment runs to the end of the
 * line. A string ends at the next same quote, with no escape handling.
 * Text between the other tokens merges into one plain token. Empty line: [].
 */
export function tokenizeLine(line: string): CodeToken[] {
	const tokens: CodeToken[] = [];
	let plain = "";
	function pushToken(kind: CodeToken["kind"], text: string) {
		if (plain) tokens.push({ kind: "plain", text: plain });
		plain = "";
		tokens.push({ kind, text });
	}
	let column = 0;
	while (column < line.length) {
		const char = line.charAt(column);
		if (line.startsWith("//", column)) {
			pushToken("comment", line.slice(column));
			return tokens;
		}
		if (STRING_QUOTES.has(char)) {
			const close = line.indexOf(char, column + 1);
			const end = close === -1 ? line.length : close + 1;
			pushToken("string", line.slice(column, end));
			column = end;
			continue;
		}
		const number = matchAt(NUMBER_PATTERN, line, column);
		if (number) {
			pushToken("number", number);
			column += number.length;
			continue;
		}
		const word = matchAt(WORD_PATTERN, line, column);
		if (word) {
			if (KEYWORDS.has(word)) pushToken("keyword", word);
			else plain += word;
			column += word.length;
			continue;
		}
		plain += char;
		column += 1;
	}
	if (plain) tokens.push({ kind: "plain", text: plain });
	return tokens;
}
