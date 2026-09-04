import { GatewayError } from "@ai-sdk/gateway";
import { HttpException } from "@nestjs/common";
import type {
	AiErrorData,
	AiErrorKind,
	AiErrorSource,
} from "@wandit/contracts";
import {
	AISDKError,
	APICallError,
	InvalidDataContentError,
	InvalidToolInputError,
	LoadAPIKeyError,
	MessageConversionError,
	NoContentGeneratedError,
	NoImageGeneratedError,
	NoObjectGeneratedError,
	NoSuchModelError,
	NoSuchProviderError,
	NoSuchToolError,
	RetryError,
	ToolCallRepairError,
	TypeValidationError,
	UnsupportedFunctionalityError,
} from "ai";
import { TaggedBuildError } from "../../pages/domain/build-failure";
import type { AiErrorContext, NormalizedAiError } from "./normalized-ai-error";
import {
	classifyHiggsfieldState,
	classifyOpenRouterStatus,
	classifyProviderRejection,
	hasCapacitySignal,
	hasProviderAccountSignal,
	hasProviderModerationSignal,
	isImageModerationFinishReason,
	isOpenAiImageModerationCode,
	isRawModerationFinishReason,
	readOpenRouterModerationMetadata,
} from "./provider-signatures";
import {
	HIGGSFIELD_NSFW_MESSAGE,
	sanitizeModerationCategories,
	sanitizeProviderText,
} from "./sanitize-provider-text";

const NETWORK_CODE_PATTERN =
	/\b(?:ECONNRESET|ECONNREFUSED|ENOTFOUND|EPIPE|UND_ERR_(?![A-Z_]*TIMEOUT)[A-Z_]+)\b/iu;
const TIMEOUT_PATTERN =
	/timed?[ _-]?out|timeout|UND_ERR_(?:HEADERS|BODY|CONNECT)_TIMEOUT|ETIMEDOUT|ESOCKETTIMEDOUT/iu;
const NETWORK_TEXT_PATTERN = /fetch|network|terminated|socket hang up/iu;
const LEASE_LOSS_PREFIX = "AI chat execution lease";
const CONNECTOR_TIMEOUT_PATTERN =
	/cannotFollow|could not follow|accepted.{0,100}(?:did not report|could not follow)|timed out waiting for the provider|follow deadline|status poll.{0,80}(?:12|twelve|errored)/iu;
const FORWARD_KINDS = new Set<AiErrorKind>([
	"content_moderated",
	"connector_account",
	"connector_rejected",
]);

type ErrorRecord = Record<string, unknown>;

type NormalizedInit = {
	kind: AiErrorKind;
	source?: AiErrorSource;
	provider?: string | null;
	providerLabel?: string | null;
	retryable?: boolean;
	terminal?: boolean;
	moderationStage?: "input" | "output" | null;
	userMessageKey?: `errors.ai.${string}`;
	providerMessage?: string | null;
	statusCode?: number | null;
	requestId?: string | null;
	gatewayGenerationId?: string | null;
	openrouterGenerationId?: string | null;
	rawCause?: unknown;
	rawResponseBody?: string | null;
};

type ProviderPayload = {
	root: ErrorRecord;
	error: ErrorRecord;
	metadata: ErrorRecord | null;
	moderationDetails: ErrorRecord | null;
	values: unknown[];
};

/** Tool-call validation warnings return null because the agent loop continues. */
export function classifyAiError(
	error: unknown,
	context: AiErrorContext,
): NormalizedAiError | null {
	const abort = classifyAbort(context, error);
	if (abort) return abort;

	const billing = classifyBilling(error, context);
	if (billing) return billing;

	if (error instanceof TaggedBuildError) {
		const providerCause = providerCauseOf(error.cause);
		if (providerCause !== null) {
			return classifyAiError(providerCause, {
				...context,
				abortSignal: undefined,
			});
		}

		return normalize(error, context, {
			kind: buildFailureKind(error.failureCode),
			provider: error.failureCode.startsWith("provider_")
				? providerForContext(context)
				: null,
			source: buildFailureSource(error.failureCode),
			statusCode:
				error.failureCode === "insufficient_credits"
					? 402
					: error.failureCode === "member_limit"
						? 403
						: null,
		});
	}

	if (isGatewayAuthenticationWrapper(error)) {
		return normalize(error, context, {
			kind: "auth_config",
			provider: null,
			source: "gateway",
		});
	}

	if (RetryError.isInstance(error)) {
		const classified = classifyAiError(error.lastError, {
			...context,
			abortSignal: undefined,
		});
		if (classified && error.reason === "maxRetriesExceeded") {
			classified.retryable = true;
		}
		return classified;
	}

	if (GatewayError.isInstance(error)) {
		return classifyGatewayError(error, context);
	}

	if (APICallError.isInstance(error)) {
		return classifyApiCallError(error, context);
	}

	const openRouterStreamError = unwrapStreamError(error);
	if (
		context.route === "openrouter" &&
		isPlainRecord(openRouterStreamError) &&
		typeof openRouterStreamError.code === "number" &&
		typeof openRouterStreamError.message === "string"
	) {
		return classifyOpenRouterStreamError(openRouterStreamError, error, context);
	}

	if (context.route === "vercel" && isPlainRecord(openRouterStreamError)) {
		return classifyGatewayStreamError(openRouterStreamError, error, context);
	}

	if (
		NoSuchProviderError.isInstance(error) ||
		LoadAPIKeyError.isInstance(error)
	) {
		return normalize(error, context, {
			kind: "auth_config",
			source: context.route === "vercel" ? "gateway" : "ours",
		});
	}

	if (NoSuchModelError.isInstance(error)) {
		return normalize(error, context, {
			kind: "model_not_found",
			source:
				context.route === "vercel" ? "gateway" : sourceForContext(context),
		});
	}

	if (
		InvalidToolInputError.isInstance(error) ||
		NoSuchToolError.isInstance(error) ||
		ToolCallRepairError.isInstance(error)
	) {
		return null;
	}

	if (NoObjectGeneratedError.isInstance(error)) {
		return normalize(error, context, {
			kind:
				error.finishReason === "content-filter"
					? "content_moderated"
					: "provider_error",
			moderationStage:
				error.finishReason === "content-filter" ? "output" : null,
			source: providerSourceForContext(context),
		});
	}

	if (NoImageGeneratedError.isInstance(error)) {
		if (error.cause !== undefined) {
			const classified = classifyAiError(error.cause, {
				...context,
				abortSignal: undefined,
			});
			if (classified) return classified;
		}

		return normalize(error, context, {
			kind: "provider_error",
			source: providerSourceForContext(context),
		});
	}

	if (NoContentGeneratedError.isInstance(error)) {
		return normalize(error, context, {
			kind: "provider_error",
			source: providerSourceForContext(context),
		});
	}

	if (
		AISDKError.isInstance(error) &&
		(error.name === "MCPClientError" || error.name === "MCPClientOAuthError")
	) {
		return normalize(error, context, {
			kind: "connector_unreachable",
			provider: connectorProvider(context),
			source: connectorSource(context),
			terminal: false,
		});
	}

	if (isConnectorTaskError(error)) {
		return (
			classifyMcpResult(connectorTaskResult(error), {
				...context,
				route: "mcp",
			}) ??
			normalize(error, context, {
				kind: "connector_rejected",
				provider: connectorProvider(context),
				retryable: context.refunded === true,
				source: connectorSource(context),
			})
		);
	}

	if (isSdkValidationError(error)) {
		return normalize(error, context, {
			kind: "internal",
			provider: null,
			source: "ours",
		});
	}

	const finalText = errorText(error);
	if (hasTimeoutSignal(error, finalText)) {
		return normalize(error, context, {
			kind: "timeout",
			source: sourceForTransport(error, context),
		});
	}

	if (isNetworkTypeError(error, finalText)) {
		return normalize(error, context, {
			kind: "network",
			source: sourceForTransport(error, context),
		});
	}

	if (!hasAiMarker(error) && statusCodeOf(error) === null) {
		return normalize(error, context, {
			kind: "internal",
			provider: null,
			source: "ours",
		});
	}

	return normalize(error, context, { kind: "unknown", source: "unknown" });
}

export function classifyFinish(
	context: AiErrorContext,
): NormalizedAiError | null {
	const hasImage = context.outputFiles?.some((file) =>
		file.mediaType.toLowerCase().startsWith("image/"),
	);

	if (context.surface === "image" && hasImage !== true) {
		if (
			context.finishReason === "content-filter" ||
			isImageModerationFinishReason(context.rawFinishReason)
		) {
			return normalize(null, context, {
				kind: "content_moderated",
				moderationStage: "output",
				source: providerSourceForContext(context),
			});
		}

		return normalize(null, context, {
			kind: "provider_error",
			source: providerSourceForContext(context),
		});
	}

	if (context.finishReason === "content-filter") {
		return normalize(null, context, {
			kind: "content_moderated",
			moderationStage: context.outputText?.trim() ? "output" : "input",
			source: providerSourceForContext(context),
		});
	}

	if (
		context.route === "vercel" &&
		context.finishReason === "other" &&
		!context.outputText?.trim() &&
		isRawModerationFinishReason(context.rawFinishReason)
	) {
		return normalize(null, context, {
			kind: "content_moderated",
			moderationStage: "input",
			source: providerSourceForContext(context),
		});
	}

	if (
		context.route === "openrouter" &&
		context.finishReason === "other" &&
		context.rawFinishReason === "error" &&
		context.sawErrorPart === false
	) {
		return normalize(null, context, {
			kind: "provider_error",
			source: "openrouter",
		});
	}

	return null;
}

export function classifyMcpResult(
	result: unknown,
	context: AiErrorContext,
): NormalizedAiError | null {
	const evidence = mcpEvidence(result);
	const provider = connectorProvider(context);
	const source = connectorSource(context);
	const rawText = evidence.text;

	if (evidence.connectorTimedOut) {
		return normalize(result, context, {
			kind: "timeout",
			provider,
			rawCause: result,
			requestId: evidence.requestId,
			retryable: false,
			source,
			userMessageKey: "errors.ai.timeout_connector",
		});
	}

	const stateKind = evidence.states
		.map(classifyHiggsfieldState)
		.find((kind) => kind !== null);

	if (
		stateKind === "content_moderated" ||
		(rawText !== null && /\b(?:nsfw|moderat)\w*/iu.test(rawText))
	) {
		return normalize(result, context, {
			kind: "content_moderated",
			moderationStage: null,
			provider,
			providerMessage: HIGGSFIELD_NSFW_MESSAGE,
			rawCause: result,
			requestId: evidence.requestId,
			retryable: false,
			source,
		});
	}

	if (
		stateKind === "cancelled" ||
		(rawText !== null && /\bcancel(?:ed|led)\b/iu.test(rawText))
	) {
		return normalize(result, context, {
			kind: "cancelled",
			provider,
			rawCause: result,
			requestId: evidence.requestId,
			retryable: false,
			source,
		});
	}

	if (evidence.unlimitedChoice) {
		const rejection = classifyProviderRejection("Requires plus plan");
		return connectorAccount(
			result,
			context,
			provider,
			source,
			rejection.userMessage,
			evidence.requestId,
		);
	}

	if (rawText !== null) {
		const rejection = classifyProviderRejection(rawText);
		if (rejection.kind === "credits" || rejection.kind === "plan") {
			return connectorAccount(
				result,
				context,
				provider,
				source,
				rejection.userMessage,
				evidence.requestId,
			);
		}

		if (rejection.kind === "validation") {
			return normalize(result, context, {
				kind: "connector_rejected",
				provider,
				providerMessage: sanitizeProviderText(rejection.userMessage, {
					connectorSlug: context.connectorSlug,
					kind: "connector_rejected",
					provider,
				}),
				rawCause: result,
				requestId: evidence.requestId,
				retryable: false,
				source,
			});
		}
	}

	if (stateKind === "connector_rejected" || evidence.isError) {
		return normalize(result, context, {
			kind: "connector_rejected",
			provider,
			providerMessage:
				rawText === null
					? null
					: sanitizeProviderText(rawText, {
							connectorSlug: context.connectorSlug,
							kind: "connector_rejected",
							provider,
						}),
			rawCause: result,
			requestId: evidence.requestId,
			retryable: context.refunded === true,
			source,
		});
	}

	return null;
}

export function toClientAiError(
	normalized: NormalizedAiError,
	toolCallId?: string,
): AiErrorData {
	return {
		kind: normalized.kind,
		moderationStage: normalized.moderationStage,
		providerLabel: normalized.providerLabel,
		providerMessage: FORWARD_KINDS.has(normalized.kind)
			? normalized.providerMessage
			: null,
		refunded: normalized.refunded,
		requestId: normalized.requestId,
		retryable: normalized.retryable,
		source: normalized.source,
		terminal: normalized.terminal,
		...(toolCallId === undefined ? {} : { toolCallId }),
	};
}

function classifyAbort(
	context: AiErrorContext,
	error: unknown,
): NormalizedAiError | null {
	const signal = context.abortSignal;
	if (!signal) return null;

	const reason = signal.reason;
	if (nameOf(reason) === "TimeoutError") {
		return normalize(error, context, {
			kind: "timeout",
			provider: null,
			source: "ours",
			userMessageKey: "errors.ai.timeout_budget",
		});
	}

	if (reason instanceof Error && reason.message.startsWith(LEASE_LOSS_PREFIX)) {
		return normalize(reason, context, {
			kind: "internal",
			provider: null,
			source: "ours",
		});
	}

	if (nameOf(reason) === "AbortError" || signal.aborted) {
		return normalize(reason ?? error, context, {
			kind: "cancelled",
			provider: null,
			source: "ours",
		});
	}

	return null;
}

function classifyBilling(
	error: unknown,
	context: AiErrorContext,
): NormalizedAiError | null {
	if (!(error instanceof HttpException)) return null;

	const status = error.getStatus();
	const response = error.getResponse();
	const code = isRecord(response) ? read(response, "code") : null;
	if (
		status !== 402 &&
		!(status === 403 && code === "MEMBER_CREDIT_LIMIT_REACHED")
	) {
		return null;
	}

	return normalize(error, context, {
		kind: "billing",
		provider: null,
		source: "ours",
		statusCode: status,
	});
}

function classifyGatewayError(
	error: GatewayError,
	context: AiErrorContext,
): NormalizedAiError {
	const provider = providerForContext(context);
	const cause = error.cause;
	const causeText = `${errorText(cause)} ${codeOf(cause) ?? ""}`;

	if (isNetworkCause(cause, causeText)) {
		return normalize(error, context, {
			kind: "network",
			provider,
			retryable: error.isRetryable,
			source: "gateway",
		});
	}

	if (isTimeoutCause(cause, causeText)) {
		return normalize(error, context, {
			kind: "timeout",
			provider,
			retryable: error.isRetryable,
			source: "gateway",
		});
	}

	if (nameOf(cause) === "AbortError") {
		return normalize(error, context, {
			kind: "cancelled",
			provider: null,
			source: "ours",
		});
	}

	if (APICallError.isInstance(cause)) {
		const structured = classifyStructuredProviderSignal(
			cause,
			error,
			context,
			provider,
		);
		if (structured) return structured;
	}

	if (error.statusCode === 408 || error.statusCode === 504) {
		return gatewayNormalized(error, context, provider, "timeout");
	}

	if (error.statusCode === 429) {
		const values = gatewaySignalValues(error);
		const hasRetryAfter = hasRetryAfterHeader(error.cause);
		if (hasProviderAccountSignal(provider, values, { hasRetryAfter })) {
			return gatewayNormalized(error, context, provider, "auth_config");
		}
		return gatewayNormalized(error, context, provider, "rate_limited");
	}

	if (error.statusCode === 503 || error.statusCode === 529) {
		return gatewayNormalized(error, context, provider, "capacity");
	}

	if (
		error.type === "authentication_error" ||
		error.type === "forbidden" ||
		error.type === "failed_dependency"
	) {
		return gatewayNormalized(error, context, null, "auth_config");
	}

	if (error.type === "model_not_found") {
		return gatewayNormalized(error, context, null, "model_not_found");
	}

	if (error.type === "invalid_request_error") {
		const structured = classifyGatewayBodySignal(error, context, provider);
		if (structured) return structured;
		return gatewayNormalized(error, context, provider, "invalid_request");
	}

	if (error.type === "timeout_error" || error.name === "GatewayTimeoutError") {
		return gatewayNormalized(error, context, provider, "timeout");
	}

	if (error.type === "response_error") {
		return gatewayNormalized(error, context, provider, "provider_error");
	}

	if (
		hasCapacitySignal(gatewaySignalValues(error)) ||
		failedProviderAttemptStatuses(context.providerMetadata).some(
			(status) => status === 503 || status === 529,
		)
	) {
		return gatewayNormalized(error, context, provider, "capacity");
	}

	return gatewayNormalized(error, context, provider, "provider_error");
}

function classifyApiCallError(
	error: APICallError,
	context: AiErrorContext,
): NormalizedAiError {
	const host = urlHost(error.url);
	const isOpenRouter =
		host === "openrouter.ai" || host.endsWith(".openrouter.ai");
	let provider = isOpenRouter
		? null
		: (providerFromHost(host) ?? providerForContext(context));
	let providerLabel: string | null | undefined;
	const payload = providerPayload(error.data ?? parseJson(error.responseBody));

	if (isOpenRouter) {
		const moderationMetadata = readOpenRouterModerationMetadata(
			payload?.metadata,
		);
		if (moderationMetadata?.providerName) {
			provider = providerSlug(moderationMetadata.providerName);
			providerLabel = moderationMetadata.providerName.slice(0, 40);
		}

		if (error.statusCode === 403 && moderationMetadata) {
			const providerMessage = sanitizeModerationCategories(
				moderationMetadata.reasons,
			);
			return normalize(error, context, {
				kind: "content_moderated",
				moderationStage: "input",
				provider,
				providerLabel,
				providerMessage,
				source: "openrouter",
			});
		}

		const kind =
			classifyOpenRouterStatus(error.statusCode, {
				hasModerationReasons: moderationMetadata !== null,
			}) ?? "provider_error";
		return normalize(error, context, {
			kind,
			provider,
			providerLabel,
			retryable: retryableByKind(kind),
			source: "openrouter",
		});
	}

	const structured = classifyStructuredProviderSignal(
		error,
		error,
		context,
		provider,
	);
	if (structured) return structured;

	const status = error.statusCode;
	let kind: AiErrorKind;
	if (status === 408 || status === 504) kind = "timeout";
	else if (status === 429) kind = "rate_limited";
	else if (status === 503 || status === 529) kind = "capacity";
	else if (status === 401 || status === 402 || status === 403)
		kind = "auth_config";
	else if (status === 404) kind = "model_not_found";
	else if (status === 400 || status === 413 || status === 422)
		kind = "invalid_request";
	else if (hasCapacitySignal(payload?.values ?? [])) kind = "capacity";
	else kind = "provider_error";

	return normalize(error, context, {
		kind,
		provider,
		retryable: retryableByKind(kind),
		source: provider ? providerSource(provider) : "unknown",
	});
}

function classifyStructuredProviderSignal(
	apiError: APICallError,
	rawError: unknown,
	context: AiErrorContext,
	provider: string | null,
): NormalizedAiError | null {
	const payload = providerPayload(
		apiError.data ?? parseJson(apiError.responseBody),
	);
	if (!payload) return null;

	const resolvedProvider = provider ?? providerForContext(context);
	const code = read(payload.error, "code");
	const type = read(payload.error, "type");
	const param = read(payload.error, "param");
	const message = stringValue(read(payload.error, "message"));
	const source = resolvedProvider
		? providerSource(resolvedProvider)
		: context.route === "vercel"
			? "gateway"
			: "unknown";

	if (isOpenAiImageModerationCode(code)) {
		const categories = moderationCategories(payload.moderationDetails);
		return normalize(rawError, context, {
			kind: "content_moderated",
			moderationStage: moderationStage(
				read(payload.moderationDetails, "moderation_stage"),
			),
			provider: resolvedProvider ?? "openai",
			providerMessage: sanitizeModerationCategories(categories),
			source: resolvedProvider ? source : "provider:openai",
			statusCode: apiError.statusCode ?? null,
		});
	}

	const promptFeedback = isRecord(read(payload.root, "promptFeedback"))
		? (read(payload.root, "promptFeedback") as ErrorRecord)
		: null;
	if (read(promptFeedback, "blockReason") !== undefined) {
		return normalize(rawError, context, {
			kind: "content_moderated",
			moderationStage: context.surface === "image" ? "output" : "input",
			provider: resolvedProvider ?? "google",
			source: resolvedProvider ? source : "provider:google",
			statusCode: apiError.statusCode ?? null,
		});
	}

	if (
		hasProviderModerationSignal(resolvedProvider, [code, type, param, message])
	) {
		return normalize(rawError, context, {
			kind: "content_moderated",
			moderationStage: "input",
			provider: resolvedProvider,
			providerMessage:
				message === null
					? null
					: sanitizeProviderText(message, {
							kind: "content_moderated",
							provider: resolvedProvider,
						}),
			source,
			statusCode: apiError.statusCode ?? null,
		});
	}

	const hasRetryAfter = hasRetryAfterHeader(apiError);
	if (
		hasProviderAccountSignal(resolvedProvider, payload.values, {
			hasRetryAfter: apiError.statusCode === 429 && hasRetryAfter,
		})
	) {
		return normalize(rawError, context, {
			kind: "auth_config",
			provider: resolvedProvider,
			source,
			statusCode: apiError.statusCode ?? null,
		});
	}

	return null;
}

function classifyGatewayBodySignal(
	error: GatewayError,
	context: AiErrorContext,
	provider: string | null,
): NormalizedAiError | null {
	const parsed = parseJson(responseBodyOf(error));
	const payload = providerPayload(parsed);
	if (!payload) return null;

	const values = payload.values;
	if (hasProviderModerationSignal(provider, values)) {
		return normalize(error, context, {
			kind: "content_moderated",
			moderationStage: "input",
			provider,
			source: provider ? providerSource(provider) : "gateway",
		});
	}

	return null;
}

function classifyOpenRouterStreamError(
	error: ErrorRecord,
	rawError: unknown,
	context: AiErrorContext,
): NormalizedAiError {
	const metadata = isRecord(read(error, "metadata"))
		? (read(error, "metadata") as ErrorRecord)
		: null;
	const providerName = stringValue(read(metadata, "provider_name"));
	const provider = providerName ? providerSlug(providerName) : null;
	const kind = classifyOpenRouterStatus(error.code) ?? "provider_error";

	return normalize(rawError, context, {
		kind,
		provider,
		providerLabel: providerName?.slice(0, 40) ?? null,
		rawCause: rawError,
		source: "openrouter",
		statusCode: error.code as number,
	});
}

function classifyGatewayStreamError(
	error: ErrorRecord,
	rawError: unknown,
	context: AiErrorContext,
): NormalizedAiError {
	const status =
		numericStatus(read(error, "statusCode")) ??
		numericStatus(read(error, "code"));
	let kind: AiErrorKind;
	if (status === 408 || status === 504) kind = "timeout";
	else if (status === 429) kind = "rate_limited";
	else if (status === 503 || status === 529) kind = "capacity";
	else if (status === 401 || status === 402 || status === 403)
		kind = "auth_config";
	else if (status === 400 || status === 413 || status === 422)
		kind = "invalid_request";
	else kind = "provider_error";

	return normalize(rawError, context, {
		kind,
		provider: providerForContext(context),
		rawCause: rawError,
		source: "gateway",
		statusCode: status,
	});
}

function gatewayNormalized(
	error: GatewayError,
	context: AiErrorContext,
	provider: string | null,
	kind: AiErrorKind,
): NormalizedAiError {
	const upstreamKind =
		kind === "capacity" ||
		kind === "provider_error" ||
		kind === "invalid_request" ||
		kind === "content_moderated";
	return normalize(error, context, {
		kind,
		provider,
		retryable:
			kind === "auth_config" ||
			kind === "model_not_found" ||
			kind === "invalid_request"
				? false
				: error.isRetryable,
		source: upstreamKind && provider ? providerSource(provider) : "gateway",
	});
}

function normalize(
	error: unknown,
	context: AiErrorContext,
	init: NormalizedInit,
): NormalizedAiError {
	const provider =
		init.provider === undefined ? providerForContext(context) : init.provider;
	const label =
		init.providerLabel === undefined
			? providerLabel(provider)
			: init.providerLabel;
	const gatewayGenerationId =
		init.gatewayGenerationId === undefined
			? (gatewayGenerationIdOf(error) ??
				gatewayGenerationIdOfMetadata(context.providerMetadata))
			: init.gatewayGenerationId;
	const openrouterGenerationId =
		init.openrouterGenerationId === undefined
			? (openrouterGenerationIdOf(error) ??
				openrouterGenerationIdOfMetadata(context.providerMetadata))
			: init.openrouterGenerationId;
	const statusCode =
		init.statusCode === undefined ? statusCodeOf(error) : init.statusCode;
	const moderationStage = init.moderationStage ?? null;
	const providerMessage = FORWARD_KINDS.has(init.kind)
		? (init.providerMessage ?? null)
		: null;
	const requestId = boundedId(
		init.requestId === undefined
			? (gatewayGenerationId ?? openrouterGenerationId ?? requestIdOf(error))
			: init.requestId,
	);
	const messageKey =
		init.userMessageKey ??
		(init.kind === "content_moderated" && moderationStage === "output"
			? "errors.ai.content_moderated_output"
			: (`errors.ai.${init.kind}` as const));
	const responseBody =
		init.rawResponseBody === undefined
			? responseBodyOf(error)
			: init.rawResponseBody;

	return {
		gatewayGenerationId,
		kind: init.kind,
		model: context.model ?? modelOf(error),
		moderationStage,
		openrouterGenerationId,
		provider,
		providerLabel: label,
		providerMessage,
		raw: {
			cause:
				init.rawCause === undefined
					? isRecord(error)
						? read(error, "cause")
						: null
					: init.rawCause,
			message: errorText(error),
			name: nameOf(error),
			providerAttempts: providerAttemptsOf(context.providerMetadata),
			responseBody,
		},
		refunded: context.refunded ?? null,
		requestId,
		retryable: init.retryable ?? retryableByKind(init.kind),
		sentryEventId: null,
		source: init.source ?? sourceForContext(context),
		statusCode,
		terminal: init.terminal ?? init.kind !== "connector_unreachable",
		userMessage: {
			key: messageKey,
			params: {
				...(label ? { provider: label } : {}),
				...(providerMessage ? { text: providerMessage } : {}),
			},
		},
	};
}

function connectorAccount(
	result: unknown,
	context: AiErrorContext,
	provider: string,
	source: AiErrorSource,
	message: string,
	requestId: string | null = null,
): NormalizedAiError {
	return normalize(result, context, {
		kind: "connector_account",
		provider,
		providerMessage: sanitizeProviderText(message, {
			connectorSlug: context.connectorSlug,
			kind: "connector_account",
			provider,
		}),
		rawCause: result,
		requestId,
		retryable: false,
		source,
	});
}

function providerPayload(value: unknown): ProviderPayload | null {
	if (!isRecord(value)) return null;

	const error = isRecord(read(value, "error"))
		? (read(value, "error") as ErrorRecord)
		: value;
	const metadata = isRecord(read(error, "metadata"))
		? (read(error, "metadata") as ErrorRecord)
		: null;
	const moderationDetails = isRecord(read(error, "moderation_details"))
		? (read(error, "moderation_details") as ErrorRecord)
		: null;
	const values = [
		read(error, "code"),
		read(error, "type"),
		read(error, "param"),
		read(error, "message"),
		read(value, "code"),
		read(value, "message"),
	];

	return { error, metadata, moderationDetails, root: value, values };
}

function moderationCategories(details: ErrorRecord | null): unknown[] {
	const categories = read(details, "categories");
	if (Array.isArray(categories)) return categories;
	if (!isRecord(categories)) return [];

	return Object.entries(categories)
		.filter(([, enabled]) => enabled === true)
		.map(([category]) => category);
}

function moderationStage(value: unknown): "input" | "output" {
	if (value === "output") return "output";
	if (value === "input") return "input";
	return "input";
}

function mcpEvidence(result: unknown): {
	connectorTimedOut: boolean;
	isError: boolean;
	requestId: string | null;
	states: string[];
	text: string | null;
	unlimitedChoice: boolean;
} {
	const record = isRecord(result) ? result : null;
	const contentText = mcpText(result);
	const exactParsed = contentText ? parseJson(contentText.trim()) : null;
	const parsed = contentText ? parseJsonFromText(contentText) : null;
	const roots = [record, isRecord(parsed) ? parsed : null].filter(
		(value): value is ErrorRecord => value !== null,
	);
	const states = roots.flatMap((root) =>
		collectNamedStrings(root, /(?:^|_)(?:state|status)$/iu),
	);
	if (typeof result === "string") states.push(result);
	const text =
		exactParsed === null ? contentText : mcpStructuredErrorText(roots);
	const signalTexts = [...states, ...(text === null ? [] : [text])];
	const receiptTypes = roots.flatMap((root) =>
		collectNamedStrings(root, /^(?:type|question_type)$/iu),
	);
	const requestId =
		roots
			.flatMap((root) =>
				collectNamedStrings(root, /^(?:provider[_-]?)?request[_-]?id$/iu),
			)
			.map(boundedId)
			.find((value) => value !== null) ?? null;
	const timeoutFlag = roots.some(
		(root) =>
			read(root, "cannotFollow") === true ||
			read(root, "deadline") === true ||
			read(root, "verdict") === false ||
			(Number(read(root, "consecutiveStatusErrors")) >= 12 &&
				Number.isFinite(Number(read(root, "consecutiveStatusErrors")))),
	);

	return {
		connectorTimedOut:
			timeoutFlag ||
			signalTexts.some((value) => CONNECTOR_TIMEOUT_PATTERN.test(value)),
		isError: read(record, "isError") === true,
		requestId,
		states,
		text,
		unlimitedChoice:
			roots.some((root) => hasKeyDeep(root, "unlim_choice")) ||
			receiptTypes.some((value) => /^unlim_choice$/iu.test(value)) ||
			/\bunlim_choice\b|which plan to use|unlimited allowance.{0,80}paid credits|plan question/iu.test(
				text ?? "",
			),
	};
}

function mcpStructuredErrorText(roots: ErrorRecord[]): string | null {
	for (const root of roots) {
		const nestedError = read(root, "error");
		if (isRecord(nestedError)) {
			const message = stringValue(read(nestedError, "message"));
			if (message) return message;
		}

		for (const key of ["task_status_msg", "detail"]) {
			const value = stringValue(read(root, key));
			if (value) return value;
		}
	}

	return null;
}

function mcpText(result: unknown): string | null {
	if (typeof result === "string") return result.trim() || null;
	if (!isRecord(result)) return null;

	const content = read(result, "content");
	if (Array.isArray(content)) {
		for (const item of content) {
			if (!isRecord(item)) continue;
			const text = stringValue(read(item, "text"));
			if (text) return text;
		}
	}

	for (const key of [
		"task_status_msg",
		"detail",
		"message",
		"state",
		"status",
	]) {
		const value = stringValue(read(result, key));
		if (value) return value;
	}

	return null;
}

function collectNamedStrings(root: ErrorRecord, keyPattern: RegExp): string[] {
	const output: string[] = [];
	const queue: unknown[] = [root];
	const seen = new Set<unknown>();
	while (queue.length > 0 && seen.size < 100) {
		const current = queue.shift();
		if (!isRecord(current) || seen.has(current)) continue;
		seen.add(current);
		for (const [key, value] of Object.entries(current)) {
			if (keyPattern.test(key) && typeof value === "string") output.push(value);
			else if (isRecord(value) || Array.isArray(value)) queue.push(value);
		}
		if (Array.isArray(current)) queue.push(...current);
	}
	return output;
}

function hasKeyDeep(root: ErrorRecord, expected: string): boolean {
	const queue: unknown[] = [root];
	const seen = new Set<unknown>();
	while (queue.length > 0 && seen.size < 100) {
		const current = queue.shift();
		if (!isRecord(current) || seen.has(current)) continue;
		seen.add(current);
		for (const [key, value] of Object.entries(current)) {
			if (key === expected) return true;
			if (isRecord(value) || Array.isArray(value)) queue.push(value);
		}
		if (Array.isArray(current)) queue.push(...current);
	}
	return false;
}

function isConnectorTaskError(error: unknown): error is Error {
	if (!(error instanceof Error)) return false;
	const constructorName = error.constructor.name;
	return (
		constructorName === "ProviderJobFailedError" ||
		constructorName === "ProviderSubmitRejectedError" ||
		constructorName === "ProviderSubmitError" ||
		constructorName === "ProviderUnknownSubmitError" ||
		error.name === "ProviderJobFailedError" ||
		error.name === "ProviderSubmitError"
	);
}

function connectorTaskResult(error: Error): unknown {
	const record = error as Error & ErrorRecord;
	return {
		content: [
			{
				text:
					typeof record.userMessage === "string"
						? record.userMessage
						: error.message,
				type: "text",
			},
		],
		isError: true,
		...(typeof record.verdict === "boolean" ? { verdict: record.verdict } : {}),
	};
}

function isGatewayAuthenticationWrapper(error: unknown): boolean {
	return (
		nameOf(error) === "GatewayAuthenticationError" ||
		(AISDKError.isInstance(error) &&
			error.name === "GatewayError" &&
			/^Unauthenticated/u.test(error.message))
	);
}

function providerCauseOf(error: unknown): unknown | null {
	const queue: unknown[] = [error];
	const seen = new Set<unknown>();

	while (queue.length > 0 && seen.size < 25) {
		const current = queue.shift();
		if (current === null || current === undefined || seen.has(current))
			continue;
		seen.add(current);

		if (
			GatewayError.isInstance(current) ||
			APICallError.isInstance(current) ||
			RetryError.isInstance(current) ||
			NoSuchProviderError.isInstance(current) ||
			NoSuchModelError.isInstance(current)
		) {
			return current;
		}

		if (!isRecord(current)) continue;
		queue.push(read(current, "cause"), read(current, "lastError"));
		const errors = read(current, "errors");
		if (Array.isArray(errors)) queue.push(...errors);
	}

	return null;
}

function buildFailureKind(code: string): AiErrorKind {
	switch (code) {
		case "insufficient_credits":
		case "member_limit":
			return "billing";
		case "provider_rate_limited":
			return "rate_limited";
		case "provider_overloaded":
			return "capacity";
		case "provider_timeout":
			return "timeout";
		case "provider_error":
			return "provider_error";
		default:
			return "internal";
	}
}

function buildFailureSource(code: string): AiErrorSource {
	return code.startsWith("provider_") ? "gateway" : "ours";
}

function isSdkValidationError(error: unknown): boolean {
	return (
		TypeValidationError.isInstance(error) ||
		MessageConversionError.isInstance(error) ||
		InvalidDataContentError.isInstance(error) ||
		UnsupportedFunctionalityError.isInstance(error)
	);
}

function gatewaySignalValues(error: GatewayError): unknown[] {
	if (!APICallError.isInstance(error.cause)) return [error.message, error.type];
	const payload = providerPayload(
		error.cause.data ?? parseJson(error.cause.responseBody),
	);
	return [error.message, error.type, ...(payload?.values ?? [])];
}

function providerForContext(context: AiErrorContext): string | null {
	const routingProvider = routingProviderOf(context.providerMetadata);
	if (routingProvider) return routingProvider;
	if (context.connectorSlug) return providerSlug(context.connectorSlug);
	return context.model ? providerFromModel(context.model) : null;
}

function routingProviderOf(metadata: unknown): string | null {
	if (!isRecord(metadata)) return null;
	const gateway = read(metadata, "gateway");
	if (!isRecord(gateway)) return null;
	const routing = read(gateway, "routing");
	if (!isRecord(routing)) return null;
	const finalProvider = stringValue(read(routing, "finalProvider"));
	if (finalProvider) return providerSlug(finalProvider);

	const attempts = providerAttemptsOf(metadata);
	if (!Array.isArray(attempts)) return null;
	for (const attempt of attempts) {
		if (!isRecord(attempt)) continue;
		const provider = stringValue(read(attempt, "provider"));
		if (provider) return providerSlug(provider);
	}
	return null;
}

function providerAttemptsOf(metadata: unknown): unknown[] | null {
	if (!isRecord(metadata)) return null;
	const gateway = read(metadata, "gateway");
	if (!isRecord(gateway)) return null;
	const routing = read(gateway, "routing");
	if (!isRecord(routing)) return null;
	const direct = read(routing, "providerAttempts");
	if (Array.isArray(direct)) return direct;
	const modelAttempts = read(routing, "modelAttempts");
	if (!Array.isArray(modelAttempts)) return null;

	return modelAttempts.flatMap((modelAttempt) => {
		if (!isRecord(modelAttempt)) return [];
		const attempts = read(modelAttempt, "providerAttempts");
		return Array.isArray(attempts) ? attempts : [];
	});
}

function failedProviderAttemptStatuses(metadata: unknown): number[] {
	const attempts = providerAttemptsOf(metadata) ?? [];
	const lastSuccessfulAttempt = attempts.findLastIndex(
		(attempt) => isRecord(attempt) && read(attempt, "success") === true,
	);

	return attempts
		.slice(lastSuccessfulAttempt + 1)
		.filter(
			(attempt) => isRecord(attempt) && read(attempt, "success") === false,
		)
		.map((attempt) => statusCodeOf(attempt))
		.filter((status): status is number => status !== null);
}

function sourceForContext(context: AiErrorContext): AiErrorSource {
	if (context.route === "openrouter") return "openrouter";
	if (context.route === "vercel") return "gateway";
	if (context.route === "mcp") return connectorSource(context);
	return "ours";
}

function providerSourceForContext(context: AiErrorContext): AiErrorSource {
	if (context.route === "openrouter") return "openrouter";
	const provider = providerForContext(context);
	if (provider) return providerSource(provider);
	return context.route === "vercel" ? "gateway" : sourceForContext(context);
}

function sourceForTransport(
	error: unknown,
	context: AiErrorContext,
): AiErrorSource {
	if (GatewayError.isInstance(error) || context.route === "vercel")
		return "gateway";
	if (context.route === "openrouter") return "openrouter";
	return "ours";
}

function connectorProvider(context: AiErrorContext): string {
	return providerSlug(context.connectorSlug ?? "higgsfield") ?? "higgsfield";
}

function connectorSource(context: AiErrorContext): AiErrorSource {
	const provider = connectorProvider(context);
	return provider === "higgsfield" ? "higgsfield" : providerSource(provider);
}

function providerSource(provider: string): AiErrorSource {
	return `provider:${providerSlug(provider) ?? "unknown"}` as AiErrorSource;
}

function providerSlug(value: string): string | null {
	const lower = value.trim().toLowerCase();
	const known = lower.includes("anthropic")
		? "anthropic"
		: lower.includes("openai")
			? "openai"
			: lower.includes("google") || lower.includes("gemini")
				? "google"
				: lower.includes("xai") || lower.includes("x.ai")
					? "xai"
					: lower.includes("higgsfield")
						? "higgsfield"
						: null;
	if (known) return known;

	const normalized = lower
		.replace(/^provider:/u, "")
		.replace(/[^a-z0-9_-]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 40);
	return normalized || null;
}

function providerFromModel(model: string): string | null {
	if (!model.includes("/") && !model.includes(":")) return null;
	const prefix = model.split(/[/:]/u, 1)[0];
	return prefix ? providerSlug(prefix) : null;
}

function providerFromHost(host: string): string | null {
	if (!host) return null;
	if (host.includes("anthropic")) return "anthropic";
	if (host.includes("openai")) return "openai";
	if (host.includes("googleapis") || host.includes("google")) return "google";
	const parts = host.replace(/^api\./u, "").split(".");
	return providerSlug(parts[0] ?? host);
}

function providerLabel(provider: string | null): string | null {
	if (!provider) return null;
	const labels: Record<string, string> = {
		anthropic: "Anthropic",
		bedrock: "Amazon Bedrock",
		google: "Google",
		higgsfield: "Higgsfield",
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

function retryableByKind(kind: AiErrorKind): boolean {
	return (
		kind === "internal" ||
		kind === "rate_limited" ||
		kind === "capacity" ||
		kind === "provider_error" ||
		kind === "timeout" ||
		kind === "network" ||
		kind === "connector_unreachable" ||
		kind === "unknown"
	);
}

function isNetworkCause(cause: unknown, text: string): boolean {
	if (isTimeoutCause(cause, text)) return false;
	return (
		NETWORK_CODE_PATTERN.test(text) ||
		(cause instanceof TypeError && NETWORK_TEXT_PATTERN.test(text))
	);
}

function isTimeoutCause(cause: unknown, text: string): boolean {
	return nameOf(cause) === "TimeoutError" || TIMEOUT_PATTERN.test(text);
}

function hasTimeoutSignal(error: unknown, text: string): boolean {
	return isTimeoutCause(error, `${text} ${codeOf(error) ?? ""}`);
}

function isNetworkTypeError(error: unknown, text: string): boolean {
	return (
		NETWORK_CODE_PATTERN.test(`${text} ${codeOf(error) ?? ""}`) ||
		(error instanceof TypeError && NETWORK_TEXT_PATTERN.test(text))
	);
}

function hasAiMarker(error: unknown): boolean {
	return (
		AISDKError.isInstance(error) ||
		GatewayError.isInstance(error) ||
		(nameOf(error)?.startsWith("AI_") ?? false)
	);
}

function hasRetryAfterHeader(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const headers = read(value, "responseHeaders");
	if (!isRecord(headers)) return false;
	return Object.keys(headers).some(
		(key) => key.toLowerCase() === "retry-after",
	);
}

function statusCodeOf(value: unknown): number | null {
	if (!isRecord(value)) return null;
	return (
		numericStatus(read(value, "statusCode")) ??
		numericStatus(read(value, "status"))
	);
}

function numericStatus(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && /^\d{3}$/u.test(value.trim())) {
		return Number(value);
	}
	return null;
}

function requestIdOf(value: unknown): string | null {
	return findStringByKeys(value, [
		"requestId",
		"request_id",
		"providerRequestId",
		"provider_request_id",
		"x-request-id",
	]);
}

function gatewayGenerationIdOf(value: unknown): string | null {
	return findStringByKeys(value, ["generationId"], 8);
}

function openrouterGenerationIdOf(value: unknown): string | null {
	return findStringByKeys(value, ["openrouterGenerationId"], 8);
}

function gatewayGenerationIdOfMetadata(value: unknown): string | null {
	if (!isRecord(value)) return null;
	const gateway = read(value, "gateway");
	return isRecord(gateway)
		? boundedId(stringValue(read(gateway, "generationId")))
		: null;
}

function openrouterGenerationIdOfMetadata(value: unknown): string | null {
	if (!isRecord(value)) return null;
	const openrouter = read(value, "openrouter");
	return isRecord(openrouter)
		? boundedId(stringValue(read(openrouter, "generationId")))
		: null;
}

function findStringByKeys(
	value: unknown,
	keys: string[],
	maxDepth = 4,
): string | null {
	const queue: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }];
	const seen = new Set<unknown>();
	while (queue.length > 0 && seen.size < 100) {
		const current = queue.shift();
		if (!current || !isRecord(current.value) || seen.has(current.value))
			continue;
		seen.add(current.value);
		for (const key of keys) {
			const candidate = boundedId(stringValue(read(current.value, key)));
			if (candidate) return candidate;
		}
		if (current.depth >= maxDepth) continue;
		for (const nextKey of [
			"cause",
			"lastError",
			"data",
			"error",
			"responseHeaders",
		]) {
			queue.push({
				depth: current.depth + 1,
				value: read(current.value, nextKey),
			});
		}
		const errors = read(current.value, "errors");
		if (Array.isArray(errors)) {
			for (const nested of [...errors].reverse()) {
				queue.push({ depth: current.depth + 1, value: nested });
			}
		}
	}
	return null;
}

function responseBodyOf(value: unknown): string | null {
	if (!isRecord(value)) return null;
	const responseBody = read(value, "responseBody");
	if (typeof responseBody === "string") return responseBody;
	const cause = read(value, "cause");
	if (cause !== value && isRecord(cause)) return responseBodyOf(cause);
	return null;
}

function modelOf(value: unknown): string | null {
	if (!isRecord(value)) return null;
	return stringValue(read(value, "modelId"));
}

function codeOf(value: unknown): string | number | null {
	if (!isRecord(value)) return null;
	const code = read(value, "code");
	return typeof code === "string" || typeof code === "number" ? code : null;
}

function nameOf(value: unknown): string | null {
	if (!isRecord(value)) return null;
	return stringValue(read(value, "name"));
}

function errorText(value: unknown): string {
	if (typeof value === "string") return value;
	if (!isRecord(value)) return value == null ? "" : String(value);
	const message = stringValue(read(value, "message"));
	if (message) return message;
	return safeJson(value);
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return "";
	}
}

function parseJson(value: unknown): unknown | null {
	if (typeof value !== "string") return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function parseJsonFromText(value: string): unknown | null {
	const trimmed = value.trim();
	const direct = parseJson(trimmed);
	if (direct !== null) return direct;
	const start = Math.min(
		...[trimmed.indexOf("{"), trimmed.indexOf("[")].filter(
			(index) => index >= 0,
		),
	);
	if (!Number.isFinite(start)) return null;
	return parseJson(trimmed.slice(start));
}

function unwrapStreamError(value: unknown): unknown {
	if (!isPlainRecord(value) || read(value, "type") !== "error") return value;
	const nested = read(value, "error");
	return isPlainRecord(nested) ? nested : value;
}

function urlHost(value: string): string {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return "";
	}
}

function boundedId(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, 80) : null;
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function read(value: unknown, key: string): unknown {
	if (!isRecord(value)) return undefined;
	try {
		return value[key];
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is ErrorRecord {
	return typeof value === "object" && value !== null;
}

function isPlainRecord(value: unknown): value is ErrorRecord {
	if (!isRecord(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
