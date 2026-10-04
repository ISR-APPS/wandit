/**
 * Port: the durable git store for app code (D21 — code.storage).
 * The project-create flow calls `GitStore`; the sandbox-wake path calls
 * `RepoRestorer` to push the repo back into a fresh sandbox. WANDIT-171
 * implements both.
 */
import type { SandboxHandle } from "./sandbox-provider";

/** Nest token for the `GitStore` implementation. */
export const GIT_STORE = Symbol.for("app-builder.git-store");

/** Nest token for the `RepoRestorer` implementation. */
export const REPO_RESTORER = Symbol.for("app-builder.repo-restorer");

/**
 * What a git credential may do. "read" only fetches: the mobile build
 * worker and the restorer use it, so a leaked token cannot change the
 * repository. "push-main" also pushes `main`: no force push, no other
 * branch, no tag (WANDIT-282). It can still delete `main` and create it
 * again; see the LIMIT at `PUSH_MAIN_REFS`. Only `commitTurn` uses it.
 */
export type GitCredentialAccess = "read" | "push-main";

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
