/**
 * Plain domain error: the configured harness has no implementation yet.
 * `createBuilderHarness` throws it for `opencode`, which D17 schedules
 * as a follow-up.
 */

/** Thrown when `V2_HARNESS` selects a harness the codebase does not ship. */
export class HarnessNotBuiltError extends Error {
	constructor(
		/** The env value that selected the missing harness. */
		readonly harness: string,
	) {
		super(`Harness ${harness} is not implemented`);
		this.name = "HarnessNotBuiltError";
	}
}
