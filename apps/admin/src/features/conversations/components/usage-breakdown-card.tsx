import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	AiCall,
	ChatDetail,
} from "@/features/conversations/api/conversations.dto";
import {
	formatCentiCredits,
	formatConversationCount,
	formatConversationDateTime,
	formatConversationTokenCount,
	formatUsdMicros,
	titleCaseIdentifier,
} from "@/features/conversations/lib/conversation-formatters";
import { isGenerationReferenceCall } from "@/features/conversations/lib/conversation-usage";

const MAX_TREND_TURNS = 40;

type UsageBreakdownCardProps = {
	usageSummary: ChatDetail["usageSummary"];
	calls: AiCall[];
	callsTotal: number;
	isCallsPending?: boolean;
	hasCallsError?: boolean;
};

export function UsageBreakdownCard({
	usageSummary,
	calls,
	callsTotal,
	isCallsPending = false,
	hasCallsError = false,
}: UsageBreakdownCardProps) {
	const chatTurns = aggregateChatCalls(calls);
	const visibleTurns = chatTurns.slice(-MAX_TREND_TURNS);
	const maxInputTokens = Math.max(
		1,
		...visibleTurns.map((call) => Math.max(call.inputTokens ?? 0, 0)),
	);
	const turnOffset = chatTurns.length - visibleTurns.length;
	const turnsCapped = chatTurns.length > MAX_TREND_TURNS;
	const sourceWindowTruncated = callsTotal > calls.length;

	return (
		<Card className="min-w-0 gap-0 py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h3>Usage breakdown</h3>
				</CardTitle>
				<CardDescription>
					Metered events grouped by operation and model, without generation
					references.
				</CardDescription>
			</CardHeader>

			<CardContent className="min-w-0 px-0">
				{usageSummary.length === 0 ? (
					<p className="px-6 py-8 text-center text-muted-foreground text-sm">
						No aggregated usage has been recorded for this conversation.
					</p>
				) : (
					<Table className="min-w-[860px]">
						<TableCaption className="sr-only">
							Usage totals grouped by operation and model
						</TableCaption>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Operation</TableHead>
								<TableHead>Model</TableHead>
								<TableHead className="text-right">Calls</TableHead>
								<TableHead className="text-right">Input</TableHead>
								<TableHead className="text-right">Cache read</TableHead>
								<TableHead className="text-right">Output</TableHead>
								<TableHead className="text-right">Cost USD</TableHead>
								<TableHead className="pr-6 text-right">Credits</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{usageSummary.map((row) => (
								<TableRow key={`${row.operation}:${row.model ?? "unknown"}`}>
									<TableCell className="pl-6 font-medium">
										{titleCaseIdentifier(row.operation)}
									</TableCell>
									<TableCell className="max-w-64 truncate font-mono text-xs">
										{row.model ?? "—"}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatConversationCount(row.calls)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatConversationTokenCount(row.inputTokens)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatConversationTokenCount(row.cacheReadTokens)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatConversationTokenCount(row.outputTokens)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatUsdMicros(row.costUsdMicros)}
									</TableCell>
									<TableCell className="pr-6 text-right tabular-nums">
										{formatCentiCredits(row.creditsCenti)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}

				<section
					className="border-t px-6 py-5"
					aria-labelledby="token-trend-title"
				>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h4 id="token-trend-title" className="font-medium text-sm">
								Input tokens per chat turn
							</h4>
							<p className="mt-1 text-muted-foreground text-xs">
								Oldest to newest. Bar length shows context growth.
							</p>
						</div>
						<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
							<span className="inline-flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className="size-2 rounded-sm bg-primary"
								/>
								Fresh input
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className="size-2 rounded-sm bg-sky-500"
								/>
								Cache read
							</span>
						</div>
					</div>

					{isCallsPending ? (
						<div
							className="mt-5 space-y-2"
							role="status"
							aria-label="Loading turn trend"
						>
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-4/5" />
							<Skeleton className="h-4 w-11/12" />
						</div>
					) : hasCallsError ? (
						<p className="mt-5 text-muted-foreground text-sm">
							The per-turn usage window could not be loaded.
						</p>
					) : visibleTurns.length === 0 ? (
						<p className="mt-5 text-muted-foreground text-sm">
							No aggregate chat events are available in the inline usage window.
						</p>
					) : (
						<div className="mt-5 space-y-1.5">
							<div
								className="grid grid-cols-[2rem_3.5rem_minmax(3rem,1fr)_3.5rem] items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wide sm:grid-cols-[2.5rem_4.5rem_minmax(6rem,1fr)_4.5rem]"
								aria-hidden="true"
							>
								<span>Turn</span>
								<span className="text-right">Input</span>
								<span />
								<span>Output</span>
							</div>
							<ol className="space-y-1">
								{visibleTurns.map((call, index) => (
									<TokenTrendRow
										key={call.id}
										call={call}
										turnNumber={turnOffset + index + 1}
										maxInputTokens={maxInputTokens}
									/>
								))}
							</ol>
							{turnsCapped || sourceWindowTruncated ? (
								<p className="pt-2 text-muted-foreground text-xs">
									{turnsCapped
										? `Showing the newest ${MAX_TREND_TURNS} chat turns from the inline usage window.`
										: null}
									{turnsCapped && sourceWindowTruncated ? " " : null}
									{sourceWindowTruncated
										? `The window contains the newest ${calls.length} of ${callsTotal} usage rows.`
										: null}
								</p>
							) : null}
						</div>
					)}
				</section>
			</CardContent>
		</Card>
	);
}

function TokenTrendRow({
	call,
	turnNumber,
	maxInputTokens,
}: {
	call: AiCall;
	turnNumber: number;
	maxInputTokens: number;
}) {
	const inputTokens = Math.max(call.inputTokens ?? 0, 0);
	const cacheReadTokens = Math.min(
		Math.max(call.cacheReadTokens ?? 0, 0),
		inputTokens,
	);
	const freshInputTokens = inputTokens - cacheReadTokens;
	const inputWidth = (inputTokens / maxInputTokens) * 100;
	const cacheWidth =
		inputTokens === 0 ? 0 : (cacheReadTokens / inputTokens) * 100;
	const freshWidth =
		inputTokens === 0 ? 0 : (freshInputTokens / inputTokens) * 100;
	const createdAt = formatConversationDateTime(call.createdAt);

	return (
		<li
			className="grid grid-cols-[2rem_3.5rem_minmax(3rem,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[2.5rem_4.5rem_minmax(6rem,1fr)_4.5rem]"
			title={createdAt}
			aria-label={`Turn ${turnNumber}, ${call.inputTokens ?? "unknown"} input tokens, ${call.cacheReadTokens ?? "unknown"} cache read tokens, ${call.outputTokens ?? "unknown"} output tokens, ${createdAt}`}
		>
			<span className="text-muted-foreground tabular-nums">{turnNumber}</span>
			<span className="text-right font-medium tabular-nums">
				{formatConversationTokenCount(call.inputTokens)}
			</span>
			<span
				aria-hidden="true"
				className="h-2 overflow-hidden rounded-full bg-muted"
			>
				<span
					className="flex h-full overflow-hidden rounded-full"
					style={{
						width: `${inputWidth}%`,
						minWidth: inputTokens > 0 ? "2px" : undefined,
					}}
				>
					<span
						className="h-full bg-primary"
						style={{ width: `${freshWidth}%` }}
					/>
					<span
						className="h-full bg-sky-500"
						style={{ width: `${cacheWidth}%` }}
					/>
				</span>
			</span>
			<span className="text-muted-foreground tabular-nums">
				{formatConversationTokenCount(call.outputTokens)} out
			</span>
		</li>
	);
}

function aggregateChatCalls(calls: AiCall[]): AiCall[] {
	return calls
		.filter(
			(call) => call.operation === "chat" && !isGenerationReferenceCall(call),
		)
		.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
