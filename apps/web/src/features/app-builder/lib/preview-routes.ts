/**
 * Lists the pages of a generated web app from its TanStack Router file
 * routes under `src/routes/`. The route picker of the web preview calls
 * `routesFromCodeTree` with the tree of `codeSnapshotQuery`. Pure: no
 * React and no fetch.
 */

import type { CodeTreeNode } from "../api/dto";

/** One page of the app in the route picker. */
export type PreviewRoute = {
	/** URL path pattern, like `/invoices/$invoiceId`. It always starts with `/`. */
	path: string;
	/** True when a segment holds a `$param` or the `$` splat. The picker then lets the user type the value. */
	isDynamic: boolean;
};

const ROUTES_FOLDER = "src/routes/";

const ROUTE_FILE_EXTENSION = /\.(tsx|ts|jsx|js)$/;

// TanStack Router splits a file name on `/` and `.`; `[.]` escapes a dot inside one segment.
const SEGMENT_SEPARATOR = /[/.](?![^[]*\])/;

/**
 * Returns the deduped pages of every route file in `tree`. `/` comes
 * first, then the paths in code-unit order. An app with no
 * `src/routes/` folder gives an empty list.
 */
export function routesFromCodeTree(tree: CodeTreeNode[]): PreviewRoute[] {
	const routesByPath = new Map<string, PreviewRoute>();
	for (const filePath of filePathsOf(tree)) {
		const route = routeOfFile(filePath);
		if (route !== null) routesByPath.set(route.path, route);
	}
	// `/` is a prefix of every other path, so the plain string order puts it first.
	return [...routesByPath.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

function filePathsOf(nodes: CodeTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.kind === "folder" ? filePathsOf(node.children) : [node.path],
	);
}

/** The page of one file, or null when the file is not a page route. */
function routeOfFile(filePath: string): PreviewRoute | null {
	if (!filePath.startsWith(ROUTES_FOLDER)) return null;
	const relativePath = filePath.slice(ROUTES_FOLDER.length);
	const fileName = relativePath.split("/").at(-1) ?? "";
	if (
		!ROUTE_FILE_EXTENSION.test(fileName) ||
		fileName === "routeTree.gen.ts" ||
		/\.(test|spec)\./.test(fileName) ||
		// TanStack Router ignores every file and folder whose name starts with `-`.
		relativePath.split("/").some((name) => name.startsWith("-"))
	) {
		return null;
	}
	const parts = relativePath
		.replace(ROUTE_FILE_EXTENSION, "")
		.replace(/\.lazy$/, "")
		.split(SEGMENT_SEPARATOR);
	// A last part with `_` is `__root` or a pathless layout: a wrapper, not a page.
	if (parts.at(-1)?.startsWith("_")) return null;

	const segments = parts.flatMap((part) => {
		// `index` and `route` name the page of their folder; `_layout` and `(group)` add no URL segment.
		if (
			part === "index" ||
			part === "route" ||
			part.startsWith("_") ||
			/^\(.+\)$/.test(part)
		) {
			return [];
		}
		// A trailing `_` only un-nests the route (`posts_.$postId`); the URL keeps `posts`.
		const segment = part.endsWith("_") ? part.slice(0, -1) : part;
		return [segment.replaceAll(/\[([^\]]+)\]/g, "$1")];
	});
	return {
		path: `/${segments.join("/")}`,
		isDynamic: segments.some((segment) => segment.includes("$")),
	};
}
