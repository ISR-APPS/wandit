// Honest copy per bounded build-failure code, shared by the chat card and
// the Page tab banner. provider_* codes explicitly say the model's PROVIDER
// — not Wandit — had the problem; every message reassures that the last
// version is safe (failed builds never touch the active page).
// English chrome, same rule as the tray strings.

import type { PageBuildFailureCode } from "@wandit/contracts";

export type BuildFailureCopy = {
	kicker: string;
	title: string;
	message: string;
};

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
		title: "The AI provider had an error.",
		message:
			"Something broke on the model provider's side — not on Wandit. Your last version is safe; a retry usually works.",
	},
	provider_overloaded: {
		kicker: "Provider issue",
		title: "The AI provider is at capacity.",
		message:
			"The model provider (not Wandit) is temporarily overloaded. Your last version is safe — try again in a minute.",
	},
	provider_rate_limited: {
		kicker: "Provider issue",
		title: "The AI provider is busy right now.",
		message:
			"Too many requests hit the model provider at once — this isn't a Wandit problem. Your last version is safe; try again in a minute.",
	},
	provider_timeout: {
		kicker: "Provider issue",
		title: "The AI provider took too long.",
		message:
			"The model provider stopped responding mid-build — not a Wandit issue. Your last version is safe — please retry.",
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
