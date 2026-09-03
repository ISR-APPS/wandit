import { MessageSquareTextIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserChatsQuery } from "@/features/conversations/api/conversations.queries";

import { ChatList } from "./chat-list";

const USER_CHATS_PAGE_SIZE = 10;
const CONVERSATION_SKELETON_KEYS = [
	"conversation-one",
	"conversation-two",
	"conversation-three",
	"conversation-four",
] as const;

export function UserConversationsList({ userId }: { userId: string }) {
	const [page, setPage] = useState(1);
	const chatsQuery = useUserChatsQuery({
		userId,
		page,
		pageSize: USER_CHATS_PAGE_SIZE,
	});

	if (chatsQuery.isPending) {
		return <UserConversationsSkeleton />;
	}

	if (chatsQuery.isError || !chatsQuery.data) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MessageSquareTextIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Conversations could not be loaded</EmptyTitle>
					<EmptyDescription>
						{chatsQuery.error instanceof Error
							? chatsQuery.error.message
							: "Retry the request to see this user's conversations."}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						type="button"
						size="sm"
						onClick={() => void chatsQuery.refetch()}
					>
						<RefreshCwIcon aria-hidden="true" />
						Retry
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<ChatList
			items={chatsQuery.data.items}
			page={chatsQuery.data.page}
			pageSize={chatsQuery.data.pageSize}
			total={chatsQuery.data.total}
			onPageChange={setPage}
			isFetching={chatsQuery.isFetching}
			emptyTitle="No conversations yet"
			emptyDescription="This user's chats will appear here after their first message."
		/>
	);
}

function UserConversationsSkeleton() {
	return (
		<div className="space-y-3" role="status" aria-label="Loading conversations">
			<Skeleton className="h-10 w-full" />
			{CONVERSATION_SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-14 w-full" />
			))}
		</div>
	);
}
