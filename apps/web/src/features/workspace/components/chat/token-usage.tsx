import type { AiChatMessageUsage, ChatUsageResponse } from "@wandit/contracts";
import { Progress } from "@wandit/ui/components/progress";

import { formatNumber, type Locale, useTranslation } from "@/lib/i18n";
import {
	CONTEXT_WINDOW_TOKENS,
	formatTokenCount,
	resolveMessageTotalTokens,
	summarizeConversationTokenUsage,
} from "../../lib/token-usage";
import type { WanditUIMessage } from "../../lib/use-ai-chat";

export function MessageTokenUsage({
	usage,
	stepCount,
}: {
	usage: AiChatMessageUsage;
	stepCount?: number;
}) {
	const { t, locale } = useTranslation();
	const totalTokens = resolveMessageTotalTokens(usage);
	const hasBreakdown = hasTokenBreakdown(usage);

	if (
		usage.inputTokens === undefined &&
		usage.outputTokens === undefined &&
		totalTokens === undefined &&
		!hasBreakdown
	) {
		return null;
	}

	const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens;
	const reasoningTokens = usage.outputTokenDetails?.reasoningTokens;
	const input = formatOptionalTokenCount(usage.inputTokens);
	const output = formatOptionalTokenCount(usage.outputTokens);
	const formattedInput =
		cacheReadTokens === undefined
			? input
			: `${input} ${t("workspace.chat.usage.cached", {
					tokens: formatTokenCount(cacheReadTokens),
				})}`;
	const formattedOutput =
		reasoningTokens === undefined
			? output
			: `${output} ${t("workspace.chat.usage.reasoning", {
					tokens: formatTokenCount(reasoningTokens),
				})}`;
	const breakdown = hasBreakdown
		? t("workspace.chat.usage.messageBreakdown", {
				noCache: formatOptionalFullTokenCount(
					usage.inputTokenDetails?.noCacheTokens,
					locale,
				),
				cacheRead: formatOptionalFullTokenCount(cacheReadTokens, locale),
				cacheWrite: formatOptionalFullTokenCount(
					usage.inputTokenDetails?.cacheWriteTokens,
					locale,
				),
				text: formatOptionalFullTokenCount(
					usage.outputTokenDetails?.textTokens,
					locale,
				),
				reasoning: formatOptionalFullTokenCount(reasoningTokens, locale),
			})
		: undefined;

	const message = t("workspace.chat.usage.message", {
		input: formattedInput,
		output: formattedOutput,
		total: formatOptionalTokenCount(totalTokens),
	});
	const messageWithSteps =
		stepCount !== undefined && stepCount > 1
			? t("workspace.chat.usage.messageWithSteps", {
					count: formatNumber(stepCount, locale),
					message,
				})
			: message;

	return (
		<p
			dir="ltr"
			title={breakdown}
			className="mt-2 font-mono text-[10px] text-muted-foreground/70 tabular-nums"
		>
			{messageWithSteps}
		</p>
	);
}

export function ConversationContextMeter({
	messages,
}: {
	messages: readonly WanditUIMessage[];
}) {
	const { t, locale } = useTranslation();
	const summary = summarizeConversationTokenUsage(messages);

	if (!summary) return null;

	const percent = Math.round(summary.contextPercent);
	const meterValue = `${formatTokenCount(summary.contextTokens)} / ${formatTokenCount(
		CONTEXT_WINDOW_TOKENS,
	)} (${percent}%)`;
	const tooltipParts = [
		t("workspace.chat.usage.conversationTotal", {
			total: formatNumber(summary.totalTokens, locale),
		}),
		t("workspace.chat.usage.conversationCumulative", {
			input: formatNumber(summary.cumulativeInputTokens, locale),
			output: formatNumber(summary.cumulativeOutputTokens, locale),
		}),
		t("workspace.chat.usage.latestCacheReadShare", {
			share:
				summary.latestCacheReadShare === undefined
					? "—"
					: new Intl.NumberFormat(locale, {
							style: "percent",
							maximumFractionDigits: 1,
						}).format(summary.latestCacheReadShare),
		}),
	];

	const tooltip = tooltipParts.join(" · ");

	return (
		<div className="mb-2.5 px-0.5" title={tooltip}>
			<div className="mb-1 flex items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground tabular-nums">
				<span>{t("workspace.chat.usage.context")}</span>
				<span dir="ltr" className="shrink-0">
					{meterValue}
				</span>
			</div>
			<Progress
				value={summary.contextPercent}
				aria-label={meterValue}
				className="h-1 bg-border"
				indicatorColor="bg-gradient-ember"
			/>
		</div>
	);
}

export function ConversationCost({
	usage,
}: {
	usage: ChatUsageResponse | undefined;
}) {
	const { t, locale } = useTranslation();
	const parts: string[] = [];

	if (usage?.costUsdMicros !== null && usage?.costUsdMicros !== undefined) {
		parts.push(
			t("workspace.chat.usage.conversationCost", {
				cost: formatUsdMicros(usage.costUsdMicros, locale),
			}),
		);
	}

	if (usage?.creditsCenti !== null && usage?.creditsCenti !== undefined) {
		parts.push(
			t("workspace.chat.usage.conversationCredits", {
				credits: formatCreditsCenti(usage.creditsCenti, locale),
			}),
		);
	}

	if (parts.length === 0) return null;

	return (
		<p className="-mt-1 mb-2.5 px-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
			{parts.join(" · ")}
		</p>
	);
}

function formatOptionalTokenCount(tokens: number | undefined): string {
	return tokens === undefined ? "—" : formatTokenCount(tokens);
}

function formatOptionalFullTokenCount(
	tokens: number | undefined,
	locale: Locale,
): string {
	return tokens === undefined ? "—" : formatNumber(tokens, locale);
}

function hasTokenBreakdown(usage: AiChatMessageUsage): boolean {
	return (
		usage.inputTokenDetails?.noCacheTokens !== undefined ||
		usage.inputTokenDetails?.cacheReadTokens !== undefined ||
		usage.inputTokenDetails?.cacheWriteTokens !== undefined ||
		usage.outputTokenDetails?.textTokens !== undefined ||
		usage.outputTokenDetails?.reasoningTokens !== undefined
	);
}

function formatUsdMicros(micros: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(micros / 1_000_000);
}

function formatCreditsCenti(centi: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(centi / 100);
}
