import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	formatConversationCost,
	formatConversationCount,
} from "@/features/conversations/lib/conversation-formatters";
import type { MessageUsageSummary } from "@/features/conversations/lib/conversation-usage";

export function MessageUsage({ usage }: { usage: MessageUsageSummary }) {
	const generationId = usage.gatewayGenerationIds[0];
	const hasInputOrOutputTokens =
		usage.inputTokens !== null || usage.outputTokens !== null;
	const model =
		usage.modelLabels.length > 1
			? `${usage.modelLabels[0]} +${usage.modelLabels.length - 1}`
			: (usage.modelLabels[0] ?? "Model unknown");

	return (
		<div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-dashed pt-2 text-muted-foreground text-xs">
			<span
				className="max-w-64 truncate font-mono"
				title={usage.modelLabels.join(", ")}
			>
				{model}
			</span>
			{hasInputOrOutputTokens ? (
				<>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">
						{formatConversationCount(usage.inputTokens)} in /{" "}
						{formatConversationCount(usage.outputTokens)} out tokens
					</span>
				</>
			) : usage.totalTokens !== null ? (
				<>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">
						{formatConversationCount(usage.totalTokens)} total tokens
					</span>
				</>
			) : null}
			{usage.cacheReadTokens !== null ? (
				<>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">
						{formatConversationCount(usage.cacheReadTokens)} cache read
					</span>
				</>
			) : null}
			{usage.reasoningTokens !== null ? (
				<>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">
						{formatConversationCount(usage.reasoningTokens)} reasoning
					</span>
				</>
			) : null}
			<span aria-hidden="true">·</span>
			<span className="tabular-nums">
				{formatConversationCost(usage.costUsd)}
			</span>
			{usage.callCount > 1 ? (
				<>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{usage.callCount} calls</span>
				</>
			) : null}
			{generationId ? (
				<>
					<span aria-hidden="true">·</span>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						className="h-6 min-w-0 max-w-48 px-1 font-mono font-normal text-xs"
						title={generationId}
						aria-label={`Copy generation ID ${generationId}`}
						onClick={() => void copyText(generationId)}
					>
						<CopyIcon aria-hidden="true" className="size-3" />
						<span className="truncate">{generationId}</span>
						{usage.gatewayGenerationIds.length > 1
							? ` +${usage.gatewayGenerationIds.length - 1}`
							: null}
					</Button>
				</>
			) : null}
		</div>
	);
}

async function copyText(value: string) {
	try {
		await navigator.clipboard.writeText(value);
	} catch {
		// The ID remains selectable and visible if clipboard access is denied.
	}
}
