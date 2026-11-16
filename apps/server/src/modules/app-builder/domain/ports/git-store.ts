/**
 * Port: the durable git store for app code (D21 — code.storage).
 * `commitTurn`, the mobile build, the GitHub sync, and the project delete
 * call `GitStore`. The sandbox-wake path calls `RepoRestorer` to push the repo back into a
 * fresh sandbox. WANDIT-171 implements both. The theme service reads one
 * committed file through `GitFileReader`. The Code view service reads the
 * committed tree and files through it, with no sandbox.
 */
import type { SandboxHandle } from "./sandbox-provider";

/** Nest token for the `GitStore` implementation. */
export const GIT_STORE = Symbol.for("app-builder.git-store");

/** Nest token for the `RepoRestorer` implementation. */
export const REPO_RESTORER = Symbol.for("app-builder.repo-restorer");

/**
 * What a git credential may do. "read" only fetches: the mobile build
 * worker, the restorer, and the GitHub sync use it, so a leaked token cannot
 * change the repository. "push-main" also pushes `main`: no force push, no
 * other branch, no tag (WANDIT-282). It can still delete `main` and create it
 * again; see the LIMIT at `PUSH_MAIN_REFS`. Only `commitTurn` uses it.
 * "push-github-mirror" pushes only the branch `github/main`, force included,
 * and never `main`. Only the `github-sync` worker task uses it: it copies
 * GitHub `main` there for an Update.
 */
export type GitCredentialAccess = "read" | "push-main" | "push-github-mirror";

/** Repository lifecycle on code.storage. */
export interface GitStore {
	/** Idempotent: returns the project's remote, creating it when missing. */
	ensureRepository(projectId: string): Promise<{ remoteUrl: string }>;
	// code.storage credentials are ES256 JWTs minted locally (WANDIT-152);
	// `remoteUrl` is the plain https remote of the same repository so the
	// caller never rebuilds the repository naming rule. `access` has no
	// default, so every caller picks the smallest access it needs.
	issueCredential(
		projectId: string,
		ttlSeconds: number,
		access: GitCredentialAccess,
	): Promise<{
		username: string;
		password: string;
		expiresAt: Date;
		remoteUrl: string;
	}>;
	deleteRepository(projectId: string): Promise<void>;
}

/** Pushes the stored repository back into a sandbox that lost it. */
export interface RepoRestorer {
	restore(projectId: string, sandbox: SandboxHandle): Promise<void>;
}

/** Nest token for the `GitFileReader` implementation. The module binds it to the `GitStore` class. */
export const GIT_FILE_READER = Symbol.for("app-builder.git-file-reader");

/**
 * The regular files of a `git archive` at one ref, by path from the repository root.
 * "overCeiling" means the archive is over a byte ceiling of the reader, so it gives no files.
 */
export type GitArchiveFiles =
	| { kind: "files"; files: Map<string, Uint8Array> }
	| { kind: "overCeiling" };

/**
 * Reads committed code without a sandbox. The theme GET route reads theme.json of a stopped
 * sandbox. The Code view routes read the tree and the files at the stored `main` head.
 */
export interface GitFileReader {
	/**
	 * The bytes of `path` at `ref`, a branch name or a commit sha. Null when the repository or the
	 * file does not exist there. With `maxBytes`, a larger file throws `GitFileTooLargeError`, and the
	 * reader keeps at most `maxBytes` bytes plus one network chunk. Throws on any other failure.
	 */
	readFile(
		projectId: string,
		ref: string,
		path: string,
		maxBytes?: number,
	): Promise<Uint8Array | null>;
	/**
	 * The file (blob) paths at `ref`, at most `limit` of them; folders, symlinks, and submodules are
	 * not in the list. Null when the repository or the ref does not exist. Throws on any other failure.
	 */
	listFilePaths(
		projectId: string,
		ref: string,
		limit: number,
	): Promise<string[] | null>;
	/**
	 * The regular files of the archive at `ref`, without the paths that `excludeGlobs` match, for
	 * example ".claude/**". Throws when the call fails.
	 */
	readArchiveFiles(
		projectId: string,
		ref: string,
		excludeGlobs: string[],
	): Promise<GitArchiveFiles>;
}
