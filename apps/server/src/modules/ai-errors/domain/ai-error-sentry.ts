import { Sentry } from "@wandit/observability/node";

import type {
	AiErrorContext,
	AiErrorSurface,
	NormalizedAiError,
} from "./normalized-ai-error";
import { redactProviderText } from "./sanitize-provider-text";

export const WANDIT_CAPTURED = Symbol.for("wandit.ai-error.captured");

const ISSUE_KINDS = new Set([
	"internal",
	"unknown",
	"auth_config",
	"model_not_found",
]);

export interface AiErrorSentryContext {
	surface: AiErrorSurface;
	route: AiErrorContext["route"];
	chatId?: string;
	projectId?: string;
	userId?: string;
	generationId?: string;
	toolName?: string;
	functionId?: string;
	refunded?: boolean | null;
}

export interface AiCallFailedAttributes {
	kind: string;
	source: string;
	errorKind?: string;
	errorSource?: string;
	provider?: string | null;
	model?: string | null;
	statusCode?: number | null;
	surface?: string;
	route?: string;
	chatId?: string;
	projectId?: string;
	userId?: string;
	generationId?: string;
	toolName?: string;
	gatewayGenerationId?: string | null;
	openrouterGenerationId?: string | null;
	requestId?: string | null;
	rawCause?: string | null;
	functionId?: string;
	refunded?: boolean | null;
}

export interface AiCallFinishedAttributes {
	provider?: string | null;
	model?: string | null;
	finishReason?: string | null;
	rawFinishReason?: string | null;
	tokens?: number | null;
	durationMs?: number | null;
	functionId?: string;
}

type SentryCapture = {
	tags: Record<string, string | number | boolean>;
	fingerprint: string[];
	contexts: {
		ai_error: Record<string, unknown>;
	};
	level: "error" | "warning";
};

export function toSentryCapture(
	normalized: NormalizedAiError,
	context: AiErrorSentryContext,
): SentryCapture {
	const raw = redactRaw(normalized.raw);

	return {
		contexts: {
			ai_error: {
				requestId: normalized.requestId,
				providerAttempts: redactProviderAttempts(
					normalized.raw.providerAttempts,
				),
				raw,
				responseBody: redactResponseBody(normalized.raw.responseBody),
			},
		},
		fingerprint: [
			"ai-error",
			normalized.kind,
			normalized.source,
			normalized.provider ?? "-",
		],
		level: ISSUE_KINDS.has(normalized.kind) ? "error" : "warning",
		tags: compactAttributes({
			chatId: context.chatId,
			errorKind: normalized.kind,
			errorSource: normalized.source,
			functionId: context.functionId,
			gatewayGenerationId: normalized.gatewayGenerationId,
			generationId: context.generationId,
			model: normalized.model,
			openrouterGenerationId: normalized.openrouterGenerationId,
			projectId: context.projectId,
			provider: normalized.provider,
			route: context.route,
			statusCode: normalized.statusCode,
			surface: context.surface,
			toolName: context.toolName,
			userId: context.userId,
		}),
	};
}

export function captureAiError(
	error: unknown,
	normalized: NormalizedAiError,
	context: AiErrorSentryContext,
): string | null {
	markCaptured(error);

	if (ISSUE_KINDS.has(normalized.kind)) {
		return Sentry.captureException(error, toSentryCapture(normalized, context));
	}
	const raw = redactRaw(normalized.raw);

	aiCallFailed({
		chatId: context.chatId,
		errorKind: normalized.kind,
		errorSource: normalized.source,
		functionId: context.functionId,
		gatewayGenerationId: normalized.gatewayGenerationId,
		generationId: context.generationId,
		kind: normalized.kind,
		model: normalized.model,
		openrouterGenerationId: normalized.openrouterGenerationId,
		projectId: context.projectId,
		provider: normalized.provider,
		rawCause: raw.cause,
		refunded: context.refunded ?? normalized.refunded,
		requestId: normalized.requestId,
		route: context.route,
		source: normalized.source,
		statusCode: normalized.statusCode,
		surface: context.surface,
		toolName: context.toolName,
		userId: context.userId,
	});
	return null;
}

export function aiCallFailed(attributes: AiCallFailedAttributes): void {
	Sentry.logger.warn("ai.call.failed", compactAttributes(attributes));
}

export function aiCallFinished(attributes: AiCallFinishedAttributes): void {
	Sentry.logger.info("ai.call.finished", compactAttributes(attributes));
}

function markCaptured(error: unknown): void {
	if (
		(typeof error !== "object" || error === null) &&
		typeof error !== "function"
	) {
		return;
	}

	try {
		Reflect.set(error, WANDIT_CAPTURED, true);
	} catch {
		return;
	}
}

function redactResponseBody(responseBody: string | null): string | null {
	if (responseBody === null) return null;
	return redactAndCap(responseBody);
}

function redactRaw(raw: NormalizedAiError["raw"]): {
	name: string | null;
	message: string | null;
	cause: string | null;
} {
	return {
		cause: serializeAndRedact(raw.cause),
		message: redactAndCap(raw.message),
		name: raw.name === null ? null : redactAndCap(raw.name),
	};
}

function serializeAndRedact(value: unknown): string | null {
	if (value === null || value === undefined) return null;

	const seen = new WeakSet<object>();
	let serialized: string;
	try {
		serialized =
			JSON.stringify(
				value,
				(_key, item: unknown) => {
					if (typeof item === "bigint") return item.toString();
					if (item instanceof Error) {
						return {
							message: item.message,
							name: item.name,
							stack: item.stack,
						};
					}
					if (typeof item !== "object" || item === null) return item;
					if (seen.has(item)) return "[Circular]";
					seen.add(item);
					return item;
				},
				2,
			) ?? String(value);
	} catch {
		serialized = String(value);
	}

	return redactAndCap(serialized);
}

function redactAndCap(value: string): string | null {
	const redacted = redactProviderText(value).trim().slice(0, 4096);
	return redacted || null;
}

function redactProviderAttempts(value: unknown): unknown {
	return redactAttemptValue(value, new WeakSet<object>());
}

function redactAttemptValue(value: unknown, seen: WeakSet<object>): unknown {
	if (Array.isArray(value)) {
		if (seen.has(value)) return "[Circular]";
		seen.add(value);
		return value.map((item) => redactAttemptValue(item, seen));
	}

	if (typeof value !== "object" || value === null) return value;
	if (seen.has(value)) return "[Circular]";
	seen.add(value);

	const output: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		output[key] =
			key === "error" && typeof item === "string"
				? redactProviderText(item)
				: redactAttemptValue(item, seen);
	}
	return output;
}

function compactAttributes<T extends object>(
	attributes: T,
): Record<string, Exclude<T[keyof T], null | undefined>> {
	return Object.fromEntries(
		Object.entries(attributes).filter(
			([, value]) => value !== undefined && value !== null,
		),
	) as Record<string, Exclude<T[keyof T], null | undefined>>;
}
