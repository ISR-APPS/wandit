// The inbox card of the audience page: one follower thread under a post, with a reply field.
// AudiencePage renders it. A reply goes into the query cache of the thread only: it lasts for the session
// and the network never gets it (STARTER.md says so). A later turn sends it with a server function.
import { ArrowSquareOutIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { channelProfile } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import {
	INBOX_QUERY_KEY,
	type InboxThread,
	inboxQueryOptions,
} from "../api/audience.queries";

// The networks cut a reply at about 500 characters. The field stops there.
const MAX_REPLY_LENGTH = 500;

/** The follower messages sit at the start side, the replies of the team at the end side. */
export function InboxCard() {
	const { t } = useT();
	const queryClient = useQueryClient();
	const { data: thread } = useSuspenseQuery(inboxQueryOptions());
	const [draft, setDraft] = useState("");
	const reply = draft.trim();

	function sendReply(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (reply.length === 0) {
			return;
		}
		queryClient.setQueryData<InboxThread>(INBOX_QUERY_KEY, (current) =>
			current
				? {
						...current,
						messages: [
							...current.messages,
							{
								id: `reply-${current.messages.length + 1}`,
								from: "brand",
								text: reply,
								at: new Date().toISOString(),
							},
						],
					}
				: current,
		);
		setDraft("");
	}

	return (
		<Card className="h-full">
			<CardHeader className="flex items-center gap-4">
				<Avatar>
					<AvatarFallback className="bg-muted">
						{thread.name
							.split(" ")
							.map((part) => part.charAt(0))
							.join("")}
					</AvatarFallback>
				</Avatar>
				<div className="grid min-w-0">
					<span className="truncate text-sm">{thread.name}</span>
					<span className="truncate text-muted-foreground text-sm">
						{thread.handle} · {channelProfile(thread.channelId).handle}
					</span>
				</div>
				{thread.postId ? (
					<CardAction>
						<Button
							variant="outline"
							size="icon"
							className="rounded-full"
							asChild
							aria-label={t("audience.openPost")}
						>
							<Link to="/app/posts/$postId" params={{ postId: thread.postId }}>
								<ArrowSquareOutIcon />
							</Link>
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				{/* A flex column sizes each bubble to its text, up to 80% of the card. */}
				<ul className="flex flex-1 flex-col gap-4" aria-live="polite">
					{thread.messages.map((message) => (
						<li
							key={message.id}
							className={cn(
								"max-w-[80%] rounded-surface px-3 py-2 text-sm",
								message.from === "brand"
									? "self-end bg-primary text-primary-foreground"
									: "self-start bg-muted",
							)}
						>
							<span className="sr-only">
								{message.from === "brand"
									? t("audience.fromTeam")
									: thread.name}
								:{" "}
							</span>
							{message.text}
						</li>
					))}
				</ul>
				<form onSubmit={sendReply} className="flex items-center gap-2">
					<Input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						maxLength={MAX_REPLY_LENGTH}
						placeholder={t("audience.replyPlaceholder")}
						aria-label={t("audience.replyPlaceholder")}
					/>
					<Button
						type="submit"
						size="icon"
						disabled={reply.length === 0}
						aria-label={t("audience.send")}
					>
						<PaperPlaneRightIcon className="rtl:-scale-x-100" />
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
