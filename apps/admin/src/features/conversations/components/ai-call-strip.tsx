import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AiCall } from "@/features/conversations/api/conversations.dto";
import {
	formatCentiCredits,
	formatConversationCost,
	formatConversationDateTime,
	formatConversationTokenCount,
	titleCaseIdentifier,
} from "@/features/conversations/lib/conversation-formatters";
import { gatewayGenerationUrl } from "@/features/conversations/lib/external-links";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";

type AiCallStripProps = {
	calls: AiCall[];
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	isFetching?: boolean;
};

export function AiCallStrip({
	calls,
	page,
	pageSize,
	total,
	onPageChange,
	isFetching = false,
}: AiCallStripProps) {
	if (calls.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<p className="font-medium text-sm">No AI usage calls</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Usage rows will appear after a metered AI operation runs.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4" aria-busy={isFetching}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Operation</TableHead>
						<TableHead>Model</TableHead>
						<TableHead>Provider</TableHead>
						<TableHead className="text-right">Tokens</TableHead>
						<TableHead className="text-right">Cost</TableHead>
						<TableHead>Created</TableHead>
						<TableHead className="text-right">Links</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{calls.map((call) => {
						const gatewayUrl = gatewayGenerationUrl(call.gatewayGenerationId);
						const cacheAndReasoning = [
							call.cacheReadTokens === null
								? null
								: `${formatConversationTokenCount(call.cacheReadTokens)} cache read`,
							call.cacheWriteTokens === null
								? null
								: `${formatConversationTokenCount(call.cacheWriteTokens)} cache write`,
							call.reasoningTokens === null
								? null
								: `${formatConversationTokenCount(call.reasoningTokens)} reasoning`,
						].filter((segment): segment is string => segment !== null);

						return (
							<TableRow key={call.id}>
								<TableCell>
									<Badge variant="outline">
										{titleCaseIdentifier(call.operation)}
									</Badge>
								</TableCell>
								<TableCell className="max-w-56 truncate font-mono text-xs">
									{call.model ?? "—"}
								</TableCell>
								<TableCell>{call.provider ?? "—"}</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatConversationTokenCount(call.totalTokens)}
									{call.inputTokens !== null || call.outputTokens !== null ? (
										<p className="text-[10px] text-muted-foreground">
											{formatConversationTokenCount(call.inputTokens)} in ·{" "}
											{formatConversationTokenCount(call.outputTokens)} out
										</p>
									) : null}
									{cacheAndReasoning.length > 0 ? (
										<p className="text-[10px] text-muted-foreground">
											{cacheAndReasoning.join(" · ")}
										</p>
									) : null}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatConversationCost(call.costUsd)}
									{call.creditsCenti !== null ? (
										<p className="text-[10px] text-muted-foreground">
											{formatCentiCredits(call.creditsCenti)} credits
										</p>
									) : null}
								</TableCell>
								<TableCell>
									<time dateTime={call.createdAt}>
										{formatConversationDateTime(call.createdAt)}
									</time>
								</TableCell>
								<TableCell className="text-right">
									{gatewayUrl ? (
										<a
											href={gatewayUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-primary text-xs underline-offset-4 hover:underline"
										>
											Gateway log
											<ExternalLinkIcon aria-hidden="true" className="size-3" />
										</a>
									) : (
										<span className="text-muted-foreground text-xs">—</span>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			<ProjectDetailPagination
				page={page}
				pageSize={pageSize}
				total={total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
