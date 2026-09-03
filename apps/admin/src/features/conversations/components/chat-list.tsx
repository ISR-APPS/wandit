import { Link } from "@tanstack/react-router";
import { MessageSquareTextIcon } from "lucide-react";
import type { MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ChatSummary } from "@/features/conversations/api/conversations.dto";
import {
	formatCentiCredits,
	formatConversationCount,
	formatConversationDateTime,
	formatConversationRelativeTime,
	formatConversationTokenCount,
} from "@/features/conversations/lib/conversation-formatters";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";

type ChatListProps = {
	items: ChatSummary[];
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	isFetching?: boolean;
	emptyTitle?: string;
	emptyDescription?: string;
};

export function ChatList({
	items,
	page,
	pageSize,
	total,
	onPageChange,
	isFetching = false,
	emptyTitle = "No conversations yet",
	emptyDescription = "Conversations will appear here after the first chat message.",
}: ChatListProps) {
	if (items.length === 0) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MessageSquareTextIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>{emptyTitle}</EmptyTitle>
					<EmptyDescription>{emptyDescription}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="space-y-4" aria-busy={isFetching}>
			<MobileChatList items={items} />
			<div className="hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Conversation</TableHead>
							<TableHead>Project</TableHead>
							<TableHead>Owner</TableHead>
							<TableHead>Last activity</TableHead>
							<TableHead className="text-right">Tokens</TableHead>
							<TableHead className="text-right">Credits</TableHead>
							<TableHead className="text-right">Messages</TableHead>
							<TableHead className="text-right">Failures</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((chat) => {
							const activityAt = chat.lastMessageAt ?? chat.createdAt;

							return (
								<TableRow
									key={chat.id}
									className="cursor-pointer focus-within:bg-muted/70 hover:bg-muted/70"
									onClick={openChatFromRow}
								>
									<TableCell>
										<Link
											to="/chats/$chatId"
											params={{ chatId: chat.id }}
											data-chat-row-link
											className="block max-w-48 truncate rounded-sm font-mono text-primary text-xs underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
											title={chat.id}
										>
											{chat.id}
										</Link>
									</TableCell>
									<TableCell className="max-w-52 truncate">
										{chat.projectName ?? "Unknown project"}
									</TableCell>
									<TableCell className="max-w-56">
										{chat.owner ? (
											<div className="min-w-0">
												<p className="truncate">{chat.owner.name}</p>
												<p className="truncate text-muted-foreground text-xs">
													{chat.owner.email}
												</p>
											</div>
										) : (
											<span className="text-muted-foreground">Unknown</span>
										)}
									</TableCell>
									<TableCell>
										<time
											dateTime={activityAt}
											title={formatConversationDateTime(activityAt)}
											className="text-muted-foreground"
										>
											{formatConversationRelativeTime(activityAt)}
										</time>
									</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{formatConversationTokenCount(chat.totalTokens)}
									</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{formatCentiCredits(chat.totalCreditsCenti)}
									</TableCell>
									<TableCell>
										<span className="flex items-center justify-end gap-1.5 text-muted-foreground tabular-nums">
											<MessageSquareTextIcon
												aria-hidden="true"
												className="size-3.5"
											/>
											{formatConversationCount(chat.messageCount)}
											<span className="sr-only"> messages</span>
										</span>
									</TableCell>
									<TableCell className="text-right">
										{chat.failedTurnCount > 0 ? (
											<Badge variant="destructive" className="tabular-nums">
												{formatConversationCount(chat.failedTurnCount)}
											</Badge>
										) : (
											<span className="text-muted-foreground">
												<span aria-hidden="true">—</span>
												<span className="sr-only">No failures</span>
											</span>
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
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

function MobileChatList({ items }: { items: ChatSummary[] }) {
	return (
		<ul className="divide-y lg:hidden">
			{items.map((chat) => {
				const activityAt = chat.lastMessageAt ?? chat.createdAt;

				return (
					<li key={chat.id}>
						<Link
							to="/chats/$chatId"
							params={{ chatId: chat.id }}
							className="-mx-2 block min-w-0 rounded-md px-2 py-3 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
						>
							<div className="flex min-w-0 items-center gap-2">
								<span
									className="min-w-0 flex-1 truncate font-mono text-primary text-xs"
									title={chat.id}
								>
									{chat.id}
								</span>
								{chat.failedTurnCount > 0 ? (
									<Badge
										variant="destructive"
										className="shrink-0 tabular-nums"
									>
										{formatConversationCount(chat.failedTurnCount)} failed
									</Badge>
								) : null}
							</div>
							<p className="mt-1 truncate text-sm">
								{chat.projectName ?? "Unknown project"}
								{chat.owner ? (
									<span className="text-muted-foreground">
										{" "}
										· {chat.owner.name}
									</span>
								) : null}
							</p>
							<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
								<span>
									{formatConversationTokenCount(chat.totalTokens)} tokens
								</span>
								<span>
									{formatCentiCredits(chat.totalCreditsCenti)} credits
								</span>
								<span>
									{formatConversationCount(chat.messageCount)} messages
								</span>
								<time
									dateTime={activityAt}
									title={formatConversationDateTime(activityAt)}
								>
									{formatConversationRelativeTime(activityAt)}
								</time>
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function openChatFromRow(event: MouseEvent<HTMLTableRowElement>) {
	if (
		event.target instanceof Element &&
		event.target.closest("a, button, input, select, textarea")
	) {
		return;
	}

	event.currentTarget
		.querySelector<HTMLAnchorElement>("[data-chat-row-link]")
		?.click();
}
