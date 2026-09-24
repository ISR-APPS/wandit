/**
 * Shared contract of the V2 Code view (WANDIT-271).
 * `GET /api/v2/projects/:id/code` answers the file tree of the running
 * project sandbox. `GET .../code/file?path=` answers one file. The server
 * `CodeService` builds both answers; the web Code view parses them.
 */
import { z } from "zod";

/**
 * 512 KB. A larger file answers 413 `CODE_FILE_TOO_LARGE`. The viewer
 * shows source files, not large assets.
 */
export const CODE_FILE_MAX_BYTES = 512 * 1024;

/**
 * A folder or a file of the project worktree. `path` is relative to the
 * worktree root, for example `src/routes/index.tsx`. `name` is its last
 * segment. A folder lists its folders first, then its files, each sorted.
 */
export type CodeTreeNode =
	| { kind: "folder"; path: string; name: string; children: CodeTreeNode[] }
	| { kind: "file"; path: string; name: string };

/** Runtime validator for one tree node. `z.lazy` lets a folder hold nodes. */
export const codeTreeNodeSchema: z.ZodType<CodeTreeNode> = z.lazy(() =>
	z.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("folder"),
			path: z.string(),
			name: z.string(),
			children: z.array(codeTreeNodeSchema),
		}),
		z.object({
			kind: z.literal("file"),
			path: z.string(),
			name: z.string(),
		}),
	]),
);

/**
 * Answer of `GET /api/v2/projects/:id/code`. `defaultFilePath` is the file
 * the Code view opens first; null only when the tree holds no file.
 */
export const codeSnapshotResponseSchema = z.object({
	/** The git branch of the sandbox worktree, from `git rev-parse`. */
	branch: z.string(),
	defaultFilePath: z.string().nullable(),
	tree: z.array(codeTreeNodeSchema),
});

/** The tree answer; `CodeService.snapshot` builds it, the web Code view reads it. */
export type CodeSnapshotResponse = z.infer<typeof codeSnapshotResponseSchema>;

/**
 * Query of `GET /api/v2/projects/:id/code/file`. The server applies the
 * path rules after this parse and answers 400 `CODE_PATH_INVALID`.
 */
export const codeFileQuerySchema = z.object({
	/**
	 * Path relative to the worktree root, as the tree gives it. The cap is
	 * the Linux PATH_MAX, 4096: a longer path cannot name a file.
	 */
	path: z.string().min(1).max(4_096),
});

/** The parsed `?path=` query that `CodeController.file` passes on. */
export type CodeFileQuery = z.infer<typeof codeFileQuerySchema>;

/**
 * Answer of `GET /api/v2/projects/:id/code/file`. `content` is the UTF-8
 * text, and it is empty when `binary` is true.
 */
export const codeFileResponseSchema = z.object({
	path: z.string(),
	content: z.string(),
	/** File size in bytes, at most `CODE_FILE_MAX_BYTES`. */
	size: z.int().nonnegative(),
	/** True when the first 8 KB of the file hold a NUL byte. */
	binary: z.boolean(),
});

/** The file answer; the web maps it to a text or a binary `CodeFile`. */
export type CodeFileResponse = z.infer<typeof codeFileResponseSchema>;
