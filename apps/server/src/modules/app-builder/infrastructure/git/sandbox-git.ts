/**
 * Shared sandbox git exec helper for the versions flow (WANDIT-171).
 * `commitTurn`, `CodeStorageRepoRestorer`, `VersionsService`, `CodeService`,
 * and the mobile build workspace run git through `exec`. Each one needs the
 * same exit-code check, credential masking, and hook-off flags (WANDIT-282).
 */
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";

/**
 * Git config flags in front of every git command that `mustRunGit` and
 * `pushOnce` run (WANDIT-282).
 * Sandbox code can write `.git/hooks` and `.git/config`. The flags turn off
 * hooks, credential helpers, and the fsmonitor program, so none of them runs
 * or gets the push JWT. A live probe saw all three run without the flags.
 */
export const SAFE_GIT_CONFIG_ARGS = [
	"-c",
	"core.hooksPath=/dev/null",
	"-c",
	"credential.helper=",
	"-c",
	"core.fsmonitor=false",
] as const;

/**
 * Runs `git <SAFE_GIT_CONFIG_ARGS> <args>` in `sandbox.workspaceDir` and
 * returns the result. It reads only `exec` and `workspaceDir`, so a
 * `SandboxReader` also fits. A non-zero exit throws
 * `new errorType("<label> failed (<code>): <stderr>")`.
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
	const result = await sandbox.exec("git", [...SAFE_GIT_CONFIG_ARGS, ...args], {
		cwd: sandbox.workspaceDir,
	});
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
