import { type AiErrorData, aiErrorDataSchema } from "@wandit/contracts";
import { isApiClientError } from "@/lib/api-client";
import type { TranslationKey, TranslationParams } from "@/lib/i18n";

export type AiErrorTranslator = (
	key: TranslationKey,
	params?: TranslationParams,
) => string;

export type ChatErrorPresentation = {
	kicker: string;
	body: string;
	attribution: string | null;
	retryable: boolean;
	showRetry: boolean;
	showBanner: boolean;
};

type KickerGroup = "provider" | "moderated" | "connector" | "ours";

const PROVIDER_KINDS = new Set<AiErrorData["kind"]>([
	"invalid_request",
	"rate_limited",
	"capacity",
	"provider_error",
	"timeout",
	"network",
]);

function kickerGroup(kind: AiErrorData["kind"]): KickerGroup {
	if (PROVIDER_KINDS.has(kind)) return "provider";
	if (kind === "content_moderated") return "moderated";
	if (
		kind === "connector_unreachable" ||
		kind === "connector_account" ||
		kind === "connector_rejected"
	)
		return "connector";
	return "ours";
}

function messageText(error: AiErrorData): string | null {
	const text = error.providerMessage?.trim();
	return text ? text : null;
}

function bodyKey(error: AiErrorData): TranslationKey {
	if (error.kind === "content_moderated" && error.moderationStage === "output")
		return "errors.ai.content_moderated_output";

	if (error.kind === "timeout") {
		if (error.source === "ours") return "errors.ai.timeout_budget";
		if (error.source === "higgsfield") return "errors.ai.timeout_connector";
	}

	if (error.kind === "connector_rejected" && !messageText(error)) {
		return "errors.ai.connector_rejected_no_text";
	}

	// Billing is owned by the existing modal and has no errors.ai sentence.
	if (error.kind === "billing") return "workspace.chat.errors.credits";

	return `errors.ai.${error.kind}` as TranslationKey;
}

function isRetryAllowed(error: AiErrorData): boolean {
	if (!error.terminal || !error.retryable) return false;

	// Keep the client safe if a stale server serialized an inconsistent flag.
	if (
		error.kind === "billing" ||
		error.kind === "cancelled" ||
		error.kind === "content_moderated" ||
		error.kind === "connector_account" ||
		(error.kind === "timeout" && error.source === "higgsfield")
	)
		return false;

	return true;
}

function appendSentence(first: string | null, second: string | null) {
	if (!first) return second;
	if (!second) return first;
	return `${first} ${second}`;
}

function attributionFor(
	error: AiErrorData,
	t: AiErrorTranslator,
	provider: string,
	text: string | null,
): string | null {
	if (error.kind === "content_moderated") {
		if (error.moderationStage === "output") {
			const filter = t("workspace.chat.aiError.attribution.outputFilter", {
				provider,
			});
			return text
				? appendSentence(
						filter,
						t("workspace.chat.aiError.attribution.reasonGiven", { text }),
					)
				: filter;
		}

		if (error.source === "openrouter" && text) {
			return t("workspace.chat.aiError.attribution.reasonGiven", { text });
		}

		if (error.source === "higgsfield") {
			return text
				? t("workspace.chat.aiError.attribution.connectorReturned", {
						connector: provider,
						text,
					})
				: t("workspace.chat.aiError.attribution.refusedPromptNoText", {
						provider,
					});
		}

		return text
			? t("workspace.chat.aiError.attribution.refusedPrompt", {
					provider,
					text,
				})
			: t("workspace.chat.aiError.attribution.refusedPromptNoText", {
					provider,
				});
	}

	if (error.kind === "connector_rejected") {
		return text
			? t("workspace.chat.aiError.attribution.connectorReturned", {
					connector: provider,
					text,
				})
			: t("workspace.chat.aiError.attribution.connectorNoReason", {
					connector: provider,
				});
	}

	if (error.kind === "connector_account") return null;

	if (PROVIDER_KINDS.has(error.kind) && error.providerLabel?.trim()) {
		if (error.source === "openrouter") {
			return t("workspace.chat.aiError.attribution.viaOpenrouter", {
				provider,
			});
		}

		if (error.source === "gateway" || error.source.startsWith("provider:")) {
			return t("workspace.chat.aiError.attribution.viaGateway", {
				provider,
			});
		}
	}

	return null;
}

function refundAttribution(
	error: AiErrorData,
	t: AiErrorTranslator,
	connector: string,
): string | null {
	if (error.refunded !== true) return null;
	if (error.source === "higgsfield") {
		return t("workspace.chat.aiError.connectorRefunded", { connector });
	}
	return t("workspace.chat.aiError.notCharged");
}

function aiErrorPresentation(
	error: AiErrorData,
	t: AiErrorTranslator,
): ChatErrorPresentation {
	const providerFallback = t("workspace.chat.aiError.providerFallback");
	const provider = error.providerLabel?.trim() || providerFallback;
	const text = messageText(error);
	const params = {
		connector: provider,
		provider,
		text: text ?? "",
	};
	const retryable = isRetryAllowed(error);
	const showBanner =
		error.terminal && error.kind !== "cancelled" && error.kind !== "billing";
	const attribution = appendSentence(
		attributionFor(error, t, provider, text),
		refundAttribution(error, t, provider),
	);

	return {
		kicker: t(`workspace.chat.aiError.kicker.${kickerGroup(error.kind)}`),
		body: t(bodyKey(error), params),
		attribution,
		retryable,
		showRetry: showBanner && retryable,
		showBanner,
	};
}

/**
 * Builds all user-visible chat/card failure copy from typed data. Transport
 * error messages are deliberately ignored: only two stable 409 codes are
 * inspected, and every other transport failure gets the localized fallback.
 */
export function chatErrorPresentation(
	error: unknown,
	aiError: AiErrorData | null | undefined,
	t: AiErrorTranslator,
): ChatErrorPresentation {
	if (aiError) return aiErrorPresentation(aiError, t);

	const replayed =
		isApiClientError(error) && error.code === "AI_CHAT_OPERATION_REPLAYED";
	const busy = isApiClientError(error) && error.code === "AI_CHAT_TURN_ACTIVE";
	const body = replayed
		? t("workspace.chat.errors.replayed")
		: busy
			? t("workspace.chat.errors.busy")
			: t("workspace.chat.errors.stream");

	return {
		kicker: t("workspace.chat.aiError.kicker.ours"),
		body,
		attribution: null,
		retryable: false,
		showRetry: false,
		showBanner: error != null,
	};
}

/** Convenience entry point for durable cards that always have typed data. */
export function durableAiErrorPresentation(
	error: AiErrorData,
	t: AiErrorTranslator,
): ChatErrorPresentation {
	return aiErrorPresentation(error, t);
}

/** Find the typed sibling written for one failed tool call. */
export function findToolAiError(
	parts: ReadonlyArray<unknown> | undefined,
	toolCallId: string,
): AiErrorData | null {
	if (!parts) return null;

	for (const part of parts) {
		if (
			typeof part === "object" &&
			part !== null &&
			"type" in part &&
			part.type === "data-ai-error" &&
			"data" in part &&
			typeof part.data === "object" &&
			part.data !== null &&
			"toolCallId" in part.data &&
			part.data.toolCallId === toolCallId
		) {
			const parsed = aiErrorDataSchema.safeParse(part.data);
			if (parsed.success) return parsed.data;
		}
	}

	return null;
}

/** Parse normalized error data from a tool output without trusting old rows. */
export function readAiErrorData(value: unknown): AiErrorData | null {
	const parsed = aiErrorDataSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Reads either the async-tool `error` field or MCP's `wanditError` field. */
export function toolOutputAiError(output: unknown): AiErrorData | null {
	if (typeof output !== "object" || output === null) return null;
	if ("error" in output) {
		const error = readAiErrorData(output.error);
		if (error) return error;
	}
	return "wanditError" in output ? readAiErrorData(output.wanditError) : null;
}

/** Reads the normalized `failure` column from a durable attempt DTO. */
export function durableAttemptAiError(attempt: unknown): AiErrorData | null {
	return typeof attempt === "object" && attempt !== null && "failure" in attempt
		? readAiErrorData(attempt.failure)
		: null;
}
