import {
	type AiErrorData,
	type AiErrorKind,
	aiErrorDataSchema,
} from "@wandit/contracts";
import type { I18nContextValue } from "@wandit/internationalization/react";

import { isApiClientError } from "@/shared/lib/base-service";

type Translate = I18nContextValue["t"];

export type ChatErrorPresentation = {
	kicker: string;
	body: string;
	attribution: string | null;
	retryable: boolean;
};

type MessageWithParts = {
	id: string;
	role: string;
	parts: readonly unknown[];
};

const PROVIDER_KINDS = new Set<AiErrorKind>([
	"invalid_request",
	"rate_limited",
	"capacity",
	"provider_error",
	"timeout",
	"network",
]);

const CONNECTOR_KINDS = new Set<AiErrorKind>([
	"connector_unreachable",
	"connector_account",
	"connector_rejected",
]);

/**
 * The only place native turns normalized AI failures into user-facing copy.
 * Transport Error.message and connector result text deliberately never enter
 * this function; providerMessage is already sanitized and allowlisted by the
 * server contract.
 */
export function chatErrorPresentation(
	error: unknown,
	aiError: AiErrorData | null | undefined,
	t: Translate,
): ChatErrorPresentation {
	if (!aiError) {
		if (
			isApiClientError(error) &&
			error.code === "AI_CHAT_OPERATION_REPLAYED"
		) {
			return {
				kicker: t("native.workspace.chat.aiError.kicker.ours"),
				body: t("native.workspace.chat.errors.replayed"),
				attribution: null,
				retryable: false,
			};
		}

		if (isApiClientError(error) && error.code === "AI_CHAT_TURN_ACTIVE") {
			return {
				kicker: t("native.workspace.chat.aiError.kicker.ours"),
				body: t("native.workspace.chat.errors.busy"),
				attribution: null,
				retryable: false,
			};
		}

		return {
			kicker: t("native.workspace.chat.aiError.kicker.ours"),
			body: t("native.workspace.chat.errors.stream"),
			attribution: null,
			retryable: false,
		};
	}

	const provider =
		aiError.providerLabel?.trim() ||
		t("native.workspace.chat.aiError.providerFallback");
	const text = aiError.providerMessage?.trim() || "";
	const params = {
		provider,
		connector: provider,
		text,
	};

	return {
		kicker: kickerFor(aiError.kind, t),
		body: bodyFor(aiError, params, t),
		attribution: attributionFor(aiError, provider, t),
		retryable: isRetryAllowed(aiError),
	};
}

function isRetryAllowed(error: AiErrorData): boolean {
	if (!error.terminal || !error.retryable) return false;
	return !(
		error.kind === "billing" ||
		error.kind === "cancelled" ||
		error.kind === "content_moderated" ||
		error.kind === "connector_account" ||
		(error.kind === "timeout" && error.source === "higgsfield")
	);
}

function kickerFor(kind: AiErrorKind, t: Translate): string {
	if (kind === "content_moderated") {
		return t("native.workspace.chat.aiError.kicker.moderated");
	}
	if (CONNECTOR_KINDS.has(kind)) {
		return t("native.workspace.chat.aiError.kicker.connector");
	}
	if (PROVIDER_KINDS.has(kind)) {
		return t("native.workspace.chat.aiError.kicker.provider");
	}
	return t("native.workspace.chat.aiError.kicker.ours");
}

function bodyFor(
	error: AiErrorData,
	params: { provider: string; connector: string; text: string },
	t: Translate,
): string {
	if (error.kind === "billing") {
		return t("native.workspace.chat.errors.credits");
	}
	if (error.kind === "content_moderated") {
		return t(
			error.moderationStage === "output"
				? "errors.ai.content_moderated_output"
				: "errors.ai.content_moderated",
			params,
		);
	}
	if (error.kind === "timeout") {
		if (error.source === "ours") {
			return t("errors.ai.timeout_budget", params);
		}
		if (error.source === "higgsfield") {
			return t("errors.ai.timeout_connector", params);
		}
		return t("errors.ai.timeout", params);
	}
	if (error.kind === "connector_rejected" && !error.providerMessage?.trim()) {
		return t("errors.ai.connector_rejected_no_text", params);
	}

	switch (error.kind) {
		case "internal":
			return t("errors.ai.internal", params);
		case "auth_config":
			return t("errors.ai.auth_config", params);
		case "invalid_request":
			return t("errors.ai.invalid_request", params);
		case "model_not_found":
			return t("errors.ai.model_not_found", params);
		case "rate_limited":
			return t("errors.ai.rate_limited", params);
		case "capacity":
			return t("errors.ai.capacity", params);
		case "provider_error":
			return t("errors.ai.provider_error", params);
		case "network":
			return t("errors.ai.network", params);
		case "cancelled":
			return t("errors.ai.cancelled", params);
		case "connector_unreachable":
			return t("errors.ai.connector_unreachable", params);
		case "connector_account":
			return t("errors.ai.connector_account", params).trim();
		case "connector_rejected":
			return t("errors.ai.connector_rejected", params);
		case "unknown":
			return t("errors.ai.unknown", params);
	}
}

function attributionFor(
	error: AiErrorData,
	provider: string,
	t: Translate,
): string | null {
	const lines: string[] = [];
	const text = error.providerMessage?.trim() || null;

	if (error.kind === "content_moderated") {
		if (error.moderationStage === "output") {
			lines.push(
				t("native.workspace.chat.aiError.attribution.outputFilter", {
					provider,
				}),
			);
			if (text) {
				lines.push(
					t("native.workspace.chat.aiError.attribution.reasonGiven", {
						text,
					}),
				);
			}
		} else if (error.source === "openrouter" && text) {
			lines.push(
				t("native.workspace.chat.aiError.attribution.reasonGiven", { text }),
			);
		} else if (error.source === "higgsfield") {
			if (text) {
				lines.push(
					t("native.workspace.chat.aiError.attribution.connectorReturned", {
						connector: provider,
						text,
					}),
				);
			} else {
				lines.push(
					t("native.workspace.chat.aiError.attribution.refusedPromptNoText", {
						provider,
					}),
				);
			}
		} else {
			lines.push(
				text
					? t("native.workspace.chat.aiError.attribution.refusedPrompt", {
							provider,
							text,
						})
					: t("native.workspace.chat.aiError.attribution.refusedPromptNoText", {
							provider,
						}),
			);
		}
	} else if (error.kind === "connector_rejected") {
		lines.push(
			text
				? t("native.workspace.chat.aiError.attribution.connectorReturned", {
						connector: provider,
						text,
					})
				: t("native.workspace.chat.aiError.attribution.connectorNoReason", {
						connector: provider,
					}),
		);
	} else if (
		PROVIDER_KINDS.has(error.kind) &&
		error.providerLabel?.trim() &&
		error.source === "openrouter"
	) {
		lines.push(
			t("native.workspace.chat.aiError.attribution.viaOpenrouter", {
				provider,
			}),
		);
	} else if (
		PROVIDER_KINDS.has(error.kind) &&
		error.providerLabel?.trim() &&
		(error.source === "gateway" || error.source.startsWith("provider:"))
	) {
		lines.push(
			t("native.workspace.chat.aiError.attribution.viaGateway", { provider }),
		);
	}

	if (error.refunded === true) {
		lines.push(
			error.source === "higgsfield"
				? t("native.workspace.chat.aiError.connectorRefunded", {
						connector: provider,
					})
				: t("native.workspace.chat.aiError.notCharged"),
		);
	}

	return lines.length > 0 ? lines.join(" ") : null;
}

/** Accept a direct AiErrorData or the normalized fields used on outputs/rows. */
export function readAiErrorData(value: unknown): AiErrorData | null {
	const direct = aiErrorDataSchema.safeParse(value);
	if (direct.success) return direct.data;
	if (!isRecord(value)) return null;

	for (const key of ["failure", "wanditError", "error"] as const) {
		const parsed = aiErrorDataSchema.safeParse(value[key]);
		if (parsed.success) return parsed.data;
	}
	return null;
}

export function findToolAiError(
	parts: readonly unknown[],
	toolCallId: string | undefined,
): AiErrorData | null {
	if (!toolCallId) return null;
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const part = parts[index];
		if (!isRecord(part) || part.type !== "data-ai-error") continue;
		const error = readAiErrorData(part.data);
		if (error?.toolCallId === toolCallId) return error;
	}
	return null;
}

export function findLastTerminalAiErrorMessage<T extends MessageWithParts>(
	messages: readonly T[],
): T | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "assistant") continue;
		const hasTerminalError = message.parts.some((value) => {
			if (!isRecord(value) || value.type !== "data-ai-error") return false;
			const error = readAiErrorData(value.data);
			return Boolean(error?.terminal && !error.toolCallId);
		});
		if (hasTerminalError) return message;
	}
	return null;
}

export function messageHasQueuedToolOutput(message: MessageWithParts): boolean {
	return message.parts.some((value) => {
		if (!isRecord(value) || !isRecord(value.output)) return false;
		return value.output.status === "queued";
	});
}

export function aiErrorNoticeKey(error: AiErrorData): string {
	return [
		error.requestId ?? "notice",
		error.kind,
		error.source,
		error.providerLabel ?? "",
		error.toolCallId ?? "",
	].join(":");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
