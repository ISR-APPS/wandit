/**
 * Plain domain error: the project has no live sandbox session row.
 * `SandboxProvider.resume` throws it when a caller asks for a sandbox that
 * was never created or already destroyed.
 */

/** Thrown when no `sandbox_sessions` row in a live status exists. */
export class SandboxNotFoundError extends Error {
	constructor(projectId: string) {
		super(`No live sandbox session for project ${projectId}`);
		this.name = "SandboxNotFoundError";
	}
}
