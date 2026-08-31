import {
	ArrowDownToLineIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MessageSquareTextIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type {
	AiCall,
	ChatMessage,
} from "@/features/conversations/api/conversations.dto";
import { messageHasFailure } from "@/features/conversations/lib/conversation-failures";
import { formatConversationDateTime } from "@/features/conversations/lib/conversation-formatters";
import { groupConversationTurns } from "@/features/conversations/lib/conversation-turns";
import {
	groupCallsByMessageId,
	mergeUsageSummaries,
} from "@/features/conversations/lib/conversation-usage";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";

import { MessageRow } from "./message-row";

const EMPTY_CALLS: AiCall[] = [];

type TranscriptProps = {
	messages: ChatMessage[];
	calls?: AiCall[];
	page: number;
	pageSize: number;
	total: number;
	failedTurnCount?: number;
	onPageChange: (page: number) => void;
	isFetching?: boolean;
	failureJumpRequest?: number;
};

export function Transcript({
	messages,
	calls = EMPTY_CALLS,
	page,
	pageSize,
	total,
	failedTurnCount = 0,
	onPageChange,
	isFetching = false,
	failureJumpRequest = 0,
}: TranscriptProps) {
	const transcriptRef = useRef<HTMLDivElement>(null);
	const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handledJumpRequestRef = useRef(0);
	const [failureCursor, setFailureCursor] = useState(-1);
	const [highlightedMessageId, setHighlightedMessageId] = useState<
		string | null
	>(null);
	const turns = useMemo(() => groupConversationTurns(messages), [messages]);
	const usageByMessageId = useMemo(() => groupCallsByMessageId(calls), [calls]);
	const visibleFailureIds = useMemo(() => {
		const ids: string[] = [];
		for (const message of messages) {
			if (messageHasFailure(message)) ids.push(message.id);
		}
		return ids;
	}, [messages]);
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	const highlightFailure = useCallback((messageId: string) => {
		const messageElement = Array.from(
			transcriptRef.current?.querySelectorAll<HTMLElement>(
				"[data-message-id]",
			) ?? [],
		).find((element) => element.dataset.messageId === messageId);
		if (!messageElement) {
			return;
		}

		messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedMessageId(messageId);
		if (highlightTimerRef.current) {
			clearTimeout(highlightTimerRef.current);
		}
		highlightTimerRef.current = setTimeout(() => {
			setHighlightedMessageId(null);
		}, 1_600);
	}, []);

	const jumpToFailure = useCallback(
		(direction: "first" | "next" | "previous") => {
			if (visibleFailureIds.length === 0) {
				return;
			}

			let nextIndex = 0;
			if (direction === "previous") {
				nextIndex =
					failureCursor <= 0 ? visibleFailureIds.length - 1 : failureCursor - 1;
			} else if (direction === "next") {
				nextIndex =
					failureCursor < 0 || failureCursor >= visibleFailureIds.length - 1
						? 0
						: failureCursor + 1;
			}

			setFailureCursor(nextIndex);
			const messageId = visibleFailureIds[nextIndex];
			if (messageId) {
				highlightFailure(messageId);
			}
		},
		[failureCursor, highlightFailure, visibleFailureIds],
	);

	useEffect(() => {
		if (
			failureJumpRequest <= 0 ||
			failureJumpRequest === handledJumpRequestRef.current ||
			isFetching
		) {
			return;
		}

		handledJumpRequestRef.current = failureJumpRequest;
		jumpToFailure("first");
	}, [failureJumpRequest, isFetching, jumpToFailure]);

	useEffect(
		() => () => {
			if (highlightTimerRef.current) {
				clearTimeout(highlightTimerRef.current);
			}
		},
		[],
	);

	if (messages.length === 0) {
		return (
			<Empty className="min-h-72 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MessageSquareTextIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No transcript messages</EmptyTitle>
					<EmptyDescription>
						This conversation does not have any stored message rows.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div ref={transcriptRef} className="space-y-2" aria-busy={isFetching}>
			<div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-b bg-background/95 px-2 py-2.5 backdrop-blur-sm">
				<div className="flex items-center gap-2 text-muted-foreground text-xs">
					<MessageSquareTextIcon aria-hidden="true" className="size-3.5" />
					<span className="tabular-nums">
						{total.toLocaleString("en-US")} messages
					</span>
				</div>

				{failedTurnCount > 0 ? (
					<div className="flex items-center gap-1">
						<Badge variant="destructive" className="ms-1 tabular-nums">
							{failedTurnCount.toLocaleString("en-US")} failed
						</Badge>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={visibleFailureIds.length === 0}
							aria-label="Previous failed message"
							onClick={() => jumpToFailure("previous")}
						>
							<ChevronLeftIcon aria-hidden="true" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={visibleFailureIds.length === 0}
							aria-label="Next failed message"
							onClick={() => jumpToFailure("next")}
						>
							<ChevronRightIcon aria-hidden="true" />
						</Button>
						<span className="sr-only" aria-live="polite">
							{visibleFailureIds.length > 0
								? `${visibleFailureIds.length} failures on this page`
								: "No failures on this page"}
						</span>
					</div>
				) : null}

				<div className="ms-auto flex items-center gap-2">
					<span className="hidden text-muted-foreground text-xs sm:inline">
						Oldest first on this page
					</span>
					{page < pageCount ? (
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={() => onPageChange(pageCount)}
						>
							<ArrowDownToLineIcon aria-hidden="true" />
							Jump to latest
						</Button>
					) : null}
				</div>
			</div>

			<div
				className="divide-y divide-border/60 px-1 transition-opacity data-[fetching=true]:opacity-60 sm:px-3"
				data-fetching={isFetching ? "true" : "false"}
			>
				{turns.map((turn) => {
					const assistantMessages = turn.messages.filter(
						(message) => message.role === "assistant",
					);
					const lastAssistantId = assistantMessages.at(-1)?.id;
					const turnUsage = turn.userMessageId
						? usageByMessageId.get(turn.userMessageId)
						: undefined;

					return (
						<section key={turn.id} className="py-7 first:pt-5 last:pb-5">
							<div className="mb-4 flex items-center gap-3 text-muted-foreground/80 text-xs">
								<time dateTime={turn.createdAt}>
									{formatConversationDateTime(turn.createdAt)}
								</time>
								<span className="h-px flex-1 bg-border/60" aria-hidden="true" />
							</div>
							<div className="space-y-5">
								{turn.messages.map((message) => {
									const directUsage = usageByMessageId.get(message.id);
									const usage =
										message.role === "assistant"
											? mergeUsageSummaries(
													directUsage,
													message.id === lastAssistantId &&
														turn.userMessageId !== message.id
														? turnUsage
														: undefined,
												)
											: undefined;

									return (
										<MessageRow
											key={message.id}
											message={message}
											usage={usage}
											highlighted={highlightedMessageId === message.id}
										/>
									);
								})}
							</div>
						</section>
					);
				})}
			</div>

			<ProjectDetailPagination
				page={page}
				pageSize={pageSize}
				total={total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
