import { bundledReservationPendingAttemptRef } from "../../metering/domain/metering";
import type { MeteredTokenUsage } from "../../metering/domain/model-pricing";
import { WANDIT_SYSTEM_PROMPT } from "./system-prompt";

export const AI_CHAT_MAX_OUTPUT_TOKENS = 4_096;
export const AI_CHAT_MAX_STEPS = 12;
export const AI_CHAT_ESTIMATED_OUTPUT_TOKENS = 2_048;

// Tool definitions are sent with every model request. Their exact serialized
// shape is SDK/provider-specific, so budget a stable product-owned allowance
// rather than pretending that only visible chat text consumes input tokens.
export const AI_CHAT_TOOL_SCHEMA_ALLOWANCE_CHARS = 8_000;

export function projectCreationMeteringKey(projectId: string): string {
	return `project-create:${projectId}`;
}

export function projectCreationReservationAttemptRef(
	projectId: string,
): string {
	return bundledReservationPendingAttemptRef(`project:${projectId}`);
}

export function projectCreationStreamClaimAttemptRef(
	projectId: string,
	requestId: string,
): string {
	return bundledReservationPendingAttemptRef(
		`project-stream:${projectId}:${requestId}`,
	);
}

/**
 * Admission estimate only. Settlement uses authoritative SDK usage and the
 * gateway reconciliation pass corrects material drift later.
 */
export function estimateAiChatTokenUsage(
	modelBoundMessages: unknown,
	contextBlock?: string | null,
): MeteredTokenUsage {
	const messageCharacters = JSON.stringify(modelBoundMessages).length;
	const staticCharacters =
		WANDIT_SYSTEM_PROMPT.length +
		(contextBlock?.length ?? 0) +
		AI_CHAT_TOOL_SCHEMA_ALLOWANCE_CHARS;

	return {
		inputTokens: Math.ceil((messageCharacters + staticCharacters) / 4),
		outputTokens: AI_CHAT_ESTIMATED_OUTPUT_TOKENS,
	};
}
