import {
	type AiErrorData,
	type AiErrorKind,
	type AiErrorSource,
	aiErrorKindSchema,
	aiErrorSourceSchema,
} from "@wandit/contracts";

import {
	classifyAiError,
	type NormalizedAiError,
	toClientAiError,
} from "../../../ai-errors/domain";

export type AiFailurePersistenceFields = {
	failureKind: AiErrorKind;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	failureSource: AiErrorSource;
	sentryEventId: string | null;
};

export type StoredAiFailureFields = {
	failureKind?: string | null;
	failureProvider?: string | null;
	failureProviderMessage?: string | null;
	failureRequestId?: string | null;
	failureSource?: string | null;
};

const RETRYABLE_KINDS = new Set<AiErrorKind>([
	"internal",
	"rate_limited",
	"capacity",
	"provider_error",
	"timeout",
	"network",
	"connector_unreachable",
	"unknown",
]);

/** Infrastructure/lifecycle failures must never masquerade as provider faults. */
export function internalMediaFailure(input: {
	model?: string | null;
	refunded: boolean;
}): NormalizedAiError {
	const failure = classifyAiError(
		new TypeError("Media generation infrastructure failure"),
		{
			model: input.model ?? undefined,
			refunded: input.refunded,
			route: "none",
			surface: "video",
		},
	);

	if (!failure) {
		throw new Error("Internal media failure could not be classified");
	}

	return failure;
}

export function withMediaRefundOutcome(
	failure: NormalizedAiError,
	refunded: boolean,
): NormalizedAiError {
	return { ...failure, refunded };
}

export function aiFailurePersistenceFields(
	failure: NormalizedAiError,
): AiFailurePersistenceFields {
	return {
		failureKind: failure.kind,
		failureProvider: failure.provider?.slice(0, 40) ?? null,
		failureProviderMessage: failure.providerMessage?.slice(0, 240) ?? null,
		failureRequestId: failure.requestId?.slice(0, 80) ?? null,
		failureSource: failure.source,
		sentryEventId: failure.sentryEventId,
	};
}

/** Rehydrate the client-safe subset from durable failure evidence. */
export function toClientStoredAiFailure(
	input: StoredAiFailureFields,
): AiErrorData | null {
	const kind = aiErrorKindSchema.safeParse(input.failureKind);
	const source = aiErrorSourceSchema.safeParse(input.failureSource);

	if (!kind.success || !source.success) {
		return null;
	}

	const provider = boundedProvider(input.failureProvider);
	const providerLabel = labelForProvider(provider);
	const normalized: NormalizedAiError = {
		gatewayGenerationId: null,
		kind: kind.data,
		model: null,
		moderationStage: null,
		openrouterGenerationId: null,
		provider,
		providerLabel,
		providerMessage: input.failureProviderMessage?.slice(0, 240) ?? null,
		raw: {
			cause: null,
			message: "",
			name: null,
			providerAttempts: null,
			responseBody: null,
		},
		refunded: source.data === "ours" ? null : input.failureRequestId == null,
		requestId: input.failureRequestId?.slice(0, 80) ?? null,
		retryable: RETRYABLE_KINDS.has(kind.data),
		sentryEventId: null,
		source: source.data,
		statusCode: null,
		terminal: true,
		userMessage: {
			key: `errors.ai.${kind.data}`,
			params: {
				...(providerLabel ? { provider: providerLabel } : {}),
				...(input.failureProviderMessage
					? { text: input.failureProviderMessage.slice(0, 240) }
					: {}),
			},
		},
	};

	return toClientAiError(normalized);
}

export function errorForCapturedFailure(failure: NormalizedAiError): Error {
	if (failure.raw.cause instanceof Error) {
		return failure.raw.cause;
	}

	const error = new Error(failure.raw.message || "AI media call failed");
	if (failure.raw.name) {
		error.name = failure.raw.name;
	}
	return error;
}

function boundedProvider(value: string | null | undefined): string | null {
	if (!value) return null;
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 40);
	return normalized || null;
}

function labelForProvider(provider: string | null): string | null {
	if (!provider) return null;
	const labels: Record<string, string> = {
		anthropic: "Anthropic",
		bedrock: "Amazon Bedrock",
		bytedance: "Seedance",
		google: "Google",
		higgsfield: "Higgsfield",
		klingai: "Kling",
		openai: "OpenAI",
		openrouter: "OpenRouter",
		xai: "xAI",
	};

	return (
		labels[provider] ??
		provider
			.split(/[-_]+/u)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ")
	).slice(0, 40);
}
