/**
 * Shared sandbox git exec helper for the versions flow (WANDIT-171).
 * `commitTurn`, `CodeStorageRepoRestorer`, `VersionsService`, and
 * `CodeService` run git in the project worktree through `exec`. Each one
 * needs the same exit-code check and the same credential masking.
 */
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";

/**
 * Runs `git <args>` in `sandbox.workspaceDir` and returns the result. It
 * reads only `exec` and `workspaceDir`, so a `SandboxReader` also fits. A
 * non-zero exit throws `new errorType("<label> failed (<code>): <stderr>")`.
 * `options.secret` (a git credential) becomes `***` in the message and in a
 * default label because git echoes the remote URL on errors.
 */
export async function mustRunGit<E extends Error>(
	sandbox: Pick<SandboxHandle, "exec" | "workspaceDir">,
	args: string[],
	errorType: new (message: string) => E,
	options?: {
		/** Step name for the error; default is the full `git <args>` line. */
		label?: string;
		/** Credential to mask in the error text, for example the JWT. */
		secret?: string;
	},
): Promise<SandboxExecResult> {
	const result = await sandbox.exec("git", args, { cwd: sandbox.workspaceDir });
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
