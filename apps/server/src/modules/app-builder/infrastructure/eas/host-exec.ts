/**
 * Runs one child process on the host machine, not in a sandbox (WANDIT-194).
 * The build workspace (git, pnpm) and the EAS runner (eas) of the
 * `mobile-build` task use it. It calls `execFile` of `node:child_process`.
 */
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";

import type { SandboxHandle } from "../../domain/ports/sandbox-provider";

// `pnpm install` and `eas --json` can print more than the 1 MiB default of
// `execFile`. Node stops a child that prints more than this cap.
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

// Shell convention: 127 means "the command did not run".
const NOT_RUN_EXIT_CODE = 127;

// GNU `timeout` convention: 124 means "the time limit stopped the command".
const TIMEOUT_EXIT_CODE = 124;

// Shell convention for SIGKILL (128 + 9), used for any signal from outside.
const SIGNAL_EXIT_CODE = 137;

/**
 * `SandboxHandle["exec"]` on the host. It never rejects: a non-zero exit,
 * a failed start (127), a timeout (124), and a signal (137) all resolve.
 * The child gets PATH, HOME, CI, GIT_TERMINAL_PROMPT, and `options.env` only.
 */
export const hostExec: SandboxHandle["exec"] = (command, args, options) =>
	new Promise((resolve) => {
		execFile(
			command,
			args,
			{
				cwd: options?.cwd,
				// The worker env holds DATABASE_URL and every other secret. A
				// child never inherits it: it gets this explicit list only.
				env: {
					PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
					HOME: process.env.HOME ?? tmpdir(),
					CI: "1",
					// Git fails at once instead of a prompt for a credential.
					GIT_TERMINAL_PROMPT: "0",
					...options?.env,
				},
				encoding: "utf8",
				maxBuffer: MAX_OUTPUT_BYTES,
				timeout: options?.timeoutMs,
				// A child can trap or ignore SIGTERM. SIGKILL always stops it, so a
				// timeout always answers 124.
				killSignal: "SIGKILL",
				signal: options?.signal,
			},
			(error, stdout, stderr) => {
				if (error === null) {
					resolve({ exitCode: 0, stdout, stderr });
					return;
				}
				// A number is the exit code of the child.
				if (typeof error.code === "number") {
					resolve({ exitCode: error.code, stdout, stderr });
					return;
				}
				// A string is a Node code: a failed start (ENOENT), an output
				// above the cap, or an abort. `error.message` holds the argv,
				// which can hold a credential, so only the code is kept.
				if (typeof error.code === "string") {
					resolve({
						exitCode: NOT_RUN_EXIT_CODE,
						stdout: "",
						stderr: `${command} failed before exit (${error.code})`,
					});
					return;
				}
				// No code: a signal stopped the child. Node sets `killed` only
				// when its own timeout sent the signal.
				resolve({
					exitCode: error.killed ? TIMEOUT_EXIT_CODE : SIGNAL_EXIT_CODE,
					stdout,
					stderr: error.killed
						? `${stderr}\n${command} timed out after ${options?.timeoutMs} ms`
						: `${stderr}\n${command} stopped by ${error.signal}`,
				});
			},
		);
	});
