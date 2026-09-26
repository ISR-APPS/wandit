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
 * worker uses it, so a leaked token cannot change the repository.
 */
export type GitCredentialAccess = "read" | "read-write";

/** Repository lifecycle on code.storage. */
export interface GitStore {
	/** Idempotent: returns the project's remote, creating it when missing. */
	ensureRepository(projectId: string): Promise<{ remoteUrl: string }>;
	// code.storage credentials are ES256 JWTs minted locally (WANDIT-152);
	// `remoteUrl` is the plain https remote of the same repository so the
	// caller never rebuilds the repository naming rule. `access` is
	// "read-write" when the caller omits it.
	issueCredential(
		projectId: string,
		ttlSeconds: number,
		access?: GitCredentialAccess,
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
