import { Link } from "@tanstack/react-router";
import { MessageSquareTextIcon } from "lucide-react";

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
					{items.map((chat) => (
						<TableRow key={chat.id}>
							<TableCell>
								<Link
									to="/chats/$chatId"
									params={{ chatId: chat.id }}
									className="block max-w-48 truncate font-mono text-primary text-xs underline-offset-4 hover:underline"
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
								<time dateTime={chat.lastMessageAt ?? chat.createdAt}>
									{formatConversationDateTime(chat.lastMessageAt)}
								</time>
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatConversationCount(chat.messageCount)}
							</TableCell>
							<TableCell className="text-right">
								<Badge
									variant={chat.failedTurnCount > 0 ? "destructive" : "outline"}
									className="tabular-nums"
								>
									{formatConversationCount(chat.failedTurnCount)}
								</Badge>
							</TableCell>
						</TableRow>
					))}
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
