/**
 * Dev-only Vite plugin: adds `data-wandit-src="<file>:<line>:<col>"` to each
 * JSX element of the app. vite.config.ts registers it. In select mode,
 * src/wandit/preview-bridge.ts reads the attribute of the clicked element and
 * posts it to the wandit builder. The plugin parses each .tsx and .jsx file
 * with the Oxc parser that Vite exports. `vite build` never runs it.
 */
import path from "node:path";
import { type Plugin, parseSync, Visitor } from "vite";

/** Attribute name. The preview bridge reads the same name. */
const SOURCE_ATTRIBUTE = "data-wandit-src";

/**
 * Adds the source attribute in `vite dev` only, so the build output has no
 * file paths. It runs before the React transform, because that transform
 * compiles the JSX away.
 */
export function wanditSource(): Plugin {
	let root = process.cwd();
	return {
		name: "wandit-source",
		apply: "serve",
		enforce: "pre",
		configResolved(config) {
			root = config.root;
		},
		transform: {
			// TanStack splits each route file into `?tsr-split=` modules, so a query is allowed.
			filter: { id: { include: /\.[jt]sx(?:$|\?)/, exclude: /node_modules/ } },
			handler(code, id) {
				const [filePath = id] = id.split("?");
				const file = path.relative(root, filePath).split(path.sep).join("/");
				// A file outside the project root is not app code the agent edits.
				if (file.startsWith("..")) {
					return null;
				}
				return addSourceAttributes(code, file);
			},
		},
	};
}

/**
 * Returns `code` with the attribute in each JSX opening element, after the
 * tag name and its type arguments. Returns null when nothing changes. `file`
 * is the path relative to the project root. Line and column are 1-based, as
 * editors show them.
 */
function addSourceAttributes(
	code: string,
	file: string,
): { code: string; map: null } | null {
	const parsed = parseSync(file, code);
	// A file with a syntax error stays as is; the React transform reports it.
	if (parsed.errors.length > 0) {
		return null;
	}
	const lineStarts = lineStartsOf(code);
	const inserts: { offset: number; text: string }[] = [];
	new Visitor({
		JSXOpeningElement(node) {
			// React accepts only `key` and `children` on a Fragment, and warns on other props.
			const isFragment =
				(node.name.type === "JSXIdentifier" && node.name.name === "Fragment") ||
				(node.name.type === "JSXMemberExpression" &&
					node.name.property.name === "Fragment");
			if (isFragment) {
				return;
			}
			const { line, column } = positionOf(lineStarts, node.start);
			inserts.push({
				// After the type arguments of `<List<string>>`, so the code stays valid.
				offset: node.typeArguments?.end ?? node.name.end,
				text: ` ${SOURCE_ATTRIBUTE}="${file}:${line}:${column}"`,
			});
		},
	}).visit(parsed.program);
	if (inserts.length === 0) {
		return null;
	}
	// One pass in offset order: each slice of the code goes in once.
	let result = "";
	let copiedTo = 0;
	for (const insert of inserts.sort((a, b) => a.offset - b.offset)) {
		result += code.slice(copiedTo, insert.offset) + insert.text;
		copiedTo = insert.offset;
	}
	result += code.slice(copiedTo);
	// LIMIT: no new lines, so the line numbers of the dev source map stay true;
	// columns after an attribute shift. Upgrade: magic-string with a hires map.
	return { code: result, map: null };
}

/** Offset of the first character of each line. */
function lineStartsOf(code: string): number[] {
	const starts = [0];
	for (let index = 0; index < code.length; index++) {
		if (code[index] === "\n") {
			starts.push(index + 1);
		}
	}
	return starts;
}

/** 1-based line and column of `offset`, by a binary search over the line starts. */
function positionOf(
	lineStarts: number[],
	offset: number,
): { line: number; column: number } {
	let low = 0;
	let high = lineStarts.length - 1;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if ((lineStarts[middle] ?? 0) <= offset) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}
	return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}
