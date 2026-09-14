/**
 * Shared sandbox git exec helper for the versions flow (WANDIT-171).
 * `commitTurn`, `CodeStorageRepoRestorer`, and `VersionsService` run git
 * in the project worktree through `SandboxHandle.exec`. Each one needs
 * the same exit-code check and the same credential masking.
 */
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import { SANDBOX_WORKSPACE_DIR } from "../../domain/ports/sandbox-provider";

/**
 * The sandbox path that holds the project git worktree. Alias of the
 * provider's `SANDBOX_WORKSPACE_DIR` so git callers keep their own name.
 */
export const SANDBOX_REPO_DIR = SANDBOX_WORKSPACE_DIR;

/**
 * Runs `git <args>` in `SANDBOX_REPO_DIR` and returns the result. A
 * non-zero exit throws `new errorType("<label> failed (<code>): <stderr>")`.
 * `options.secret` (a git credential) becomes `***` in the message and in a
 * default label because git echoes the remote URL on errors.
 */
export async function mustRunGit<E extends Error>(
	sandbox: SandboxHandle,
	args: string[],
	errorType: new (message: string) => E,
	options?: {
		/** Step name for the error; default is the full `git <args>` line. */
		label?: string;
		/** Credential to mask in the error text, for example the JWT. */
		secret?: string;
	},
): Promise<SandboxExecResult> {
	const result = await sandbox.exec("git", args, { cwd: SANDBOX_REPO_DIR });
	if (result.exitCode !== 0) {
		const mask = (text: string): string =>
			options?.secret === undefined
				? text
				: text.replaceAll(options.secret, "***");
		const label = mask(options?.label ?? `git ${args.join(" ")}`);
		throw new errorType(
			`${label} failed (${result.exitCode}): ${mask(result.stderr)}`,
		);
	}
	return result;
}
