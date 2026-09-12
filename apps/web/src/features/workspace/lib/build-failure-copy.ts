/**
 * Defines English copy for classified build failures.
 * The chat card and Page tab call this module.
 * Provider failures use one demand message and confirm that the last version is safe.
 */

import type { PageBuildFailureCode } from "@wandit/contracts";

export type BuildFailureCopy = {
	kicker: string;
	title: string;
	message: string;
};

/** One entry per PageBuildFailureCode. The four provider_* codes share the demand copy. */
export const BUILD_FAILURE_COPY: Record<
	PageBuildFailureCode,
	BuildFailureCopy
> = {
	insufficient_credits: {
		kicker: "Can't generate",
		title: "You're out of credits.",
		message:
			"This build couldn't reserve the credits it needs. Your last version is safe — top up and retry.",
	},
	internal_error: {
		kicker: "Something went wrong",
		title: "The build stopped unexpectedly.",
		message:
			"Something went wrong on our side. Your last version is safe — please retry.",
	},
	invalid_output: {
		kicker: "Something went wrong",
		title: "The build didn't produce a valid page.",
		message:
			"The builder's output failed our quality checks, so nothing was published. Your last version is safe — a retry usually fixes it.",
	},
	member_limit: {
		kicker: "Can't generate",
		title: "Your member credit limit was reached.",
		message:
			"This build needs more credits than your monthly workspace limit allows. Ask a workspace admin to raise it, then retry.",
	},
	provider_error: {
		kicker: "Provider issue",
		title: "Our AI provider is experiencing high demand.",
		message: "Please try again in a few minutes. Your last version is safe.",
	},
	provider_overloaded: {
		kicker: "Provider issue",
		title: "Our AI provider is experiencing high demand.",
		message: "Please try again in a few minutes. Your last version is safe.",
	},
	provider_rate_limited: {
		kicker: "Provider issue",
		title: "Our AI provider is experiencing high demand.",
		message: "Please try again in a few minutes. Your last version is safe.",
	},
	provider_timeout: {
		kicker: "Provider issue",
		title: "Our AI provider is experiencing high demand.",
		message: "Please try again in a few minutes. Your last version is safe.",
	},
	storage_failure: {
		kicker: "Something went wrong",
		title: "Saving the finished page failed.",
		message:
			"The page was built, but uploading it failed on our side. Your last version is safe — please retry.",
	},
};

export const GENERIC_BUILD_FAILURE: BuildFailureCopy =
	BUILD_FAILURE_COPY.internal_error;

/** Copy for a possibly-unknown code (tolerant reads degrade to null). */
export function buildFailureCopy(
	code: PageBuildFailureCode | null | undefined,
): BuildFailureCopy {
	return code ? BUILD_FAILURE_COPY[code] : GENERIC_BUILD_FAILURE;
}
