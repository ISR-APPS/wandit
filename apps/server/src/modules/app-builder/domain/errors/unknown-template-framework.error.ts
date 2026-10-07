/**
 * Plain domain error: a `projects.framework` value that no template profile
 * owns. `profileForFramework` throws it. The builder turn then fails before
 * any sandbox work. A restore answers 500 and does not boot the wrong stack.
 */

/** Thrown by `profileForFramework` for an unknown `projects.framework` value. */
export class UnknownTemplateFrameworkError extends Error {
	/** Failure code the builder-turn runtime writes on the turn row. */
	readonly code = "project_template_unknown";

	constructor(framework: string) {
		super(`No template profile has the framework "${framework}"`);
		this.name = "UnknownTemplateFrameworkError";
	}
}
