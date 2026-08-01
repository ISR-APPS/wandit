import type { AiChatMessageUsage } from "@wandit/contracts";
import { Progress } from "@wandit/ui/components/progress";

import { useTranslation } from "@/lib/i18n";
import {
	CONTEXT_WINDOW_TOKENS,
	formatTokenCount,
	resolveMessageTotalTokens,
	summarizeConversationTokenUsage,
} from "../../lib/token-usage";
import type { WanditUIMessage } from "../../lib/use-ai-chat";

export function MessageTokenUsage({ usage }: { usage: AiChatMessageUsage }) {
	const { t } = useTranslation();
	const totalTokens = resolveMessageTotalTokens(usage);

	if (
		usage.inputTokens === undefined &&
		usage.outputTokens === undefined &&
		totalTokens === undefined
	) {
		return null;
	}

	return (
		<p
			dir="ltr"
			className="mt-2 font-mono text-[10px] text-muted-foreground/70 tabular-nums"
		>
			{t("workspace.chat.usage.message", {
				input: formatOptionalTokenCount(usage.inputTokens),
				output: formatOptionalTokenCount(usage.outputTokens),
				total: formatOptionalTokenCount(totalTokens),
			})}
		</p>
	);
}

export function ConversationContextMeter({
	messages,
}: {
	messages: readonly WanditUIMessage[];
}) {
	const { t } = useTranslation();
	const summary = summarizeConversationTokenUsage(messages);

	if (!summary) return null;

	const percent = Math.round(summary.contextPercent);
	const meterValue = `${formatTokenCount(summary.contextTokens)} / ${formatTokenCount(
		CONTEXT_WINDOW_TOKENS,
	)} (${percent}%)`;
	const tooltip = t("workspace.chat.usage.conversationTotal", {
		total: formatTokenCount(summary.totalTokens),
	});

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

function formatOptionalTokenCount(tokens: number | undefined): string {
	return tokens === undefined ? "—" : formatTokenCount(tokens);
}
