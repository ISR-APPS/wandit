import { Link } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	ArrowLeftIcon,
	MessageSquareTextIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";

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
import { useProjectChatsQuery } from "@/features/conversations/api/conversations.queries";
import { ChatList } from "@/features/conversations/components/chat-list";

const PROJECT_CHATS_PAGE_SIZE = 20;
const PROJECT_CHAT_SKELETON_KEYS = [
	"chat-one",
	"chat-two",
	"chat-three",
	"chat-four",
	"chat-five",
] as const;

type ProjectConversationsPageProps = {
	projectId: string;
	userId: string;
};

export function ProjectConversationsPage({
	projectId,
	userId,
}: ProjectConversationsPageProps) {
	const [page, setPage] = useState(1);
	const chatsQuery = useProjectChatsQuery({
		projectId,
		page,
		pageSize: PROJECT_CHATS_PAGE_SIZE,
	});
	const projectName = chatsQuery.data?.items[0]?.projectName;

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<header className="flex flex-col gap-4 rounded-xl border bg-background p-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Conversation inspector
					</p>
					<h1 className="mt-2 font-semibold text-2xl tracking-tight">
						{projectName ?? "Project conversations"}
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
						Open a conversation to inspect its server-redacted transcript and AI
						usage rows.
					</p>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link
						to="/users/$userId/projects/$projectId"
						params={{ userId, projectId }}
					>
						<ArrowLeftIcon aria-hidden="true" />
						Back to project
					</Link>
				</Button>
			</header>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<MessageSquareTextIcon aria-hidden="true" className="size-4" />
						</div>
						<div>
							<CardTitle>Chats</CardTitle>
							<CardDescription>
								Most recently updated conversations appear first.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{chatsQuery.isPending ? (
						<ProjectChatsSkeleton />
					) : chatsQuery.isError || !chatsQuery.data ? (
						<Empty className="min-h-64 border-0">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<AlertCircleIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>Conversations could not be loaded</EmptyTitle>
								<EmptyDescription>
									{chatsQuery.error instanceof Error
										? chatsQuery.error.message
										: "Retry the request to load this project."}
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button type="button" onClick={() => void chatsQuery.refetch()}>
									<RefreshCwIcon aria-hidden="true" />
									Retry
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<ChatList
							items={chatsQuery.data.items}
							page={chatsQuery.data.page}
							pageSize={chatsQuery.data.pageSize}
							total={chatsQuery.data.total}
							onPageChange={setPage}
							isFetching={chatsQuery.isFetching}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function ProjectChatsSkeleton() {
	return (
		<div className="space-y-3" role="status" aria-label="Loading chats">
			<Skeleton className="h-10 w-full" />
			{PROJECT_CHAT_SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-14 w-full" />
			))}
		</div>
	);
}
