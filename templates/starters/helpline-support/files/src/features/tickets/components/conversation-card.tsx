// The conversation of one ticket: every message and change, oldest first, and a closing line with the state.
// TicketDetailPage renders it in its main column. It reads the conversation of the ticket query.

import { fillMessage } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { TicketDetail } from "../api/tickets.queries";
import { ConversationEvent } from "./conversation-event";
import { ConversationMessage } from "./conversation-message";

type ConversationCardProps = {
	ticket: TicketDetail;
};

/** The thread, then one line that says who acts next: the team, the customer, or nobody. */
export function ConversationCard({ ticket }: ConversationCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const messageCount = ticket.conversation.filter(
		(entry) => entry.kind !== "event",
	).length;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tickets.conversation")}</CardTitle>
				<CardDescription>
					{/* PluralRules picks "1 message" or "4 messages" in the app language. */}
					{fillMessage(
						t(
							new Intl.PluralRules(locale).select(messageCount) === "one"
								? "tickets.messageCountOne"
								: "tickets.messageCount",
						),
						{
							count: new Intl.NumberFormat(locale).format(messageCount),
						},
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{ticket.conversation.map((entry) =>
					entry.kind === "event" ? (
						<ConversationEvent
							key={entry.id}
							event={entry.event}
							agentName={entry.agentName}
							at={entry.at}
							now={now}
						/>
					) : (
						<ConversationMessage
							key={entry.id}
							kind={entry.kind}
							authorName={entry.authorName}
							body={entry.body}
							at={entry.at}
							now={now}
						/>
					),
				)}
				<p className="rounded-lg bg-muted px-4 py-3 text-muted-foreground text-sm">
					{t(`tickets.nextStep.${ticket.status}`)}
				</p>
			</CardContent>
		</Card>
	);
}
