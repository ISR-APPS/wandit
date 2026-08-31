import type {
	AiErrorData,
	AiErrorKind,
	AiErrorSource,
} from "@wandit/contracts";

export type AiErrorSurface =
	| "chat"
	| "tool"
	| "image"
	| "video"
	| "marketing"
	| "page_build"
	| "connector"
	| "http"
	| "helper";

export interface AiErrorContext {
	surface: AiErrorSurface;
	route: "vercel" | "openrouter" | "mcp" | "none";
	model?: string;
	connectorSlug?: string;
	toolName?: string;
	abortSignal?: AbortSignal;
	finishReason?:
		| "stop"
		| "length"
		| "content-filter"
		| "tool-calls"
		| "error"
		| "other";
	rawFinishReason?: string;
	sawErrorPart?: boolean;
	providerMetadata?: unknown;
	outputText?: string;
	outputFiles?: Array<{ mediaType: string }>;
	refunded?: boolean | null;
}

export interface NormalizedAiError {
	kind: AiErrorKind;
	source: AiErrorSource;
	provider: string | null;
	providerLabel: string | null;
	model: string | null;
	retryable: boolean;
	terminal: boolean;
	refunded: boolean | null;
	moderationStage: "input" | "output" | null;
	userMessage: {
		key: `errors.ai.${string}`;
		params: { provider?: string; text?: string };
	};
	providerMessage: string | null;
	statusCode: number | null;
	requestId: string | null;
	gatewayGenerationId: string | null;
	openrouterGenerationId: string | null;
	sentryEventId: string | null;
	raw: {
		name: string | null;
		message: string;
		responseBody: string | null;
		providerAttempts: unknown | null;
		cause: unknown;
	};
}

export type { AiErrorData, AiErrorKind, AiErrorSource };
