import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { ChatDetailPage } from "@/features/conversations/pages/chat-detail-page";

export const Route = createFileRoute("/_dashboard/chats/$chatId")({
	component: ChatDetailRoute,
	head: () => ({
		meta: [{ title: "Conversation inspector | Wandit Admin" }],
	}),
});

function ChatDetailRoute() {
	const { chatId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ conversations: ["read"] }}>
			<ChatDetailPage chatId={chatId} />
		</RequireAdminPermission>
	);
}
