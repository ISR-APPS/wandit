import type { AiErrorKind } from "@wandit/contracts";

import {
	HIGGSFIELD_CREDITS_MESSAGE,
	HIGGSFIELD_NSFW_MESSAGE,
	HIGGSFIELD_PLAN_MESSAGE,
	stripRequestIds,
} from "./sanitize-provider-text";

export type ProviderSignatureKind = Extract<
	AiErrorKind,
	| "auth_config"
	| "invalid_request"
	| "model_not_found"
	| "rate_limited"
	| "capacity"
	| "provider_error"
	| "content_moderated"
	| "timeout"
>;

export const OPENAI_IMAGE_MODERATION_CODES = new Set([
	"moderation_blocked",
	"content_policy_violation",
	"invalid_prompt",
]);

export const RAW_MODERATION_FINISH_REASONS = new Set([
	"refusal",
	"content_filter",
	"SAFETY",
	"PROHIBITED_CONTENT",
	"BLOCKLIST",
	"SPII",
	"RECITATION",
	"IMAGE_SAFETY",
	"IMAGE_PROHIBITED_CONTENT",
]);

export const IMAGE_MODERATION_FINISH_REASONS = new Set([
	"IMAGE_SAFETY",
	"IMAGE_PROHIBITED_CONTENT",
	"SAFETY",
	"PROHIBITED_CONTENT",
]);

export const OPENROUTER_STATUS_KINDS = {
	400: "invalid_request",
	401: "auth_config",
	402: "auth_config",
	403: "auth_config",
	408: "timeout",
	413: "invalid_request",
	422: "invalid_request",
	429: "rate_limited",
	500: "provider_error",
	502: "provider_error",
	503: "capacity",
} as const satisfies Readonly<Record<number, ProviderSignatureKind>>;

export const HIGGSFIELD_VALIDATION_MESSAGES = {
	clipify_duration_unavailable:
		"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
} as const;

export {
	HIGGSFIELD_CREDITS_MESSAGE,
	HIGGSFIELD_NSFW_MESSAGE,
	HIGGSFIELD_PLAN_MESSAGE,
};

export type ProviderRejection = {
	kind: "validation" | "credits" | "plan" | "unknown";
	userMessage: string;
};

export type OpenRouterModerationMetadata = {
	providerName: string | null;
	reasons: unknown[];
};

export type HiggsfieldStateKind =
	| "content_moderated"
	| "cancelled"
	| "connector_rejected";

const ERROR_TYPE_PATTERN = /"error_type"\s*:\s*"((?:\\.|[^"\\])*)"/iu;
const VALIDATION_ERROR_PATTERN = /\bvalidation error \(4\d{2}\)/iu;
const MODERATION_TEXT_PATTERN = /\b(?:nsfw|moderat|risk|sensitive)\w*/iu;
const CAPACITY_TEXT_PATTERN = /\b(?:overloaded|capacity|server[_ ]busy)\b/iu;
const ANTHROPIC_ACCOUNT_PATTERN =
	/\b(?:(?:organization|workspace).{0,80}(?:spend|usage|credit).{0,40}(?:limit|cap)|(?:spend|usage).{0,30}(?:limit|cap)|credit balance.{0,30}(?:low|exhausted))\b/iu;
const GOOGLE_QUOTA_PATTERN = /\b(?:quota|billing|credit|spend|limit)\b/iu;

export function classifyProviderRejection(text: string): ProviderRejection {
	const trimmed = text.trim();
	const errorType = VALIDATION_ERROR_PATTERN.test(trimmed)
		? extractErrorType(trimmed)
		: null;

	if (errorType) {
		return {
			kind: "validation",
			userMessage: validationMessage(errorType),
		};
	}

	if (/\bout of credits\b/iu.test(trimmed)) {
		return { kind: "credits", userMessage: HIGGSFIELD_CREDITS_MESSAGE };
	}

	if (/\brequires plus plan\b/iu.test(trimmed)) {
		return { kind: "plan", userMessage: HIGGSFIELD_PLAN_MESSAGE };
	}

	return {
		kind: "unknown",
		userMessage: stripRequestIds(trimmed),
	};
}

export function validationMessage(errorType: string): string {
	const normalized = errorType.trim().toLowerCase();
	const known =
		HIGGSFIELD_VALIDATION_MESSAGES[
			normalized as keyof typeof HIGGSFIELD_VALIDATION_MESSAGES
		];
	if (known) return known;

	const humanized = normalized
		.replace(/_+/gu, " ")
		.replace(/[^a-z0-9 -]+/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
		.slice(0, 100)
		.trim();

	return humanized.length > 0
		? `Higgsfield rejected the request (${humanized}).`
		: "Higgsfield rejected the request.";
}

export function isOpenAiImageModerationCode(value: unknown): boolean {
	return (
		typeof value === "string" &&
		OPENAI_IMAGE_MODERATION_CODES.has(value.trim().toLowerCase())
	);
}

export function classifyOpenRouterStatus(
	statusCode: unknown,
	options: { hasModerationReasons?: boolean } = {},
): ProviderSignatureKind | null {
	const code = numericCode(statusCode);
	if (code === null) return null;
	if (code === 403 && options.hasModerationReasons === true) {
		return "content_moderated";
	}

	return (
		OPENROUTER_STATUS_KINDS[code as keyof typeof OPENROUTER_STATUS_KINDS] ??
		(code >= 500 ? "provider_error" : null)
	);
}

export function readOpenRouterModerationMetadata(
	value: unknown,
): OpenRouterModerationMetadata | null {
	if (!isRecord(value) || !Array.isArray(value.reasons)) return null;

	return {
		providerName:
			typeof value.provider_name === "string"
				? value.provider_name.trim() || null
				: null,
		reasons: value.reasons,
	};
}

export function isRawModerationFinishReason(value: unknown): boolean {
	return typeof value === "string" && RAW_MODERATION_FINISH_REASONS.has(value);
}

export function isImageModerationFinishReason(value: unknown): boolean {
	return (
		typeof value === "string" && IMAGE_MODERATION_FINISH_REASONS.has(value)
	);
}

export function hasProviderModerationSignal(
	provider: string | null,
	values: unknown[],
): boolean {
	const slug = normalizeProvider(provider);
	if (slug === "openai" && values.some(isOpenAiImageModerationCode)) {
		return true;
	}

	if (slug === "higgsfield") {
		return values.some(
			(value) =>
				typeof value === "string" && MODERATION_TEXT_PATTERN.test(value),
		);
	}

	if (slug === "google") {
		return values.some(
			(value) =>
				typeof value === "string" &&
				(MODERATION_TEXT_PATTERN.test(value) ||
					isRawModerationFinishReason(value)),
		);
	}

	return false;
}

export function hasProviderAccountSignal(
	provider: string | null,
	values: unknown[],
	options: { hasRetryAfter?: boolean } = {},
): boolean {
	if (options.hasRetryAfter === true) return false;

	const slug = normalizeProvider(provider);
	const text = values
		.filter((value): value is string => typeof value === "string")
		.join(" ");

	if (slug === "anthropic") return ANTHROPIC_ACCOUNT_PATTERN.test(text);
	if (slug === "google") {
		return (
			values.some(
				(value) =>
					typeof value === "string" &&
					/\bRESOURCE_EXHAUSTED\b/u.test(value.toUpperCase()),
			) && GOOGLE_QUOTA_PATTERN.test(text)
		);
	}

	return false;
}

export function hasCapacitySignal(values: unknown[]): boolean {
	return values.some(
		(value) => typeof value === "string" && CAPACITY_TEXT_PATTERN.test(value),
	);
}

export function classifyHiggsfieldState(
	state: unknown,
): HiggsfieldStateKind | null {
	if (typeof state !== "string") return null;

	const normalized = state.trim().toLowerCase();
	if (normalized === "nsfw" || normalized.includes("moderat")) {
		return "content_moderated";
	}
	if (normalized === "canceled" || normalized === "cancelled") {
		return "cancelled";
	}
	if (normalized === "failed" || normalized === "error") {
		return "connector_rejected";
	}

	return null;
}

function extractErrorType(text: string): string | null {
	const encoded = ERROR_TYPE_PATTERN.exec(text)?.[1];
	if (!encoded) return null;

	try {
		const parsed: unknown = JSON.parse(`"${encoded}"`);
		return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
	} catch {
		return encoded;
	}
}

function numericCode(value: unknown): number | null {
	if (typeof value === "number" && Number.isInteger(value)) return value;
	if (typeof value !== "string" || !/^\d{3,4}$/u.test(value.trim())) {
		return null;
	}

	return Number(value);
}

function normalizeProvider(provider: string | null): string | null {
	if (provider === null) return null;

	return provider
		.trim()
		.toLowerCase()
		.replace(/^provider:/u, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
