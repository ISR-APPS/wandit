import type {
	AiChatMessageMetadata,
	AiChatMessageUsage,
} from "@wandit/contracts";

/** Approximate shared context window; make this per-model when models diverge. */
export const CONTEXT_WINDOW_TOKENS = 1_000_000;

type MessageWithTokenUsage = {
	role: "system" | "user" | "assistant";
	metadata?: AiChatMessageMetadata;
};

export type ConversationTokenUsage = {
	contextTokens: number;
	contextPercent: number;
	totalTokens: number;
};

export function formatTokenCount(tokens: number): string {
	const value = Math.max(0, Math.round(tokens));

	if (value < 1_000) {
		return String(value);
	}

	// Promote values that would round to "1000k" into the M unit.
	if (value < 999_950) {
		return `${formatSingleDecimal(value / 1_000)}k`;
	}

	return `${formatSingleDecimal(value / 1_000_000)}M`;
}

export function summarizeConversationTokenUsage(
	messages: readonly MessageWithTokenUsage[],
): ConversationTokenUsage | null {
	let latestContextTokens: number | undefined;
	let totalTokens = 0;

	for (const message of messages) {
		if (message.role !== "assistant") continue;

		const usage = message.metadata?.usage;
		if (!usage) continue;

		const contextTokens = sumKnownInputAndOutput(usage);
		if (contextTokens !== undefined) {
			latestContextTokens = contextTokens;
		}

		const messageTotal = usage.totalTokens ?? contextTokens;
		if (messageTotal !== undefined) {
			totalTokens += messageTotal;
		}
	}

	if (latestContextTokens === undefined) {
		return null;
	}

	return {
		contextTokens: latestContextTokens,
		contextPercent: Math.min(
			100,
			Math.max(0, (latestContextTokens / CONTEXT_WINDOW_TOKENS) * 100),
		),
		totalTokens,
	};
}

export function resolveMessageTotalTokens(
	usage: AiChatMessageUsage,
): number | undefined {
	return usage.totalTokens ?? sumKnownInputAndOutput(usage);
}

function sumKnownInputAndOutput(usage: AiChatMessageUsage): number | undefined {
	if (usage.inputTokens === undefined && usage.outputTokens === undefined) {
		return undefined;
	}

	return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function formatSingleDecimal(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
