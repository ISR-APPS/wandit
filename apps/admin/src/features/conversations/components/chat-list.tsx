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
	formatConversationCount,
	formatConversationDateTime,
	formatConversationRelativeTime,
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
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Conversation</TableHead>
						<TableHead>Project</TableHead>
						<TableHead>Owner</TableHead>
						<TableHead>Last activity</TableHead>
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
			<ProjectDetailPagination
				page={page}
				pageSize={pageSize}
				total={total}
				onPageChange={onPageChange}
			/>
		</div>
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
