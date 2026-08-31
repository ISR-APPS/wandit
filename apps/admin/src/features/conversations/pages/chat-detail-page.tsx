import { Link } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	ArrowLeftIcon,
	CircleDollarSignIcon,
	MessageSquareTextIcon,
	RefreshCwIcon,
	TriangleAlertIcon,
	UserRoundIcon,
} from "lucide-react";
import { type PropsWithChildren, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useChatCallsQuery,
	useChatDetailQuery,
	useChatMessagesQuery,
} from "@/features/conversations/api/conversations.queries";
import { AiCallStrip } from "@/features/conversations/components/ai-call-strip";
import { Transcript } from "@/features/conversations/components/transcript";
import {
	formatConversationCount,
	formatConversationDateTime,
	formatUsdMicros,
} from "@/features/conversations/lib/conversation-formatters";
import { isApiClientError } from "@/lib/api-client";

const MESSAGES_PAGE_SIZE = 50;
const CALLS_PAGE_SIZE = 20;
const INLINE_CALLS_PAGE_SIZE = 100;
const SECTION_SKELETON_KEYS = [
	"section-one",
	"section-two",
	"section-three",
	"section-four",
	"section-five",
] as const;
const METRIC_SKELETON_KEYS = [
	"messages",
	"failed-turns",
	"total-tokens",
	"recorded-cost",
] as const;

export function ChatDetailPage({ chatId }: { chatId: string }) {
	const [messagesPage, setMessagesPage] = useState(1);
	const [callsPage, setCallsPage] = useState(1);
	const [activeTab, setActiveTab] = useState<"transcript" | "usage">(
		"transcript",
	);
	const [failureJumpRequest, setFailureJumpRequest] = useState(0);
	const detailQuery = useChatDetailQuery(chatId);
	const messagesQuery = useChatMessagesQuery({
		chatId,
		page: messagesPage,
		pageSize: MESSAGES_PAGE_SIZE,
	});
	const callsQuery = useChatCallsQuery({
		chatId,
		page: callsPage,
		pageSize: CALLS_PAGE_SIZE,
	});
	const inlineCallsQuery = useChatCallsQuery({
		chatId,
		page: 1,
		pageSize: INLINE_CALLS_PAGE_SIZE,
	});

	if (detailQuery.isPending) {
		return (
			<ChatDetailContainer>
				<ChatDetailSkeleton />
			</ChatDetailContainer>
		);
	}

	if (detailQuery.isError || !detailQuery.data) {
		const missing =
			isApiClientError(detailQuery.error) && detailQuery.error.status === 404;

		return (
			<ChatDetailContainer>
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							{missing ? (
								<MessageSquareTextIcon aria-hidden="true" />
							) : (
								<AlertCircleIcon aria-hidden="true" />
							)}
						</EmptyMedia>
						<EmptyTitle>
							{missing
								? "Conversation not found"
								: "Conversation could not be loaded"}
						</EmptyTitle>
						<EmptyDescription>
							{missing
								? "This chat may have been removed, or the chat ID is incorrect."
								: detailQuery.error instanceof Error
									? detailQuery.error.message
									: "Retry the request to open this conversation."}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						{missing ? null : (
							<Button type="button" onClick={() => void detailQuery.refetch()}>
								<RefreshCwIcon aria-hidden="true" />
								Retry
							</Button>
						)}
						<Button asChild variant="outline">
							<Link to="/analytics/ai-failures">
								<ArrowLeftIcon aria-hidden="true" />
								AI failures
							</Link>
						</Button>
					</EmptyContent>
				</Empty>
			</ChatDetailContainer>
		);
	}

	const detail = detailQuery.data;
	const projectListLink =
		detail.project && detail.owner?.id
			? {
					to: "/users/$userId/projects/$projectId/chats" as const,
					params: {
						userId: detail.owner.id,
						projectId: detail.project.id,
					},
				}
			: null;

	function openFirstFailure() {
		setActiveTab("transcript");
		setMessagesPage(1);
		setFailureJumpRequest((request) => request + 1);
	}

	return (
		<ChatDetailContainer>
			<header className="rounded-xl border bg-background p-6">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline">Conversation inspector</Badge>
							<span className="font-mono text-muted-foreground text-xs">
								{chatId}
							</span>
						</div>
						<h1 className="mt-3 font-semibold text-2xl tracking-tight">
							{detail.project?.name ?? "Conversation"}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Created {formatConversationDateTime(detail.chat.createdAt)} ·
							updated {formatConversationDateTime(detail.chat.updatedAt)}
						</p>
					</div>

					<div className="flex flex-col items-start gap-3 lg:items-end">
						{detail.owner ? (
							<div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
								<div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
									<UserRoundIcon aria-hidden="true" className="size-4" />
								</div>
								<div className="min-w-0">
									{detail.owner.id ? (
										<Link
											to="/users/$userId"
											params={{ userId: detail.owner.id }}
											className="font-medium text-sm underline-offset-4 hover:underline"
										>
											{detail.owner.name}
										</Link>
									) : (
										<p className="font-medium text-sm">{detail.owner.name}</p>
									)}
									<p className="max-w-64 truncate text-muted-foreground text-xs">
										{detail.owner.email}
									</p>
								</div>
							</div>
						) : null}
						{projectListLink ? (
							<Button asChild variant="outline" size="sm">
								<Link to={projectListLink.to} params={projectListLink.params}>
									<ArrowLeftIcon aria-hidden="true" />
									Project conversations
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</header>

			<section
				className="grid overflow-hidden rounded-xl border bg-background sm:grid-cols-2 xl:grid-cols-4 [&>*:not(:last-child)]:border-b xl:[&>*:not(:last-child)]:border-e sm:[&>*:nth-child(n+3)]:border-b-0 sm:[&>*:nth-child(odd)]:border-e xl:[&>*]:border-b-0"
				aria-label="Conversation totals"
			>
				<MetricStat
					label="Messages"
					value={formatConversationCount(detail.messageCount)}
					icon={MessageSquareTextIcon}
				/>
				<MetricStat
					label="Failed turns"
					value={formatConversationCount(detail.failedTurnCount)}
					icon={TriangleAlertIcon}
					danger={detail.failedTurnCount > 0}
					onClick={detail.failedTurnCount > 0 ? openFirstFailure : undefined}
				/>
				<MetricStat
					label="Total tokens"
					value={formatConversationCount(detail.totalTokens)}
					icon={MessageSquareTextIcon}
				/>
				<MetricStat
					label="Recorded cost"
					value={formatUsdMicros(detail.totalCostUsdMicros)}
					icon={CircleDollarSignIcon}
				/>
			</section>

			<Card className="gap-0 overflow-visible">
				<Tabs
					value={activeTab}
					onValueChange={(value) =>
						setActiveTab(value === "usage" ? "usage" : "transcript")
					}
					className="gap-0"
				>
					<CardHeader className="gap-4 border-b">
						<div>
							<CardTitle>Conversation details</CardTitle>
							<CardDescription>
								The server redacts transcript strings unless your role has raw
								access.
							</CardDescription>
						</div>
						<TabsList variant="line">
							<TabsTrigger value="transcript">Transcript</TabsTrigger>
							<TabsTrigger value="usage">Usage</TabsTrigger>
						</TabsList>
					</CardHeader>

					<TabsContent value="transcript" className="mt-0">
						<CardContent className="py-6">
							{messagesQuery.isPending ? (
								<SectionSkeleton rows={5} />
							) : messagesQuery.isError || !messagesQuery.data ? (
								<SectionError
									title="Transcript could not be loaded"
									error={messagesQuery.error}
									onRetry={() => void messagesQuery.refetch()}
								/>
							) : (
								<Transcript
									messages={messagesQuery.data.items}
									calls={inlineCallsQuery.data?.items ?? []}
									page={messagesQuery.data.page}
									pageSize={messagesQuery.data.pageSize}
									total={messagesQuery.data.total}
									failedTurnCount={detail.failedTurnCount}
									onPageChange={setMessagesPage}
									isFetching={
										messagesQuery.isFetching || inlineCallsQuery.isFetching
									}
									failureJumpRequest={failureJumpRequest}
								/>
							)}
						</CardContent>
					</TabsContent>

					<TabsContent value="usage" className="mt-0">
						<CardContent className="py-6">
							{callsQuery.isPending ? (
								<SectionSkeleton rows={4} />
							) : callsQuery.isError || !callsQuery.data ? (
								<SectionError
									title="AI usage could not be loaded"
									error={callsQuery.error}
									onRetry={() => void callsQuery.refetch()}
								/>
							) : (
								<AiCallStrip
									calls={callsQuery.data.items}
									page={callsQuery.data.page}
									pageSize={callsQuery.data.pageSize}
									total={callsQuery.data.total}
									onPageChange={setCallsPage}
									isFetching={callsQuery.isFetching}
								/>
							)}
						</CardContent>
					</TabsContent>
				</Tabs>
			</Card>
		</ChatDetailContainer>
	);
}

function ChatDetailContainer({ children }: PropsWithChildren) {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			{children}
		</div>
	);
}

function MetricStat({
	label,
	value,
	icon: Icon,
	danger = false,
	onClick,
}: {
	label: string;
	value: string;
	icon: typeof MessageSquareTextIcon;
	danger?: boolean;
	onClick?: () => void;
}) {
	const content = (
		<>
			<div>
				<p className="text-muted-foreground text-xs uppercase tracking-wide">
					{label}
				</p>
				<p
					className={
						danger
							? "mt-1 font-semibold text-destructive text-lg tabular-nums"
							: "mt-1 font-semibold text-lg tabular-nums"
					}
				>
					{value}
				</p>
			</div>
			<Icon
				aria-hidden="true"
				className={
					danger ? "size-4 text-destructive" : "size-4 text-muted-foreground"
				}
			/>
		</>
	);

	return onClick ? (
		<button
			type="button"
			className="flex min-h-20 items-center justify-between px-4 py-3 text-start outline-none transition-colors hover:bg-destructive/5 focus-visible:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:translate-y-px"
			onClick={onClick}
			aria-label="Open transcript and jump to the first failed message"
		>
			{content}
		</button>
	) : (
		<div className="flex min-h-20 items-center justify-between px-4 py-3">
			{content}
		</div>
	);
}

function SectionError({
	title,
	error,
	onRetry,
}: {
	title: string;
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
			<p className="font-medium text-sm">{title}</p>
			<p className="mt-1 text-muted-foreground text-sm">
				{error instanceof Error ? error.message : "Retry the request."}
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4"
				onClick={onRetry}
			>
				<RefreshCwIcon aria-hidden="true" />
				Retry
			</Button>
		</div>
	);
}

function SectionSkeleton({ rows }: { rows: number }) {
	return (
		<div className="space-y-3" role="status" aria-label="Loading section">
			{SECTION_SKELETON_KEYS.slice(0, rows).map((key) => (
				<Skeleton key={key} className="h-24 w-full" />
			))}
		</div>
	);
}

function ChatDetailSkeleton() {
	return (
		<>
			<Skeleton className="h-40 w-full rounded-xl" />
			<div className="grid overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-4 [&>*:not(:last-child)]:border-b xl:[&>*:not(:last-child)]:border-e sm:[&>*:nth-child(n+3)]:border-b-0 sm:[&>*:nth-child(odd)]:border-e xl:[&>*]:border-b-0">
				{METRIC_SKELETON_KEYS.map((key) => (
					<div key={key} className="p-4">
						<Skeleton className="h-12 w-full" />
					</div>
				))}
			</div>
			<Skeleton className="h-[32rem] w-full rounded-xl" />
		</>
	);
}
