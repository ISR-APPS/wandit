/**
 * Classifies page task errors before the Trigger task stores failure data.
 * The Trigger task calls these helpers after a page build stops.
 * The helpers call the shared AI and page failure classifiers.
 */
import type { PageBuildFailureCode } from "@wandit/contracts";
import {
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../modules/ai-errors/domain";
import type { LlmProviderKind } from "../modules/ai-provider/domain/llm-provider";
import {
	classifyBuildFailure,
	TaggedBuildError,
} from "../modules/pages/domain/build-failure";

export type PageFailurePersistenceValues = {
	error: string;
	failureCode: PageBuildFailureCode;
	failureKind: string;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	failureSource: string;
	sentryEventId: string | null;
};

/** Preserves provider details that hide behind page validation wrappers. */
export function classifyPageTaskFailure(
	error: unknown,
	context: { model: string; route: LlmProviderKind },
): { failureCode: PageBuildFailureCode; normalized: NormalizedAiError } {
	const failureCode = classifyBuildFailure(error);
	// Page validation keeps the stream failure in its cause, which carries the useful provider evidence.
	const rawError =
		error instanceof Error &&
		error.name === "PageValidationError" &&
		error.cause !== undefined
			? error.cause
			: error;
	const rawNormalized = classifyAiError(rawError, {
		model: context.model,
		route: context.route,
		surface: "page_build",
	});
	const needsProviderTag =
		failureCode.startsWith("provider_") &&
		(rawNormalized === null ||
			rawNormalized.kind === "internal" ||
			rawNormalized.kind === "unknown");
	// The tag exposes provider failures behind page validation wrappers without hiding useful raw classifications.
	const normalized =
		(needsProviderTag
			? classifyAiError(
					new TaggedBuildError(
						error instanceof Error ? error.message : "Page build failed",
						failureCode,
						error,
					),
					{
						model: context.model,
						route: context.route,
						surface: "page_build",
					},
				)
			: rawNormalized) ??
		classifyAiError(new Error("Page build failed"), {
			model: context.model,
			route: "none",
			surface: "page_build",
		});

	if (!normalized) {
		throw new Error("Page failure classification returned no result");
	}

	return {
		failureCode,
		normalized,
	};
}

export function pageFailurePersistenceValues(
	normalized: NormalizedAiError,
	failureCode: PageBuildFailureCode,
): PageFailurePersistenceValues {
	return {
		error: renderAiErrorSentence(normalized),
		failureCode,
		failureKind: normalized.kind,
		failureProvider: normalized.provider,
		failureProviderMessage: normalized.providerMessage,
		failureRequestId: normalized.requestId,
		failureSource: normalized.source,
		sentryEventId: normalized.sentryEventId,
	};
}
