/**
 * Plain domain error: a stored resume state names another harness.
 * `ClaudeCodeHarness.resumeSession` throws it when the session row was
 * written by a different adapter than the one running now.
 */

/** Thrown when `resumeState.harness` differs from the running harness kind. */
export class HarnessResumeMismatchError extends Error {
	constructor(
		/** The harness kind the stored state belongs to. */
		readonly expected: string,
		/** The harness kind that tries to resume it. */
		readonly actual: string,
	) {
		super(`Cannot resume a ${expected} session with the ${actual} harness`);
		this.name = "HarnessResumeMismatchError";
	}
}
