// Legal copy carries {token} placeholders that must become links, not plain
// text, so translate()/interpolate() cannot render it: they only produce
// strings. Callers split the template here and map each token to a React node.

export type TemplatePart =
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "token"; readonly name: string };

const TOKEN_PATTERN = /\{(\w+)\}/g;

/**
 * Cuts a dictionary string into literal runs and {token} names, in order.
 * Empty runs are dropped so that a template can start or end with a token.
 */
export function splitTemplate(template: string): TemplatePart[] {
	const parts: TemplatePart[] = [];
	let cursor = 0;

	TOKEN_PATTERN.lastIndex = 0;
	let match = TOKEN_PATTERN.exec(template);
	while (match !== null) {
		if (match.index > cursor) {
			parts.push({ kind: "text", value: template.slice(cursor, match.index) });
		}
		parts.push({ kind: "token", name: match[1] });
		cursor = match.index + match[0].length;
		match = TOKEN_PATTERN.exec(template);
	}

	if (cursor < template.length) {
		parts.push({ kind: "text", value: template.slice(cursor) });
	}

	return parts;
}
