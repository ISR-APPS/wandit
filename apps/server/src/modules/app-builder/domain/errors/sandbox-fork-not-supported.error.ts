/**
 * Plain domain error: sandbox forking is not built.
 * Every `SandboxProvider.fork` throws it; callers that catch it know the
 * feature is missing, not broken.
 */

/** Thrown by `SandboxProvider.fork` until P6 builds forking (D13). */
export class SandboxForkNotSupportedError extends Error {
	constructor() {
		super("Sandbox fork is not built before P6 (D13)");
		this.name = "SandboxForkNotSupportedError";
	}
}
