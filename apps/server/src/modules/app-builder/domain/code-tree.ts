/**
 * Pure helpers of the Code view (WANDIT-271): the path rule, the file tree,
 * and the file the view opens first. `CodeService` calls them with the
 * `git ls-files` paths of the sandbox worktree. This file does no I/O.
 */
import type { CodeTreeNode } from "@wandit/contracts";

/**
 * The files the Code view opens first, in this order (WANDIT-271). The
 * web-app template has `src/routes/index.tsx`; another project opens the
 * first file of the tree.
 */
const DEFAULT_FILE_PATHS = ["src/routes/index.tsx", "src/app.tsx"];

/**
 * True when the Code view may list and read `path`, a path relative to the
 * worktree root. A `.env*` file holds the per-run proxy token of the
 * sandbox, and `.git` holds the repository internals, so both stay hidden.
 */
export function isReadableCodePath(path: string): boolean {
	if (path.startsWith("/") || path.includes("\0")) {
		return false;
	}
	// A segment test, not a substring test: "src/a..b.ts" stays readable.
	const hasBadSegment = path
		.split("/")
		.some(
			(segment) =>
				segment === "" ||
				segment === "." ||
				segment === ".." ||
				segment === ".git",
		);
	const fileName = path.slice(path.lastIndexOf("/") + 1);
	return !hasBadSegment && !fileName.startsWith(".env");
}

/** One folder while the tree builds: child folders by name, file names. */
type FolderDraft = {
	folders: Map<string, FolderDraft>;
	files: Set<string>;
};

/**
 * Builds the Code view tree from worktree paths such as `src/app.tsx`.
 * It drops each path that `isReadableCodePath` rejects and each duplicate.
 * Each level lists its folders first, then its files, both sorted by name.
 */
export function buildCodeTree(paths: string[]): CodeTreeNode[] {
	const root: FolderDraft = { files: new Set(), folders: new Map() };
	for (const path of paths) {
		if (!isReadableCodePath(path)) {
			continue;
		}
		const segments = path.split("/");
		const fileName = segments.pop() ?? path;
		let folder = root;
		for (const segment of segments) {
			let child = folder.folders.get(segment);
			if (child === undefined) {
				child = { files: new Set(), folders: new Map() };
				folder.folders.set(segment, child);
			}
			folder = child;
		}
		folder.files.add(fileName);
	}
	return toNodes(root, "");
}

// `prefix` is the folder path with a trailing "/", or "" at the root.
function toNodes(folder: FolderDraft, prefix: string): CodeTreeNode[] {
	const byName = (a: string, b: string) => a.localeCompare(b, "en");
	const folders: CodeTreeNode[] = [...folder.folders]
		.sort(([a], [b]) => byName(a, b))
		.map(([name, child]) => ({
			children: toNodes(child, `${prefix}${name}/`),
			kind: "folder",
			name,
			path: `${prefix}${name}`,
		}));
	// A turn can replace a tracked file with a folder of the same name
	// before its commit; git then lists both. The folder wins.
	const files: CodeTreeNode[] = [...folder.files]
		.filter((name) => !folder.folders.has(name))
		.sort(byName)
		.map((name) => ({ kind: "file", name, path: `${prefix}${name}` }));
	return [...folders, ...files];
}

/**
 * The file the Code view opens first: the first of `DEFAULT_FILE_PATHS`
 * that the tree holds, else the first file in display order. Null only
 * when the tree holds no file.
 */
export function pickDefaultFilePath(tree: CodeTreeNode[]): string | null {
	const filePaths = listFilePaths(tree);
	return (
		DEFAULT_FILE_PATHS.find((path) => filePaths.includes(path)) ??
		filePaths[0] ??
		null
	);
}

// Depth first, in display order: the folders of a level before its files.
function listFilePaths(nodes: CodeTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.kind === "file" ? [node.path] : listFilePaths(node.children),
	);
}
