/**
 * Pure helpers of the Code view (WANDIT-271): the path rule, the file tree,
 * the file the view opens first, and the files the tree answer carries.
 * `CodeService` calls them with the blob paths of the stored commit. A
 * project with no commit gives the `git ls-files` paths of its sandbox.
 * `McpChangesService` calls the write rule `isWritableCodePath`.
 * `VersionsService` calls `isAgentFilePath` for the GitHub Update.
 * This file does no I/O.
 */
import type { CodeTreeNode } from "@wandit/contracts";

/**
 * The files the Code view opens first, in this order (WANDIT-271). The
 * web-app template has `src/routes/index.tsx`; another project opens the
 * first file of the tree.
 */
const DEFAULT_FILE_PATHS = ["src/routes/index.tsx", "src/app.tsx"];

/**
 * Most paths that one prefetch command reads. The paths travel as command
 * arguments: 300 paths of at most 4096 bytes stay under the Linux
 * ARG_MAX of about 2 MB.
 */
const PREFETCH_MAX_PATHS = 300;

/** 4096 bytes, the Linux PATH_MAX. A longer path cannot name a file. */
const PREFETCH_MAX_PATH_BYTES = 4_096;

// Folders that the Code view hides, at any depth. `.git` holds the repository internals.
// `.claude` holds the agent settings, hooks, and skills: not app code.
const HIDDEN_FOLDER_NAMES = new Set([".git", ".claude"]);

// Agent instruction files that the Code view hides, at any depth. They are not app code.
const HIDDEN_FILE_NAMES = new Set([
	"CLAUDE.md",
	"CLAUDE.local.md",
	"AGENTS.md",
]);

/**
 * True when the Code view and the MCP `list_files` and `read_file` tools may
 * list and read `path`, a path relative to the worktree root. A `.env*` file
 * holds env values, for example the backend `.env` that the host writes. So
 * it stays hidden, with the folders and files of the sets above.
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
				HIDDEN_FOLDER_NAMES.has(segment),
		);
	const fileName = path.slice(path.lastIndexOf("/") + 1);
	return (
		!hasBadSegment &&
		!fileName.startsWith(".env") &&
		!HIDDEN_FILE_NAMES.has(fileName)
	);
}

// The agent folder, at any depth: Claude Code loads its settings, hooks, and skills.
const AGENT_FOLDER_NAME = ".claude";

// Agent file names, at any depth. Agents load a nested CLAUDE.md or AGENTS.md as instructions.
const AGENT_FILE_NAMES = new Set([
	"CLAUDE.md",
	"CLAUDE.local.md",
	"AGENTS.md",
	".mcp.json",
	"opencode.json",
]);

/**
 * True when `path`, relative to the worktree root, is an agent instruction or config file.
 * `isWritableCodePath` denies these paths. The GitHub Update in `VersionsService` keeps their pre-merge state.
 * The match is case-sensitive, like the Linux sandbox.
 */
export function isAgentFilePath(path: string): boolean {
	const segments = path.split("/");
	return (
		segments.includes(AGENT_FOLDER_NAME) ||
		AGENT_FILE_NAMES.has(segments[segments.length - 1] ?? "")
	);
}

// Folders that an `apply_changes` path must not enter, at any depth: git internals
// and installed packages. `isAgentFilePath` covers the agent folder.
const PROTECTED_FOLDER_NAMES = new Set([".git", "node_modules"]);

// File names that `apply_changes` must not write, at any depth, after the agent files.
// pnpm and git read a nested config file too.
const PROTECTED_FILE_NAMES = new Set([
	".npmrc",
	".pnpmfile.cjs",
	".pnpmfile.mjs",
	"pnpm-workspace.yaml",
	".gitignore",
]);

// Root files that the host and the Thème sheet own. Only the file at the root has this meaning.
const PROTECTED_ROOT_PATHS = new Set([
	"template_version",
	"native-modules.json",
	"src/styles/theme.json",
	"src/styles/theme.ts",
	"src/styles/theme-options.ts",
	"src/styles/engine.css",
]);

/**
 * True when `path` holds a control character (Unicode category Cc: U+0000 to U+001F, U+007F to U+009F).
 * Security: the guarded write script reads `$(dirname -- "$1")`, and bash `$(...)` drops a trailing newline.
 * So "CLAUDE.md\n" writes CLAUDE.md. `mcpPathSchema` in `@wandit/contracts` uses the same category.
 */
function hasControlCharacter(path: string): boolean {
	return /\p{Cc}/u.test(path);
}

/**
 * True when the `apply_changes` MCP tool may write or delete `path`, a path relative to the worktree root.
 * The sandbox hook does not see these writes, so the API applies the deny list of
 * docs/features/coding-agents-mcp.md. The match is case-sensitive: the Vercel sandbox runs Linux.
 * Every `.env*` file name is denied at any depth, as `isReadableCodePath` hides them.
 * A path with a control character is denied before the segment checks.
 */
export function isWritableCodePath(path: string): boolean {
	if (
		path.startsWith("/") ||
		hasControlCharacter(path) ||
		path.includes("\\")
	) {
		return false;
	}
	const segments = path.split("/");
	const fileName = segments[segments.length - 1] ?? "";
	const hasBadSegment = segments.some(
		(segment) =>
			segment === "" ||
			segment === "." ||
			segment === ".." ||
			PROTECTED_FOLDER_NAMES.has(segment),
	);
	return (
		!hasBadSegment &&
		!fileName.startsWith(".env") &&
		!isAgentFilePath(path) &&
		!PROTECTED_FILE_NAMES.has(fileName) &&
		!PROTECTED_ROOT_PATHS.has(path)
	);
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

/**
 * The files that `GET /code` reads with the tree, so a click on them needs
 * no request: the default file first, then `src/`, then the others, in
 * display order. A skipped file still loads on a click through
 * `GET /code/file`.
 */
export function pickPrefetchPaths(tree: CodeTreeNode[]): string[] {
	const picked = listFilePaths(tree).filter(
		(path) => Buffer.byteLength(path) <= PREFETCH_MAX_PATH_BYTES,
	);
	// The Code view opens the default file first, so the path cap and the
	// byte budget must not drop it.
	const defaultPath = pickDefaultFilePath(tree);
	const isFirst = (path: string) => path === defaultPath;
	const first = picked.filter(isFirst);
	const source = picked.filter(
		(path) => !isFirst(path) && path.startsWith("src/"),
	);
	const others = picked.filter(
		(path) => !isFirst(path) && !path.startsWith("src/"),
	);
	return [...first, ...source, ...others].slice(0, PREFETCH_MAX_PATHS);
}

// Depth first, in display order: the folders of a level before its files.
function listFilePaths(nodes: CodeTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.kind === "file" ? [node.path] : listFilePaths(node.children),
	);
}
