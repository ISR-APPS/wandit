import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, MessageSquareTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type ProjectConversationsCardProps = {
	projectId: string;
	userId: string;
};

export function ProjectConversationsCard({
	projectId,
	userId,
}: ProjectConversationsCardProps) {
	return (
		<Card className="gap-0 shadow-none">
			<CardHeader>
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
						<MessageSquareTextIcon aria-hidden="true" className="size-4" />
					</div>
					<div className="space-y-1">
						<CardTitle>Conversations</CardTitle>
						<CardDescription>
							Inspect chat transcripts, recorded failures, and AI usage.
						</CardDescription>
					</div>
				</div>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link
							to="/users/$userId/projects/$projectId/chats"
							params={{ userId, projectId }}
						>
							View conversations
							<ArrowRightIcon aria-hidden="true" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
		</Card>
	);
}
