import type { AiChatMessageUsage } from "@wandit/contracts";
import { Text } from "react-native";

export function ChatMessageTokenUsage({
	usage,
}: {
	usage: AiChatMessageUsage;
}) {
	if (!__DEV__) return null;

	const totalTokens = resolveMessageTotalTokens(usage);
	if (
		usage.inputTokens === undefined &&
		usage.outputTokens === undefined &&
		totalTokens === undefined
	) {
		return null;
	}

	return (
		<Text
			className="font-mono text-[10px] text-muted/70"
			style={{ writingDirection: "ltr", fontVariant: ["tabular-nums"] }}
		>
			Input {formatOptionalTokenCount(usage.inputTokens)} · Output{" "}
			{formatOptionalTokenCount(usage.outputTokens)} · Total{" "}
			{formatOptionalTokenCount(totalTokens)} tokens
		</Text>
	);
}

function resolveMessageTotalTokens(
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

function formatOptionalTokenCount(tokens: number | undefined): string {
	return tokens === undefined ? "—" : formatTokenCount(tokens);
}

function formatTokenCount(tokens: number): string {
	const value = Math.max(0, Math.round(tokens));

	if (value < 1_000) return String(value);
	if (value < 999_950) return `${formatSingleDecimal(value / 1_000)}k`;
	return `${formatSingleDecimal(value / 1_000_000)}M`;
}

function formatSingleDecimal(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
