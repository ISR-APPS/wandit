/**
 * Plain domain error: a caller tried to put a name outside the allow list
 * into the sandbox env. The env builder throws it before any value reaches
 * the sandbox, so a platform secret can never slip through `extra`.
 */

/** Thrown by `buildSandboxEnv` for an env name outside the allow list. */
export class SandboxEnvRejectedError extends Error {
	constructor(name: string) {
		super(`Sandbox env name "${name}" is not in SANDBOX_ENV_ALLOW_LIST`);
		this.name = "SandboxEnvRejectedError";
	}
}
