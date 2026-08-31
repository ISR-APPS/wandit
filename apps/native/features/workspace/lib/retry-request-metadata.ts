import type {
	AiChatMessageMetadata,
	ComposerMetadata,
} from "@wandit/contracts";

export type RetryRequestMetadata = {
	composer?: ComposerMetadata;
	selectedWids?: string[];
};

type RetryableMessage = {
	id: string;
	role: string;
	metadata?: AiChatMessageMetadata;
};

/** Restore request-only context before regenerate posts a persisted turn. */
export function findRetryRequestMetadata(
	messages: readonly RetryableMessage[],
	failedMessageId: string,
	fallback: RetryRequestMetadata = {},
): RetryRequestMetadata {
	const failedIndex = messages.findIndex(
		(message) => message.id === failedMessageId && message.role === "assistant",
	);
	if (failedIndex < 0) return fallback;

	for (let index = failedIndex - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "user") continue;

		const composer = message.metadata?.composer ?? fallback.composer;
		const selectedWids =
			message.metadata?.selectedWids ??
			message.metadata?.selectedTargets?.map((target) => target.wid) ??
			fallback.selectedWids;

		return {
			...(composer ? { composer } : {}),
			...(selectedWids ? { selectedWids } : {}),
		};
	}

	return fallback;
}
