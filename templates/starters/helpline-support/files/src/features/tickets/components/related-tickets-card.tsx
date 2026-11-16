// The other recent tickets of the same company, one per row: subject, number, status, and age.
// TicketDetailPage renders it under the conversation. It reads `relatedTickets` of the ticket query.
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	TicketStatusBadge,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TicketDetail } from "../api/tickets.queries";

type RelatedTicketsCardProps = {
	ticket: TicketDetail;
};

/** Up to 5 rows, newest first. A company with no other ticket keeps the card with one muted sentence. */
export function RelatedTicketsCard({ ticket }: RelatedTicketsCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("tickets.otherTickets"), {
						name: ticket.customer.name,
					})}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{ticket.relatedTickets.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("tickets.noOtherTickets")}
					</p>
				) : (
					<ul className="grid">
						{/* The link covers its row (after:inset-0), so a tap anywhere in the row opens the ticket. */}
						{ticket.relatedTickets.map((related) => (
							<li
								key={related.id}
								className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
							>
								<Link
									to="/app/tickets/$ticketId"
									params={{ ticketId: related.id }}
									className="min-w-0 @xl/main:flex-1 @xl/main:basis-0 basis-full truncate font-medium text-sm after:absolute after:inset-0 hover:underline"
								>
									{related.subject}
								</Link>
								<span className="text-muted-foreground text-xs tabular-nums">{`#${related.id}`}</span>
								<TicketStatusBadge status={related.status} />
								<span className="@xl/main:ms-0 ms-auto @xl/main:w-24 whitespace-nowrap @xl/main:text-end text-muted-foreground text-xs">
									{formatRelativeTime(related.createdAt, now, locale)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
