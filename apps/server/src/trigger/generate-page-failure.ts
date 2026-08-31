import type { PageBuildFailureCode } from "@wandit/contracts";
import {
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../modules/ai-errors/domain";
import type { LlmProviderKind } from "../modules/ai-provider/domain/llm-provider";
import { classifyBuildFailure } from "../modules/pages/domain/build-failure";

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

export function classifyPageTaskFailure(
	error: unknown,
	context: { model: string; route: LlmProviderKind },
): { failureCode: PageBuildFailureCode; normalized: NormalizedAiError } {
	const normalized =
		classifyAiError(error, {
			model: context.model,
			route: context.route,
			surface: "page_build",
		}) ??
		classifyAiError(new Error("Page build failed"), {
			model: context.model,
			route: "none",
			surface: "page_build",
		});

	if (!normalized) {
		throw new Error("Page failure classification returned no result");
	}

	return {
		failureCode: classifyBuildFailure(error),
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
